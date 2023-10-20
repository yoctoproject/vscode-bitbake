/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import logger from 'winston'
import { type CompletionItem } from 'vscode-languageserver'

type SuffixType = 'layer' | 'providedItem' | undefined

export interface VariableInfos {
  name: string
  definition: string
  validFiles?: RegExp[] // Files on which the variable is defined. If undefined, the variable is defined in all files.
  suffixType?: SuffixType
}

type VariableInfosOverride = Partial<VariableInfos>

// Infos that can't be parsed properly from the doc
const variableInfosOverrides: Record<string, VariableInfosOverride> = {
  BBFILE_PATTERN: {
    suffixType: 'layer'
  },
  LAYERDEPENDS: {
    suffixType: 'layer'
  },
  LAYERDIR: {
    validFiles: [/^.*\/conf\/layer.conf$/]
  },
  LAYERDIR_RE: {
    validFiles: [/^.*\/conf\/layer.conf$/]
  },
  LAYERVERSION: {
    suffixType: 'layer'
  },
  PREFERRED_PROVIDER: {
    suffixType: 'providedItem'
  }
}

const variablesFolder = 'doc/bitbake-user-manual/bitbake-user-manual-ref-variables.rst'
const variablesRegexForDoc = /^ {3}:term:`(?<name>[A-Z_]*?)`\n(?<definition>.*?)(?=^ {3}:term:|$(?!\n))/gsm

const yoctoTaskFilePath = path.join(__dirname, '../src/yocto-docs/tasks.rst')
const yoctoTaskPattern = /(?<=``)((?<name>do_.*)``\n-*\n\n(?<description>(.*\n)*?))\n(?=(\.\. _ref)|((.*)\n(=+)))/g
export class BitBakeDocScanner {
  private _variablesInfos: Record<string, VariableInfos> = {}
  private _variablesRegex = /(?!)/g // Initialize with dummy regex that won't match anything so we don't have to check for undefined
  private _yoctoTasks: CompletionItem[] = []

  get variablesInfos (): Record<string, VariableInfos> {
    return this._variablesInfos
  }

  get variablesRegex (): RegExp {
    return this._variablesRegex
  }

  get yoctoTasks (): CompletionItem[] {
    return this._yoctoTasks
  }

  parse (pathToBitbakeFolder: string): void {
    let file = ''
    const docPath = path.join(pathToBitbakeFolder, variablesFolder)
    try {
      file = fs.readFileSync(docPath, 'utf8')
    } catch {
      logger.warn(`BitBake doc file not found at ${docPath}`)
    }
    for (const match of file.matchAll(variablesRegexForDoc)) {
      const name = match.groups?.name
      // Naive silly inneficient incomplete conversion to markdown
      const definition = match.groups?.definition
        .replace(/^ {3}/gm, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
      if (name === undefined || definition === undefined) {
        return
      }
      this._variablesInfos[name] = {
        name,
        definition,
        ...variableInfosOverrides[name]
      }
    }
    const variablesNames = Object.keys(this._variablesInfos)
    // Sort from longuest to shortest in order to make the regex greedy
    // Otherwise it would match B before BB_PRESERVE_ENV
    variablesNames.sort((a, b) => b.length - a.length)
    const variablesRegExpString = `(${variablesNames.join('|')})`
    this._variablesRegex = new RegExp(variablesRegExpString, 'gi')
  }

  public parseYoctoTaskFile (): void {
    let file = ''
    try {
      file = fs.readFileSync(yoctoTaskFilePath, 'utf8')
    } catch {
      logger.warn(`Failed to read Yocto task file at ${yoctoTaskFilePath}`)
    }

    const tasks: CompletionItem[] = []
    for (const yoctoTaskMatch of file.matchAll(yoctoTaskPattern)) {
      const taskName = yoctoTaskMatch.groups?.name
      const taskDescription = yoctoTaskMatch.groups?.description
        .replace(/\\n(?=")/g, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
        .replace(/`\$\{`[\\]+\s(.*)[\\]+\s`\}`/g, (_match, p1) => p1)
        .replace(/^\n(\s{5,})/gm, '\n\t') // when 5 or more spaces are present as indentation, the texts following are likely code. Replace the indentation with one tab to trigger highlighting in this documentation

      if (taskName !== undefined) {
        tasks.push({
          label: taskName,
          documentation: taskDescription
        })
      }
    }

    tasks.forEach((task) => {
      task.insertText = [
        `${task.label}(){`,
        /* eslint-disable no-template-curly-in-string */
        '\t${1:# Your code here}',
        '}'
      ].join('\n')
    })

    this._yoctoTasks = tasks
  }
}

export const bitBakeDocScanner = new BitBakeDocScanner()
