/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type childProcess from 'child_process'
import find from 'find'
import path from 'path'
import EventEmitter from 'events'
import * as vscode from 'vscode'

import { logger } from '../lib/src/utils/OutputLogger'

import type {
  BitbakeScanResult,
  DevtoolWorkspaceInfo,
  ElementInfo,
  LayerInfo,
  PathInfo
} from '../lib/src/types/BitbakeScanResult'

import { type BitbakeDriver } from './BitbakeDriver'
import { type LanguageClient } from 'vscode-languageclient/node'
import fs from 'fs'
import { runBitbakeTerminalCustomCommand } from '../ui/BitbakeTerminal'
import { bitbakeESDKMode } from './BitbakeESDK'
import { finishProcessExecution } from '../utils/ProcessUtils'
import { extractRecipeName } from '../lib/src/utils/files'

interface ScannStatus {
  scanIsRunning: boolean
  scanIsPending: boolean
}

/**
 * BitBakeProjectScanner
 */
export class BitBakeProjectScanner {
  private readonly _classFileExtension: string = 'bbclass'
  private readonly _includeFileExtension: string = 'inc'
  private readonly _recipesFileExtension: string = 'bb'
  private readonly _confFileExtension: string = 'conf'
  onChange: EventEmitter = new EventEmitter()

  private readonly _bitbakeScanResult: BitbakeScanResult = { _classes: [], _includes: [], _layers: [], _overrides: [], _recipes: [], _workspaces: [], _confFiles: [] }
  private readonly _bitbakeDriver: BitbakeDriver
  private _languageClient: LanguageClient | undefined

  /// These attributes map bind mounts of the workDir to the host system if a docker container commandWrapper is used (-v).
  private containerMountPoint: string | undefined
  private hostMountPoint: string | undefined

  constructor (bitbakeDriver: BitbakeDriver) {
    this._bitbakeDriver = bitbakeDriver
  }

  setClient (languageClient: LanguageClient): void {
    this._languageClient = languageClient
  }

  private readonly _scanStatus: ScannStatus = {
    scanIsRunning: false,
    scanIsPending: false
  }

  get scanResult (): BitbakeScanResult {
    return this._bitbakeScanResult
  }

  get bitbakeDriver (): BitbakeDriver {
    return this._bitbakeDriver
  }

  public needsContainerPathsResolution (): boolean {
    return this.containerMountPoint !== undefined
  }

  /// A quick scan to present devtool modify/reset results. A full rescan is required for .bbappends.
  async rescanDevtoolWorkspaces (): Promise<void> {
    logger.info('request rescanDevtoolWorkspaces')
    await this.scanDevtoolWorkspaces()
    this.onChange.emit('scanReady', this._bitbakeScanResult)
  }

  async rescanProject (): Promise<void> {
    logger.info('request rescanProject')

    if (!this._scanStatus.scanIsRunning) {
      this._scanStatus.scanIsRunning = true
      logger.info('start rescanProject')
      this.onChange.emit('startScan')

      try {
        if (!bitbakeESDKMode) { // Has been set by sanity checking
          await this.scanAvailableLayers()
          this.scanForClasses()
          this.scanForIncludeFiles()
          this.scanForConfFiles()
          await this.scanForRecipes()
          await this.scanRecipesAppends()
          await this.scanOverrides()
        }
        await this.scanDevtoolWorkspaces()
        if (!bitbakeESDKMode) this.parseAllRecipes()

        logger.info('scan ready')
        this.printScanStatistic()

        void this._languageClient?.sendNotification('bitbake/scanReady', this._bitbakeScanResult)
        this.onChange.emit('scanReady', this._bitbakeScanResult)
      } catch (error) {
        logger.error(`scanning of project is abborted: ${error as any}`)
        this.onChange.emit('scanReady', this._bitbakeScanResult)
      }

      this._scanStatus.scanIsRunning = false

      if (this._scanStatus.scanIsPending) {
        this._scanStatus.scanIsPending = false
        await this.rescanProject()
      }
    } else {
      logger.info('scan is already running, set the pending flag')
      this._scanStatus.scanIsPending = true
    }
  }

  private async getContainerParentInodes (filepath: string): Promise<number[]> {
    const commandResult = await this.executeBitBakeCommand(`f=${filepath}; while [[ $f != / ]]; do stat -c %i $f; f=$(realpath $(dirname "$f")); done;`)
    const stdout = commandResult.stdout.toString().trim()
    const regex = /^\d+$/gm
    const matches = stdout.match(regex)
    return (matches != null) ? matches.map((match) => parseInt(match)) : [NaN]
  }

  /// Find corresponding mount point inode in layerPath/hostWorkdir and all parents
  private async scanContainerMountPoint (layerPath: string, hostWorkdir: string): Promise<void> {
    this.containerMountPoint = undefined
    this.hostMountPoint = undefined

    if (fs.existsSync(layerPath)) {
      // We're not inside a container, or the container is not using a different workdir
      return
    }

    const containerDirInodes = await this.getContainerParentInodes(layerPath)
    let hostDir = hostWorkdir

    while (hostDir !== '/') {
      const hostDirInode = fs.statSync(hostDir).ino

      let containerIdx = 0
      let containerDir = layerPath
      while (containerDir !== '/') {
        const containerDirInode = containerDirInodes[containerIdx]
        logger.debug('Comparing container inodes: ' + containerDir + ':' + containerDirInode + ' ' + hostDir + ':' + hostDirInode)
        if (containerDirInode === hostDirInode) {
          this.containerMountPoint = containerDir
          this.hostMountPoint = hostDir
          logger.info(`Found container mount point: ${this.containerMountPoint} -> ${this.hostMountPoint}`)
          return
        }
        containerDir = path.dirname(containerDir)
        containerIdx++
      }
      hostDir = path.dirname(hostDir)
    }
  }

  private printScanStatistic (): void {
    logger.info('Scan results:')
    logger.info('******************************************************************')
    logger.info(`Layer:     ${this._bitbakeScanResult._layers.length}`)
    logger.info(`Recipes:   ${this._bitbakeScanResult._recipes.length}`)
    logger.info(`Inc-Files: ${this._bitbakeScanResult._includes.length}`)
    logger.info(`bbclass:   ${this._bitbakeScanResult._classes.length}`)
    logger.info(`conf Files:   ${this._bitbakeScanResult._confFiles.length}`)
    logger.info(`overrides:   ${this._bitbakeScanResult._overrides.length}`)
    logger.info(`Devtool-workspaces:   ${this._bitbakeScanResult._workspaces.length}`)
  }

  private scanForClasses (): void {
    this._bitbakeScanResult._classes = this.searchFiles(this._classFileExtension)
  }

  private scanForIncludeFiles (): void {
    this._bitbakeScanResult._includes = this.searchFiles(this._includeFileExtension)
  }

  private scanForConfFiles (): void {
    this._bitbakeScanResult._confFiles = this.searchFiles(this._confFileExtension)
  }

  private async scanAvailableLayers (): Promise<void> {
    this._bitbakeScanResult._layers = new Array < LayerInfo >()
    this.containerMountPoint = undefined

    const commandResult = await this.executeBitBakeCommand('bitbake-layers show-layers')

    if (commandResult.status === 0) {
      const output = commandResult.stdout.toString()
      const outputLines = output.split(/\r?\n/g)

      const layersStartRegex = /^layer *path *priority$/
      let layersFirstLine = 0
      for (; layersFirstLine < outputLines.length; layersFirstLine++) {
        if (layersStartRegex.test(outputLines[layersFirstLine])) {
          break
        }
      }

      for (const element of outputLines.slice(layersFirstLine + 2)) {
        const tempElement = element.split(/\s+/)
        const layerElement = {
          name: tempElement[0],
          path: await this.resolveContainerPath(tempElement[1]),
          priority: parseInt(tempElement[2])
        }

        if ((layerElement.name !== undefined) && (layerElement.path !== undefined) && (layerElement.priority !== undefined)) {
          this._bitbakeScanResult._layers.push(layerElement as LayerInfo)
        }
      }
    } else {
      const error = commandResult.stderr.toString()
      logger.error(`can not scan available layers error: ${error}`)
      throw new Error('can not scan available layers')
    }
  }

  private async resolveCorrespondingPath (inputPath: string | undefined, hostToContainer: boolean, quiet: boolean = false): Promise<string | undefined> {
    if (inputPath === undefined) {
      return undefined
    }
    if (this.containerMountPoint === undefined && !hostToContainer) {
      // Should only be called through scanAvailableLayers()
      const hostWorkdir = this.bitbakeDriver?.bitbakeSettings.workingDirectory
      if (hostWorkdir === undefined) {
        throw new Error('hostWorkdir is undefined')
      }
      await this.scanContainerMountPoint(inputPath, hostWorkdir)
    }
    const origMountPoint = hostToContainer ? this.hostMountPoint : this.containerMountPoint
    const destMountPoint = hostToContainer ? this.containerMountPoint : this.hostMountPoint
    const fileExistsFn = hostToContainer ? this.existsInContainer.bind(this) : fs.existsSync
    if (origMountPoint === undefined || destMountPoint === undefined) {
      return inputPath
    }
    const relativePath = path.relative(origMountPoint, inputPath)
    let resolvedPath = path.resolve(destMountPoint, relativePath)
    if (!await fileExistsFn(resolvedPath)) {
      // This makes it work with the default kas-container configuration (/work & /build volumes)
      resolvedPath = path.resolve(destMountPoint, relativePath.replace('../', ''))
    }
    if (!await fileExistsFn(resolvedPath)) {
      // Showing a modal here because this can only happend through the command devtool-update-recipe which is not used often
      if (!quiet) {
        await vscode.window.showErrorMessage(
          'Bitbake extension couldn\'t locate a file.', {
            modal: true,
            detail: `It looks like you are using the bitbake.commandWrapper setting to use a docker container.\n
Couldn't find ${inputPath} corresponding paths inside and outside of the container.\n
You should adjust your docker volumes to use the same URIs as those present on your host machine.`
          })
      }
      return resolvedPath
    }
    return resolvedPath
  }

  /// If a docker container is used, the workdir may be different from the host system.
  /// This function resolves the path to the host system.
  async resolveContainerPath (layerPath: string | undefined, quiet: boolean = false): Promise<string | undefined> {
    return await this.resolveCorrespondingPath(layerPath, false, quiet)
  }

  /// This function mirrors resolveContainerPath, but for the other direction.
  async resolveHostPath (containerPath: string | undefined, quiet: boolean = false): Promise<string | undefined> {
    return await this.resolveCorrespondingPath(containerPath, true, quiet)
  }

  private async existsInContainer (containerPath: string): Promise<boolean> {
    const process = runBitbakeTerminalCustomCommand(this._bitbakeDriver, 'test -e ' + containerPath, 'BitBake: Test file', true)
    const res = finishProcessExecution(process, async () => { await this.bitbakeDriver.killBitbake() })
    return (await res).status === 0
  }

  private searchFiles (pattern: string): ElementInfo[] {
    const elements: ElementInfo[] = new Array < ElementInfo >()

    for (const layer of this._bitbakeScanResult._layers) {
      try {
        const files = find.fileSync(new RegExp(`.${pattern}$`), layer.path)
        for (const file of files) {
          const pathObj: PathInfo = path.parse(file)

          const element: ElementInfo = {
            name: pathObj.name,
            path: pathObj,
            extraInfo: `layer: ${layer.name}`,
            layerInfo: layer
          }

          elements.push(element)
        }
      } catch (error) {
        logger.error(`find error: pattern: ${pattern} layer.path: ${layer.path} error: ${JSON.stringify(error)}`)
        throw error
      }
    }

    return elements
  }

  async scanForRecipes (): Promise<void> {
    this._bitbakeScanResult._recipes = new Array < ElementInfo >()

    const commandResult = await this.executeBitBakeCommand('bitbake-layers show-recipes')
    if (commandResult.status !== 0) {
      logger.error(`Failed to scan recipes: ${commandResult.stderr.toString()}`)
      throw new Error('Failed to scan recipes')
    }

    const output = commandResult.output.toString()
    const splittedOutput = output.split(/\r?\n/g)
    // All recipes found will follow the line: === Available recipes: ===
    const startingIndex = splittedOutput.findIndex((line) => line.includes('Available recipes'))
    logger.debug(`Starting index: ${startingIndex}`)

    let outputRecipeSection = ''
    if (startingIndex === -1) {
      logger.error('Failed to find available recipes')
    } else {
      outputRecipeSection = splittedOutput.slice(startingIndex).join('\n')
    }

    /**
     * Example:
     * zstd:
        meta                 1.5.5

       The ones that are followed by (skipped) are not included.
     */
    const recipeRegex = /(?<name>.+):\r?\n((?:\s+(?<layer>\S+)\s+(?<version>\S+)(?:\s+\(skipped\))?\r?\n)+)/g

    for (const match of outputRecipeSection.matchAll(recipeRegex)) {
      const name = match.groups?.name
      const layerName = match.groups?.layer
      const version = match.groups?.version

      if (name === undefined) {
        logger.error('[scanForRecipes] recipeName is undefined')
        continue
      }

      const extraInfo = [`layer: ${layerName}`, `version: ${version} `].join('\r\n')

      const layerInfo = this._bitbakeScanResult._layers.find((layer) => {
        return layer.name === layerName
      })

      const element: ElementInfo = {
        name,
        extraInfo,
        layerInfo,
        version
      }

      this._bitbakeScanResult._recipes.push(element)
    }

    await this.scanForRecipesPath()
  }

  async scanOverrides (): Promise<void> {
    const commandResult = await this.executeBitBakeCommand('bitbake-getvar OVERRIDES')
    if (commandResult.status !== 0) {
      logger.error(`Failed to scan overrides: ${commandResult.stderr.toString()}`)
      throw new Error('Failed to scan overrides')
    }
    const output = commandResult.output.toString()
    const outerReg = /\nOVERRIDES="(.*)"\r?\n/
    this._bitbakeScanResult._overrides = output.match(outerReg)?.[1].split(':') ?? []
  }

  private async scanDevtoolWorkspaces (): Promise<void> {
    this._bitbakeScanResult._workspaces = new Array < DevtoolWorkspaceInfo >()
    const commandResult = await this.executeBitBakeCommand('devtool status')
    if (commandResult.status !== 0) {
      logger.error(`Failed to scan devtool workspaces: ${commandResult.stderr.toString()}`)
      throw new Error('Failed to scan devtool workspaces')
    }
    const output = commandResult.output.toString()
    const regex = /^([^\s]+):\s([^\s]+)$/gm
    let match
    while ((match = regex.exec(output)) !== null) {
      this._bitbakeScanResult._workspaces.push({ name: match[1], path: match[2] })
    }
  }

  parseAllRecipes (): void {
    void vscode.commands.executeCommand('bitbake.parse-recipes')
  }

  private async scanForRecipesPath (): Promise<void> {
    const showRecipeFileNameOutput = await this.executeBitBakeCommand('bitbake-layers show-recipes -f')
    if (showRecipeFileNameOutput.status !== 0) {
      logger.error('Failed to scan recipes path')
      return
    }

    const output = showRecipeFileNameOutput.output.toString()
    const splittedOutput = output.split(/\r?\n/g)
    const startingIndex = splittedOutput.findIndex((line) => line.includes('Available recipes'))

    const allFileNames: string[] = []
    if (startingIndex === -1) {
      logger.error('[scanForRecipesPath] Failed to find available recipes')
      return
    }

    const recipePathRegex = /(.*\.bb)/

    // All lines after the '=== Available recipes: ===' line are file names, and only keep the valid ones
    allFileNames.push(...splittedOutput.slice(startingIndex + 1).filter((line) => !line.includes('(skipped') && recipePathRegex.exec(line) !== null))

    const notMatchedFileNames: string[] = []
    for (const fileName of allFileNames) {
      const match = recipePathRegex.exec(fileName)
      if (match === null) {
        continue
      }

      const recipePath = match[0].trim()
      const foundRecipe = this._bitbakeScanResult._recipes.find((recipe) => {
        return recipe.name === extractRecipeName(recipePath)
      })
      if (foundRecipe !== undefined) {
        foundRecipe.path = path.parse(recipePath)
      } else {
        notMatchedFileNames.push(fileName)
      }
    }

    const recipesWithOutPath = this._bitbakeScanResult._recipes.filter((recipe) => {
      return recipe.path === undefined
    })

    logger.debug(`${recipesWithOutPath.length} recipes did not get the path from the 'bitbake-layers show-recipes -f' command.`)
    logger.debug(`${notMatchedFileNames.length} file names (from 'bitbake-layers show-recipes -f) are not matched with any recipes.`)

    const matchedFileNamesAfterInfer: string[] = []

    // Infer the path of the recipes that didn't get a path from the previous step
    for (const recipe of recipesWithOutPath) {
      // Some recipes name found by 'bitbake-layers show-recipes' have extra strings appended to them, but in the path found with option '-f' it is not present
      /**
       * name: go-cross-core2-64
         path: /home/projects/poky/meta/recipes-devtools/go/go-cross_1.20.14.bb
       */
      const possiblePaths = notMatchedFileNames.filter((fileName) => {
        return recipe.name.includes(extractRecipeName(fileName))
      })
      if (possiblePaths.length > 0) {
        // longer file names are more likely to be the correct one
        possiblePaths.sort((a, b) => extractRecipeName(b).length - extractRecipeName(a).length)
        logger.debug(`${possiblePaths[0]} is inferred as the path of ${recipe.name} recipe.`)
        recipe.path = path.parse(possiblePaths[0])
        matchedFileNamesAfterInfer.push(possiblePaths[0])
      }
    }

    const remainingRecipesWithoutPath = this._bitbakeScanResult._recipes.filter((recipe) => {
      return recipe.path === undefined
    })

    logger.debug(`${remainingRecipesWithoutPath.length} recipes still don't have a path after infer.`)
    if (remainingRecipesWithoutPath.length > 0) {
      logger.debug(`Remaining recipes without path: \n${JSON.stringify(remainingRecipesWithoutPath)}`)
    }
  }

  private async scanRecipesAppends (): Promise<void> {
    const commandResult = await this.executeBitBakeCommand('bitbake-layers show-appends')

    if (commandResult.status !== 0) {
      logger.error(`Failed to scan appends: ${commandResult.stderr.toString()}`)
      throw new Error('Failed to scan appends')
    }

    const output = commandResult.output.toString()

    // Example:
    // \r\nbusybox_1.36.1.bb:\r\n  /home/user/yocto/sources/poky/meta-poky/recipes-core/busybox/busybox_%.bbappend
    const outerReg: RegExp = /\r?\n(.*\.bb):(?:\r?\n\s*\/.*\.bbappend)+/g

    for (const match of output.matchAll(outerReg)) {
      const fullRecipeNameAsArray: string[] = match[1].split('_')

      if (fullRecipeNameAsArray.length > 0) {
        const recipeName: string = fullRecipeNameAsArray[0].split('.')[0]
        const recipeVersion: string | undefined = fullRecipeNameAsArray[1]?.split('.bb')[0]

        const recipe: ElementInfo | undefined = this._bitbakeScanResult._recipes.find((obj: ElementInfo): boolean => {
          return obj.name === recipeName
        })

        if (recipe !== undefined) {
          const innerReg: RegExp = /(\S*\.bbappend)/g

          for (const matchInner of match[0].matchAll(innerReg)) {
            if (recipe.appends === undefined) {
              recipe.appends = new Array < PathInfo >()
            }
            if (bbappendVersionMatches(recipeVersion, recipe.version)) {
              recipe.appends.push(path.parse(matchInner[0]))
            }
          }
        }
      }
    }
  }

  private async executeBitBakeCommand (command: string): Promise<childProcess.SpawnSyncReturns<Buffer>> {
    if (this._bitbakeDriver === undefined) {
      throw new Error('Bitbake driver is not set')
    }
    return await finishProcessExecution(runBitbakeTerminalCustomCommand(this._bitbakeDriver, command, 'BitBake: Scan Project', true),
      async () => { await this.bitbakeDriver.killBitbake() })
  }
}

function bbappendVersionMatches (bbappendVersion: string | undefined, recipeVersion: string | undefined): boolean {
  if (bbappendVersion === undefined) {
    return true
  }
  if (bbappendVersion === '%') {
    return true
  }
  if (recipeVersion === undefined) {
    return bbappendVersion === undefined
  }
  return recipeVersion.startsWith(bbappendVersion)
}
