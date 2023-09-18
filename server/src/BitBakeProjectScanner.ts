/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.Diagnstic
 * ------------------------------------------------------------------------------------------ */

// @ts-expect-error -- execa has no declaration file
import execa from 'execa'
import find from 'find'
import path from 'path'
import fs from 'fs'

import logger from 'winston'

import type {
  Connection
} from 'vscode-languageserver'
import type {
  ElementInfo,
  LayerInfo,
  PathInfo
} from './ElementInfo'

import {
  OutputParser
} from './OutputParser'

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
  private _deepExamine: boolean = false
  private _settingsScriptInterpreter: string = '/bin/bash'
  private _settingsWorkingFolder: string = 'vscode-bitbake-build'
  private _settingsGenerateWorkingFolder: boolean = true
  private readonly _settingsBitbakeSourceCmd: string = '.'
  private _settingsMachine: string | undefined = undefined
  private readonly _outputParser: OutputParser
  private readonly _oeEnvScript: string = 'oe-init-build-env'

  constructor (connection: Connection) {
    this._outputParser = new OutputParser(connection)
  }

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

  get deepExamine (): boolean {
    return this._deepExamine
  }

  set deepExamine (deepExamine: boolean) {
    this._deepExamine = deepExamine
  }

  get scriptInterpreter (): string {
    return this._settingsScriptInterpreter
  }

  set scriptInterpreter (scriptInterpreter: string) {
    this._settingsScriptInterpreter = scriptInterpreter
  }

  get workingPath (): string {
    return this._settingsWorkingFolder
  }

  set workingPath (workingPath: string) {
    this._settingsWorkingFolder = workingPath
  }

  get generateWorkingPath (): boolean {
    return this._settingsGenerateWorkingFolder
  }

  set generateWorkingPath (generateWorkingPath: boolean) {
    this._settingsGenerateWorkingFolder = generateWorkingPath
  }

  get machineName (): string | undefined {
    return this._settingsMachine
  }

  set machineName (machine: string) {
    if (machine === '') {
      this._settingsMachine = undefined
    } else {
      this._settingsMachine = machine
    }
  }

  setProjectPath (projectPath: string): void {
    this._projectPath = projectPath
  }

  rescanProject (): void {
    logger.info(`request rescanProject ${this._projectPath}`)

    if (this._scanStatus.scanIsRunning) {
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
        if (typeof error === 'string') {
          logger.error(`scanning of project is abborted: ${error}`)
        }
        throw error
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

    const output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-layers')

    if (output.length > 0) {
      try {
        let tempStr: string[] = output.split('\n')
        tempStr = tempStr.slice(2)

        for (const element of tempStr) {
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
      } catch (error) {
        if (typeof error !== 'string') {
          throw error
        }
        logger.error(`can not scan available layers error: ${error}`)
        this._outputParser.parse(error)
      }
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

    const output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-recipes')

    if (output.length > 0) {
      const outerReg: RegExp = /(.+):\n((?:\s+\S+\s+\S+(?:\s+\(skipped\))?\n)+)/g
      const innerReg: RegExp = /\s+(\S+)\s+(\S+(?:\s+\(skipped\))?)\n/g
      let match: RegExpExecArray | null

      while ((match = outerReg.exec(output)) !== null) {
        if (match.index === outerReg.lastIndex) {
          outerReg.lastIndex++
        }

        let matchInner: RegExpExecArray | null
        const extraInfoString: string[] = new Array < string >()
        let layerName: string
        let version: string = ''

        while ((matchInner = innerReg.exec(match[2])) !== null) {
          if (matchInner.index === innerReg.lastIndex) {
            innerReg.lastIndex++
          }

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
    }

    this.scanForRecipesPath()
  }

  parseAllRecipes (): boolean {
    logger.debug('parseAllRecipes')
    let parsingOutput: string
    let parsingSuccess: boolean = true

    try {
      parsingOutput = this.executeCommandInBitBakeEnvironment('bitbake -p', this._settingsMachine)
    } catch (error) {
      if (typeof error !== 'string') {
        throw error
      }
      logger.error(`parsing all recipes is abborted: ${error}`)
      parsingOutput = error
    }

    if (parsingOutput.length > 0) {
      this._outputParser.parse(parsingOutput)
      if (this._outputParser.errorsFound()) {
        this._outputParser.reportProblems()
        parsingSuccess = false
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

    if (this._deepExamine) {
      const recipesWithOutPath: ElementInfo[] = this._recipes.filter((obj: ElementInfo): boolean => {
        return obj.path === undefined
      })

      logger.info(`${recipesWithOutPath.length} recipes must be examined more deeply.`)

      for (const recipeWithOutPath of recipesWithOutPath) {
        const output: string = this.executeCommandInBitBakeEnvironment(`bitbake-layers show-recipes -f ${recipeWithOutPath.name}`)
        const regExp: RegExp = /(\s.*\.bb)/g
        let match: RegExpExecArray | null

        if (output.length > 0) {
          while ((match = regExp.exec(output)) !== null) {
            if (match.index === regExp.lastIndex) {
              regExp.lastIndex++
            }

            recipeWithOutPath.path = path.parse(match[0].trim())
          }
        }
      }
    }
  }

  private scanRecipesAppends (): void {
    const output: string = this.executeCommandInBitBakeEnvironment('bitbake-layers show-appends')

    if (output.length > 0) {
      const outerReg: RegExp = /(\S.*\.bb):(?:\s*\/\S*.bbappend)+/g

      let match: RegExpExecArray | null

      while ((match = outerReg.exec(output)) !== null) {
        if (match.index === outerReg.lastIndex) {
          outerReg.lastIndex++
        }
        let matchInner: RegExpExecArray | null
        const fullRecipeNameAsArray: string[] = match[1].split('_')

        if (fullRecipeNameAsArray.length > 0) {
          const recipeName: string = fullRecipeNameAsArray[0]

          const recipe: ElementInfo | undefined = this.recipes.find((obj: ElementInfo): boolean => {
            return obj.name === recipeName
          })

          if (recipe !== undefined) {
            const innerReg: RegExp = /(\S*\.bbappend)/g

            while ((matchInner = innerReg.exec(match[0])) !== null) {
              if (matchInner.index === innerReg.lastIndex) {
                innerReg.lastIndex++
              }

              if (recipe.appends === undefined) {
                recipe.appends = new Array < PathInfo >()
              }

              recipe.appends.push(path.parse(matchInner[0]))
            }
          }
        }
      }
    }
  }

  private executeCommandInBitBakeEnvironment (command: string, machine: string | undefined = undefined): string {
    let returnValue: string = ''

    if (this.isBitbakeAvailable()) {
      const scriptContent: string = this.generateBitBakeCommandScriptFileContent(command, machine)
      const pathToScriptFile: string = this._projectPath + '/' + this._settingsWorkingFolder
      const scriptFileName: string = pathToScriptFile + '/executeBitBakeCmd.sh'

      if (!fs.existsSync(pathToScriptFile)) {
        fs.mkdirSync(pathToScriptFile)
      }
      fs.writeFileSync(scriptFileName, scriptContent)
      fs.chmodSync(scriptFileName, '0755')

      returnValue = this.executeCommand(scriptFileName)
    }

    return returnValue
  }

  private executeCommand (command: string): string {
    let stdOutput: string = ''

    if (this._projectPath !== null) {
      const returnObject = execa.shellSync(command)

      if (returnObject.status === 0) {
        stdOutput = returnObject.stdout
      } else {
        const data: Buffer = fs.readFileSync(command)
        logger.error('error on executing command: ' + data.toString())
      }
    }

    return stdOutput
  }

  private generateBitBakeCommandScriptFileContent (bitbakeCommand: string, machine: string | undefined = undefined): string {
    const scriptFileBuffer: string[] = []
    let scriptBitbakeCommand: string = bitbakeCommand

    scriptFileBuffer.push('#!' + this._settingsScriptInterpreter)
    scriptFileBuffer.push(this._settingsBitbakeSourceCmd + ' ./' + this._oeEnvScript + ' ' + this._settingsWorkingFolder + ' > /dev/null')

    if (machine !== undefined) {
      scriptBitbakeCommand = `MACHINE=${machine} ` + scriptBitbakeCommand
    }

    scriptFileBuffer.push(scriptBitbakeCommand)

    return scriptFileBuffer.join('\n')
  }

  private isBitbakeAvailable (): boolean {
    const settingActive: boolean = this._settingsGenerateWorkingFolder
    const oeEnvScriptExists: boolean = fs.existsSync(this._oeEnvScript)
    let bitbakeAvailable: boolean = false

    if (settingActive && oeEnvScriptExists) {
      bitbakeAvailable = true
    }

    return bitbakeAvailable
  }
}
