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

const KEYWORDS = [
  {
    name: 'require',
    definition: 'BitBake understands the require directive. This directive behaves just like the include directive with the exception that BitBake raises a parsing error if the file to be included cannot be found. Thus, any file you require is inserted into the file that is being parsed at the location of the directive. \n\nThe require directive, like the include directive previously described, is a more generic method of including functionality as compared to the inherit directive, which is restricted to class (i.e. .bbclass) files. The require directive is applicable for any other kind of shared or encapsulated functionality or configuration that does not suit a .bbclass file. \n\nSimilar to how BitBake handles include, if the path specified on the require line is a relative path, BitBake locates the first file it can find within BBPATH. \n\nAs an example, suppose you have two versions of a recipe (e.g. foo_1.2.2.bb and foo_2.0.0.bb) where each version contains some identical functionality that could be shared. You could create an include file named foo.inc that contains the common definitions needed to build “foo”. You need to be sure foo.inc is located in the same directory as your two recipe files as well. Once these conditions are set up, you can share the functionality using a require directive from within each recipe: \n ```require foo.inc```',
    referenceUrl: 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html?highlight=require#require-directive',
    docSource: 'Bitbake'
  },
  {
    name: 'include',
    definition: 'BitBake understands the include directive. This directive causes BitBake to parse whatever file you specify, and to insert that file at that location. The directive is much like its equivalent in Make except that if the path specified on the include line is a relative path, BitBake locates the first file it can find within BBPATH. \n\nThe include directive is a more generic method of including functionality as compared to the inherit directive, which is restricted to class (i.e. .bbclass) files. The include directive is applicable for any other kind of shared or encapsulated functionality or configuration that does not suit a .bbclass file. \n\nAs an example, suppose you needed a recipe to include some self-test definitions: \n ```include test_defs.inc```',
    referenceUrl: 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html?highlight=require#include-directive',
    docSource: 'Bitbake'
  },
  {
    name: 'inherit',
    definition: 'When writing a recipe or class file, you can use the inherit directive to inherit the functionality of a class (.bbclass). BitBake only supports this directive when used within recipe and class files (i.e. .bb and .bbclass).\n\nThe inherit directive is a rudimentary means of specifying functionality contained in class files that your recipes require. For example, you can easily abstract out the tasks involved in building a package that uses Autoconf and Automake and put those tasks into a class file and then have your recipe inherit that class file. \n\nAs an example, your recipes could use the following directive to inherit an autotools.bbclass file. The class file would contain common functionality for using Autotools that could be shared across recipes: \n```inherit autotools```',
    referenceUrl: 'https://docs.yoctoproject.org/bitbake/bitbake-user-manual/bitbake-user-manual-metadata.html?highlight=require#inherit-directive',
    docSource: 'Bitbake'
  }
]

export class BitBakeDocScanner {
  private _bitbakeVariableInfo: VariableInfo[] = []
  private _yoctoVariableInfo: VariableInfo[] = []
  private _variableFlagInfo: DocInfo[] = []
  private _yoctoTaskInfo: DocInfo[] = []
  private _pythonDatastoreFunction: string[] = []
  private readonly _docPath: string = path.join(__dirname, '../resources/docs')
  private readonly _keywordInfo: DocInfo[] = KEYWORDS

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

  get keywordInfo (): DocInfo[] {
    return this._keywordInfo
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
  }

  public parseDocs (): void {
    this.parseVariableFlagFile()
    this.parseBitbakeVariablesFile()
    this.parseYoctoVariablesFile()
    this.parseYoctoTaskFile()
    this.parsePythonDatastoreFunction()
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
      // Naive silly inneficient incomplete conversion to markdown
      const definition = match.groups?.definition
        .replace(/^ {3}/gm, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important|tip)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
        .replace(/^\n(\s{5,})/gm, ' ')
        .replace(/^(\s{5,})/gm, ' ')
      if (name === undefined || definition === undefined) {
        return
      }
      bitbakeVariableInfo.push({
        name,
        definition,
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
      // Naive silly inneficient incomplete conversion to markdown
      const definition = match.groups?.definition
        .replace(/^ {3}/gm, '')
        .replace(/:term:|:ref:/g, '')
        .replace(/\.\. (note|important|tip)::/g, (_match, p1) => { return `**${p1}**` })
        .replace(/::/g, ':')
        .replace(/``/g, '`')
        .replace(/^\n(\s{5,})/gm, ' ')
        .replace(/^(\s{5,})/gm, ' ')
      if (name === undefined || definition === undefined) {
        return
      }
      yoctoVariableInfo.push({
        name,
        definition,
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
}

export const bitBakeDocScanner = new BitBakeDocScanner()
