/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { logger } from './lib/src/utils/OutputLogger'

/**
 *  The data scanned from documents
 */
export interface DocInfo {
  name: string
  definition: string
  referenceUrl?: string
  docSource?: string // Either Bitbake or Yocto
  insertText?: string
}
export interface VariableInfo extends DocInfo {
  validFiles?: RegExp[] // Files on which the variable is defined. If undefined, the variable is defined in all files.
  suffixType?: SuffixType
}

type SuffixType = 'layer' | 'providedItem' | undefined
type VariableInfosOverride = Partial<VariableInfo>
export type DocInfoType = DocInfo[] | VariableInfo[]
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

function normalizeRstDefinition (definition: string): string {
  return definition
    .replace(/^ {3}/gm, '')
    // References with an explicit target (e.g. :ref:`inherit <ref-...>`) only display their text
    .replace(/:(?:term|ref):`([^`<]*?)\s*<[^>]*>`/g, (_match, text: string) => `\`${text.replace(/\s+/g, ' ')}\``)
    .replace(/:term:|:ref:/g, '')
    .replace(/\.\. (note|important|tip)::/g, (_match, p1) => { return `**${p1}**` })
    .replace(/::/g, ':')
    .replace(/``/g, '`')
    .replace(/^\n(\s{5,})/gm, ' ')
    .replace(/^(\s{5,})/gm, ' ')
}

export class BitBakeDocScanner {
  private _bitbakeVariableInfo: VariableInfo[] = []
  private _yoctoVariableInfo: VariableInfo[] = []
  private _variableFlagInfo: DocInfo[] = []
  private _yoctoTaskInfo: DocInfo[] = []
  private _pythonDatastoreFunction: string[] = []
  private readonly _docPath: string = path.join(__dirname, '../resources/docs')
  private _metadataInfo: DocInfo[] = []

  get bitbakeVariableInfo (): VariableInfo[] {
    return this._bitbakeVariableInfo
  }

  get yoctoVariableInfo (): VariableInfo[] {
    return this._yoctoVariableInfo
  }

  get variableFlagInfo (): DocInfo[] {
    return this._variableFlagInfo
  }

  get yoctoTaskInfo (): DocInfo[] {
    return this._yoctoTaskInfo
  }

  get metadataInfo (): DocInfo[] {
    return this._metadataInfo
  }

  get pythonDatastoreFunction (): string[] {
    return this._pythonDatastoreFunction
  }

  public clearScannedDocs (): void {
    this._bitbakeVariableInfo = []
    this._yoctoVariableInfo = []
    this._variableFlagInfo = []
    this._yoctoTaskInfo = []
    this._pythonDatastoreFunction = []
    this._metadataInfo = []
  }

  public parseDocs (): void {
    this.parseVariableFlagFile()
    this.parseBitbakeVariablesFile()
    this.parseYoctoVariablesFile()
    this.parseYoctoTaskFile()
    this.parsePythonDatastoreFunction()
    this.parseBitbakeMetadataFile()
  }

  // TODO: Generalize these parse functions. They all read a file, match some content and store it.
  public parseBitbakeVariablesFile (): void {
    const variablesFilePath = path.join(this._docPath, 'bitbake-user-manual-ref-variables.rst')
    const variablesRegexForDoc = /^ {3}:term:`(?<name>[A-Z_]*?)`\n(?<definition>.*?)(?=^ {3}:term:|$(?!\n))/gsm
    let file = ''
    try {
      file = fs.readFileSync(variablesFilePath, 'utf8')
    } catch {
      logger.error(`Failed to read Bitbake variables at ${variablesFilePath}`)
    }
    const bitbakeVariableInfo: VariableInfo[] = []
    for (const match of file.matchAll(variablesRegexForDoc)) {
      const name = match.groups?.name
      const definition = match.groups?.definition
      if (name === undefined || definition === undefined) {
        return
      }
      bitbakeVariableInfo.push({
        name,
        definition: normalizeRstDefinition(definition),
        ...variableInfosOverrides[name],
        referenceUrl: `https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-ref-variables.html#term-${name}`,
        docSource: 'Bitbake'
      })
    }

    this._bitbakeVariableInfo = bitbakeVariableInfo
  }

  public parseYoctoVariablesFile (): void {
    const filePath = path.join(this._docPath, 'variables.rst')
    const variableRegex = /^ {3}:term:`(?<name>[A-Z_]*?)`\n(?<definition>.*?)(?=^ {3}:term:|$(?!\n))/gsm
    let file = ''
    try {
      file = fs.readFileSync(filePath, 'utf8')
    } catch {
      logger.error(`Failed to read Yocto variables at ${filePath}`)
    }

    const yoctoVariableInfo: VariableInfo[] = []
    for (const match of file.matchAll(variableRegex)) {
      const name = match.groups?.name
      const definition = match.groups?.definition
      if (name === undefined || definition === undefined) {
        return
      }
      yoctoVariableInfo.push({
        name,
        definition: normalizeRstDefinition(definition),
        referenceUrl: `https://docs.yoctoproject.org/ref-manual/variables.html#term-${name}`,
        docSource: 'Yocto'
      })
    }

    this._yoctoVariableInfo = yoctoVariableInfo
  }

  public parseYoctoTaskFile (): void {
    const yoctoTaskFilePath = path.join(this._docPath, 'tasks.rst')
    const yoctoTaskPattern = /(?<=``)((?<name>do_.*)``\n-*\n\n(?<description>(.*\n)*?))\n(?=(\.\. _ref)|((.*)\n(=+)))/g

    let file = ''
    try {
      file = fs.readFileSync(yoctoTaskFilePath, 'utf8')
    } catch {
      logger.warn(`Failed to read Yocto task file at ${yoctoTaskFilePath}`)
    }

    const yoctoTaskInfo: DocInfo[] = []
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
        yoctoTaskInfo.push({
          name: taskName,
          definition: taskDescription ?? '',
          insertText: [
            `${taskName}(){`,
            '\t${1:# Your code here}',
            '}'
          ].join('\n'),
          referenceUrl: `https://docs.yoctoproject.org/singleindex.html#${taskName.replace(/_/g, '-')}`
        })
      }
    }
    this._yoctoTaskInfo = yoctoTaskInfo
  }

  public parseVariableFlagFile (): void {
    const variableFlagFilePath = path.join(this._docPath, 'bitbake-user-manual-metadata.rst')
    const variableFlagSectionRegex = /(?<=Variable Flags\n=*\n\n)(?<variable_flag_section>.*\n)*(?<event_section_title>Events\n=*)/g
    const variableFlagRegex = /(?<=-\s*``\[)(?<name>.*)(?:\]``:)(?<description>(.*\n)*?)(?=\n-\s*``|\nEvents)/g
    let file = ''
    try {
      file = fs.readFileSync(variableFlagFilePath, 'utf8')
    } catch {
      logger.error(`Failed to read file at ${variableFlagFilePath}`)
    }

    const variableFlagSection = file.match(variableFlagSectionRegex)
    if (variableFlagSection === null) {
      logger.warn(`No variable flag section found at ${variableFlagFilePath}. Is the regex correct?`)
      return
    }

    const variableFlagInfo: DocInfo[] = []
    for (const match of variableFlagSection[0].matchAll(variableFlagRegex)) {
      const name = match.groups?.name
      const description = match.groups?.description
        .replace(/:term:|:ref:/g, '')
        .replace(/::/g, ':')
        .replace(/``\[/g, '`')
        .replace(/\]``/g, '`')
        .replace(/\.\.\s/g, '')
        .replace(/-\s\s/g, '')
        .replace(/^\n(\s{2,})/gm, '')
      if (name === undefined || description === undefined) {
        return
      }

      if (name !== undefined) {
        variableFlagInfo.push({
          name,
          definition: description,
          referenceUrl: 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#variable-flags'
        })
      }
    }
    this._variableFlagInfo = variableFlagInfo
  }

  public parsePythonDatastoreFunction (): void {
    const filePath = path.join(this._docPath, 'bitbake-user-manual-metadata.rst')
    const pattern = /^ {3}\* - ``d\.(?<name>.*)\("X"(.*)\)``/gm
    let file = ''
    try {
      file = fs.readFileSync(filePath, 'utf8')
    } catch {
      logger.warn(`Failed to read file at ${filePath}`)
    }
    const pythonDatastoreFunction: string[] = []
    for (const match of file.matchAll(pattern)) {
      const name = match.groups?.name
      if (name === undefined) {
        return
      }
      pythonDatastoreFunction.push(name)
    }
    this._pythonDatastoreFunction = pythonDatastoreFunction
  }

  public parseBitbakeMetadataFile (): void {
    const filePath = path.join(this._docPath, 'bitbake-user-manual-metadata.rst')
    let file = ''
    try {
      file = fs.readFileSync(filePath, 'utf8')
    } catch {
      logger.warn(`Failed to read file at ${filePath}`)
    }

    const sectionTitleToDocNames: Record<string, string[]> = {
      'Basic Variable Setting': ['='],
      'Setting a default value (?=)': ['?='],
      'Setting a weak default value (??=)': ['??='],
      'Immediate variable expansion (:=)': [':='],
      'Appending (+=) and prepending (=+) With Spaces': ['+=', '=+'],
      'Appending (.=) and Prepending (=.) Without Spaces': ['.=', '=.'],
      'Appending and Prepending (Override Style Syntax)': ['append', 'prepend'],
      'Removal (Override Style Syntax)': ['remove'],
      'Inline Python Variable Expansion': ['${@'],
      'BitBake-Style Python Functions': ['python'],
      'Python Functions': ['def'],
      'Anonymous Python Functions': ['__anonymous'],
      'Exporting Variables to the Environment': ['export'],
      '``inherit`` Directive': ['inherit'],
      '``include`` Directive': ['include'],
      '``require`` Directive': ['require']
    }

    // Override the auto-derived URL for sections whose RST anchor differs from their title
    const overriddenUrls: Partial<Record<string, string>> = {
      'Appending (+=) and prepending (=+) With Spaces': 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#appending-and-prepending',
      'Removal (Override Style Syntax)': 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#removing-override-style-syntax'
    }

    // Find all section headers underlined with any of the adornments used by the document
    const headerRegex = /^[^\n]+\n([-=~])\1{2,}\n\n/gm
    const headerMatches = Array.from(file.matchAll(headerRegex))

    const metadataInfo: DocInfo[] = []
    for (const [i, match] of headerMatches.entries()) {
      const title = match[0].split('\n')[0]
      if (!(title in sectionTitleToDocNames)) continue
      const names = sectionTitleToDocNames[title]

      // Extract content from this header to the next
      const contentStart = match.index + match[0].length
      const contentEnd = i + 1 < headerMatches.length ? headerMatches[i + 1].index : file.length
      const rawContent = file.slice(contentStart, contentEnd)

      const definition = normalizeRstDefinition(rawContent)

      const anchor = title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/ +/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
      const referenceUrl = overriddenUrls[title] ?? `https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html#${anchor}`
      for (const name of names) {
        metadataInfo.push({
          name,
          definition,
          referenceUrl,
          docSource: 'Bitbake'
        })
      }
    }
    this._metadataInfo = metadataInfo
  }
}

export const bitBakeDocScanner = new BitBakeDocScanner()
