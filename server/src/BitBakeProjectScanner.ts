/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type childProcess from 'child_process'
import find from 'find'
import path from 'path'

import { type Connection } from 'vscode-languageserver'

import { logger } from './lib/src/utils/OutputLogger'

import type {
  BitbakeScanResult,
  ElementInfo,
  LayerInfo,
  PathInfo
} from './lib/src/types/BitbakeScanResult'

import { BitbakeDriver } from './lib/src/BitbakeDriver'
interface ScannStatus {
  scanIsRunning: boolean
  scanIsPending: boolean
}

let _connection: Connection | null = null

/**
 * Set the connection. Should be done at startup.
 */
export function setBitBakeProjectScannerConnection (connection: Connection): void {
  _connection = connection
}

/**
 * BitBakeProjectScanner
 */
export class BitBakeProjectScanner {
  private readonly _classFileExtension: string = 'bbclass'
  private readonly _includeFileExtension: string = 'inc'
  private readonly _recipesFileExtension: string = 'bb'

  private _layers: LayerInfo[] = new Array < LayerInfo >()
  private _classes: ElementInfo[] = new Array < ElementInfo >()
  private _includes: ElementInfo[] = new Array < ElementInfo >()
  private _recipes: ElementInfo[] = new Array < ElementInfo >()
  private _overrides: string[] = []
  private _shouldDeepExamine: boolean = false
  private readonly _bitbakeDriver: BitbakeDriver = new BitbakeDriver()

  loadSettings (settings: any, workspaceFolder: string = ''): void {
    this._bitbakeDriver.loadSettings(settings, workspaceFolder)
  }

  private readonly _scanStatus: ScannStatus = {
    scanIsRunning: false,
    scanIsPending: false
  }

  get overrides (): string[] {
    return this._overrides
  }

  get bitbakeDriver (): BitbakeDriver {
    return this._bitbakeDriver
  }

  get layers (): LayerInfo[] {
    return this._layers
  }

  get classes (): ElementInfo[] {
    return this._classes
  }

  get includes (): ElementInfo[] {
    return this._includes
  }

  get recipes (): ElementInfo[] {
    return this._recipes
  }

  get shouldDeepExamine (): boolean {
    return this._shouldDeepExamine
  }

  set shouldDeepExamine (shouldDeepExamine: boolean) {
    this._shouldDeepExamine = shouldDeepExamine
  }

  rescanProject (): void {
    logger.info(`request rescanProject ${this._bitbakeDriver.bitbakeSettings.pathToBuildFolder}`)

    if (!this._scanStatus.scanIsRunning) {
      this._scanStatus.scanIsRunning = true
      logger.info('start rescanProject')
      void _connection?.sendNotification('bitbake/startScan')

      try {
        this.scanAvailableLayers()
        this.scanForClasses()
        this.scanForIncludeFiles()
        this.scanForRecipes()
        this.scanRecipesAppends()
        this.scanOverrides()
        this.parseAllRecipes()

        logger.info('scan ready')
        this.printScanStatistic()

        const scanResult: BitbakeScanResult = {
          recipes: this._recipes,
          includes: this._includes
        }
        void _connection?.sendNotification('bitbake/scanReady', scanResult)
      } catch (error) {
        logger.error(`scanning of project is abborted: ${error as any}`)
      }

      this._scanStatus.scanIsRunning = false

      if (this._scanStatus.scanIsPending) {
        this._scanStatus.scanIsPending = false
        this.rescanProject()
      }
    } else {
      logger.info('scan is already running, set the pending flag')
      this._scanStatus.scanIsPending = true
    }
  }

  private printScanStatistic (): void {
    logger.info(`Scan results for path: ${this._bitbakeDriver.bitbakeSettings.pathToBuildFolder}`)
    logger.info('******************************************************************')
    logger.info(`Layer:     ${this._layers.length}`)
    logger.info(`Recipes:   ${this._recipes.length}`)
    logger.info(`Inc-Files: ${this._includes.length}`)
    logger.info(`bbclass:   ${this._classes.length}`)
    logger.info(`overrides:   ${this._overrides.length}`)
  }

  private scanForClasses (): void {
    this._classes = this.searchFiles(this._classFileExtension)
  }

  private scanForIncludeFiles (): void {
    this._includes = this.searchFiles(this._includeFileExtension)
  }

  private scanAvailableLayers (): void {
    this._layers = new Array < LayerInfo >()

    const commandResult = this.executeBitBakeCommand('bitbake-layers show-layers')

    if (commandResult.status === 0) {
      const output = commandResult.stdout.toString()
      const outputLines = output.split('\n')

      const layersStartRegex = /^layer *path *priority$/
      let layersFirstLine = 0
      for (; layersFirstLine < outputLines.length; layersFirstLine++) {
        if (layersStartRegex.test(outputLines[layersFirstLine])) {
          break
        }
      }

      for (const element of outputLines.slice(layersFirstLine + 2)) {
        const tempElement: string[] = element.split(/\s+/)
        const layerElement = {
          name: tempElement[0],
          path: tempElement[1],
          priority: parseInt(tempElement[2])
        }

        if ((layerElement.name !== undefined) && (layerElement.path !== undefined) && layerElement.priority !== undefined) {
          this._layers.push(layerElement)
        }
      }
    } else {
      const error = commandResult.stderr.toString()
      logger.error(`can not scan available layers error: ${error}`)
    }
  }

  private searchFiles (pattern: string): ElementInfo[] {
    const elements: ElementInfo[] = new Array < ElementInfo >()

    for (const layer of this._layers) {
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

  scanForRecipes (): void {
    this._recipes = new Array < ElementInfo >()

    const commandResult = this.executeBitBakeCommand('bitbake-layers show-recipes')
    if (commandResult.status !== 0) {
      logger.error(`Failed to scan recipes: ${commandResult.stderr.toString()}`)
      return
    }

    const output = commandResult.output.toString()

    const outerReg: RegExp = /(.+):\n((?:\s+\S+\s+\S+(?:\s+\(skipped\))?\n)+)/g
    const innerReg: RegExp = /\s+(\S+)\s+(\S+(?:\s+\(skipped\))?)\n/g

    for (const match of output.matchAll(outerReg)) {
      const extraInfoString: string[] = new Array < string >()
      let layerName: string
      let version: string = ''

      for (const matchInner of match[2].matchAll(innerReg)) {
        if (extraInfoString.length === 0) {
          layerName = matchInner[1]
          version = matchInner[2]
        }

        extraInfoString.push(`layer: ${matchInner[1]}`)
        extraInfoString.push(`version: ${matchInner[2]} `)
      }

      const layer = this._layers.find((obj: LayerInfo): boolean => {
        return obj.name === layerName
      })

      const element: ElementInfo = {
        name: match[1],
        extraInfo: extraInfoString.join('\n'),
        layerInfo: layer,
        version
      }

      this._recipes.push(element)
    }

    this.scanForRecipesPath()
  }

  scanOverrides (): void {
    const commandResult = this.executeBitBakeCommand('bitbake-getvar OVERRIDES')
    if (commandResult.status !== 0) {
      logger.error(`Failed to scan overrides: ${commandResult.stderr.toString()}`)
      return
    }
    const output = commandResult.output.toString()
    const outerReg = /\nOVERRIDES="(.*)"\n/
    this._overrides = output.match(outerReg)?.[1].split(':') ?? []
  }

  parseAllRecipes (): void {
    void _connection?.sendRequest('bitbake/parseAllRecipes')
  }

  private scanForRecipesPath (): void {
    const tmpFiles = this.searchFiles(this._recipesFileExtension)

    for (const file of tmpFiles) {
      const recipeName: string = file.name.split(/[_]/g)[0]

      const element: ElementInfo | undefined = this._recipes.find((obj: ElementInfo): boolean => {
        return obj.name === recipeName
      })

      if (element !== undefined) {
        element.path = file.path
      }
    }

    if (this._shouldDeepExamine) {
      const recipesWithOutPath: ElementInfo[] = this._recipes.filter((obj: ElementInfo): boolean => {
        return obj.path === undefined
      })

      logger.info(`${recipesWithOutPath.length} recipes must be examined more deeply.`)

      for (const recipeWithOutPath of recipesWithOutPath) {
        const commandResult = this.executeBitBakeCommand(`bitbake-layers show-recipes -f ${recipeWithOutPath.name}`)
        if (commandResult.status !== 0) {
          logger.error(`Failed to scan recipes path: ${commandResult.stderr.toString()}`)
          continue
        }
        const output = commandResult.output.toString()
        const regExp: RegExp = /(\s.*\.bb)/g

        for (const match of output.matchAll(regExp)) {
          recipeWithOutPath.path = path.parse(match[0].trim())
        }
      }
    }
  }

  private scanRecipesAppends (): void {
    const commandResult = this.executeBitBakeCommand('bitbake-layers show-appends')

    if (commandResult.status !== 0) {
      logger.error(`Failed to scan appends: ${commandResult.stderr.toString()}`)
      return
    }

    const output = commandResult.output.toString()

    // Example:
    // \nbusybox_1.36.1.bb:\n  /home/user/yocto/sources/poky/meta-poky/recipes-core/busybox/busybox_%.bbappend
    const outerReg: RegExp = /\n(.*\.bb):(?:\n\s*\/.*\.bbappend)+/g

    for (const match of output.matchAll(outerReg)) {
      const fullRecipeNameAsArray: string[] = match[1].split('_')

      if (fullRecipeNameAsArray.length > 0) {
        const recipeName: string = fullRecipeNameAsArray[0].split('.')[0]
        const recipeVersion: string | undefined = fullRecipeNameAsArray[1]?.split('.bb')[0]

        const recipe: ElementInfo | undefined = this.recipes.find((obj: ElementInfo): boolean => {
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

  private executeBitBakeCommand (command: string): childProcess.SpawnSyncReturns<Buffer> {
    return this._bitbakeDriver.spawnBitbakeProcessSync(command)
  }
}

export const bitBakeProjectScanner = new BitBakeProjectScanner()

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
