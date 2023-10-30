/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'
import find from 'find'
import path from 'path'
import fs from 'fs'

import { logger } from './lib/src/utils/OutputLogger'

import type {
  ElementInfo,
  LayerInfo,
  PathInfo
} from './ElementInfo'

import
outputParser
  from './OutputParser'
import { serverNotificationManager } from './ServerNotificationManager'
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

  private _projectPath: string = ''
  private _layers: LayerInfo[] = new Array < LayerInfo >()
  private _classes: ElementInfo[] = new Array < ElementInfo >()
  private _includes: ElementInfo[] = new Array < ElementInfo >()
  private _recipes: ElementInfo[] = new Array < ElementInfo >()
  private _shouldDeepExamine: boolean = false
  private _pathToBuildFolder: string = 'build'
  private _pathToEnvScript: string = 'oe-init-build-env'
  private _pathToBitbakeFolder: string = 'bitbake'

  private readonly _scanStatus: ScannStatus = {
    scanIsRunning: false,
    scanIsPending: false
  }

  get projectPath (): string {
    return this._projectPath
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

  get pathToBuildFolder (): string {
    return this._pathToBuildFolder
  }

  set pathToBuildFolder (pathToBuildFolder: string) {
    this._pathToBuildFolder = pathToBuildFolder
  }

  get pathToEnvScript (): string {
    return this._pathToEnvScript
  }

  set pathToEnvScript (pathToEnvScript: string) {
    this._pathToEnvScript = pathToEnvScript
  }

  get pathToBitbakeFolder (): string {
    return this._pathToBitbakeFolder
  }

  set pathToBitbakeFolder (pathToBitbakeFolder: string) {
    this._pathToBitbakeFolder = pathToBitbakeFolder
  }

  setProjectPath (projectPath: string): void {
    this._projectPath = projectPath
  }

  rescanProject (): void {
    logger.info(`request rescanProject ${this._projectPath}`)

    if (!this._scanStatus.scanIsRunning) {
      this._scanStatus.scanIsRunning = true
      logger.info('start rescanProject')

      try {
        if (this.parseAllRecipes()) {
          this.scanAvailableLayers()
          this.scanForClasses()
          this.scanForIncludeFiles()
          this.scanForRecipes()
          this.scanRecipesAppends()

          logger.info('scan ready')
          this.printScanStatistic()
        }
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
    logger.info(`Scan results for path: ${this._projectPath}`)
    logger.info('******************************************************************')
    logger.info(`Layer:     ${this._layers.length}`)
    logger.info(`Recipes:   ${this._recipes.length}`)
    logger.info(`Inc-Files: ${this._includes.length}`)
    logger.info(`bbclass:   ${this._classes.length}`)
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

      for (const element of outputLines.slice(2)) {
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
      outputParser.parse(error)
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

  parseAllRecipes (): boolean {
    logger.debug('parseAllRecipes')
    let parsingSuccess: boolean = true

    const commandResult = this.executeBitBakeCommand('bitbake -p')
    const output = commandResult.output.toString()
    outputParser.parse(output)
    if (outputParser.errorsFound()) {
      outputParser.reportProblems()
      parsingSuccess = false
    } else {
      if (commandResult.status !== 0) {
        logger.warn('Unhandled parsing error:' + output)
      }
    }
    return parsingSuccess
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
    const output = commandResult.output.toString()

    const outerReg: RegExp = /(\S.*\.bb):(?:\s*\/\S*.bbappend)+/g

    for (const match of output.matchAll(outerReg)) {
      const fullRecipeNameAsArray: string[] = match[1].split('_')

      if (fullRecipeNameAsArray.length > 0) {
        const recipeName: string = fullRecipeNameAsArray[0]

        const recipe: ElementInfo | undefined = this.recipes.find((obj: ElementInfo): boolean => {
          return obj.name === recipeName
        })

        if (recipe !== undefined) {
          const innerReg: RegExp = /(\S*\.bbappend)/g

          for (const matchInner of match[0].matchAll(innerReg)) {
            if (recipe.appends === undefined) {
              recipe.appends = new Array < PathInfo >()
            }

            recipe.appends.push(path.parse(matchInner[0]))
          }
        }
      }
    }
  }

  private executeBitBakeCommand (command: string): childProcess.SpawnSyncReturns<Buffer> {
    const scriptContent: string = this.generateBitBakeCommand(command)
    const commandResult = this.executeCommand(scriptContent)

    if (commandResult.status === 127) {
      const output = commandResult.stderr.toString()
      if (output.includes('bitbake')) {
        // Seems like Bitbake could not be found.
        // Are we sure this is the actual error?
        serverNotificationManager.sendBitBakeNotFound()
        throw new Error(output)
      }
    }

    return commandResult
  }

  private executeCommand (command: string): childProcess.SpawnSyncReturns<Buffer> {
    return childProcess.spawnSync(command, { shell: true })
  }

  private generateBitBakeCommand (bitbakeCommand: string): string {
    const scriptFileBuffer: string[] = []

    if (fs.existsSync(this._pathToEnvScript)) {
      logger.info('using env script')
      scriptFileBuffer.push(`. ./${this._pathToEnvScript} ${this._pathToBuildFolder} > /dev/null`)
    } else {
      logger.info('not using env script')
      scriptFileBuffer.push(
        `export PYTHONPATH=${this._pathToBitbakeFolder}/lib:$PYTHONPATH`,
        `export PATH=${this._pathToBitbakeFolder}/bin:$PATH`,
        `cd ${this.pathToBuildFolder}`
      )
    }

    scriptFileBuffer.push(bitbakeCommand)

    return scriptFileBuffer.join('\n')
  }
}

const bitBakeProjectScanner = new BitBakeProjectScanner()
export default bitBakeProjectScanner
