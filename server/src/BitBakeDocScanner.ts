/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import logger from 'winston'

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

export class BitBakeDocScanner {
  private _variablesInfos: Record<string, VariableInfos> = {}
  private _variablesRegex = /(?!)/g // Initialize with dummy regex that won't match anything so we don't have to check for undefined

  get variablesInfos (): Record<string, VariableInfos> {
    return this._variablesInfos
  }

  get variablesRegex (): RegExp {
    return this._variablesRegex
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
}
