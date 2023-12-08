/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/analyser.ts
 */

import {
  type TextDocumentPositionParams,
  type Diagnostic,
  type SymbolInformation,
  type Range,
  SymbolKind,
  type Position
} from 'vscode-languageserver'
import type Parser from 'web-tree-sitter'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedRegions, getEmbeddedRegionsFromNode, getGlobalDeclarations, type GlobalDeclarations } from './declarations'
import { debounce } from '../utils/async'
import { type Tree } from 'web-tree-sitter'
import * as TreeSitterUtils from './utils'
import { type DirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { logger } from '../lib/src/utils/OutputLogger'
import fs from 'fs'
import path from 'path'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
const DEBOUNCE_TIME_MS = 500

interface AnalyzedDocument {
  document: TextDocument
  globalDeclarations: GlobalDeclarations
  embeddedRegions: EmbeddedRegions
  tree: Parser.Tree
  extraSymbols?: GlobalDeclarations[] // symbols from the include files
}

export default class Analyzer {
  private parser?: Parser
  private uriToAnalyzedDocument: Record<string, AnalyzedDocument | undefined> = {}
  private debouncedExecuteAnalyzation?: ReturnType<typeof debounce>

  public getDocumentTexts (uri: string): string[] | undefined {
    return this.uriToAnalyzedDocument[uri]?.document.getText().split(/\r?\n/g)
  }

  public getAnalyzedDocument (uri: string): AnalyzedDocument | undefined {
    return this.uriToAnalyzedDocument[uri]
  }

  public getExtraSymbolsForUri (uri: string): GlobalDeclarations[] {
    return this.uriToAnalyzedDocument[uri]?.extraSymbols ?? []
  }

  public initialize (parser: Parser): void {
    this.parser = parser
  }

  public async analyze ({
    document,
    uri
  }: {
    document: TextDocument
    uri: string
  }): Promise<Diagnostic[]> {
    if (this.parser === undefined) {
      logger.debug('[Analyzer] The analyzer is not initialized with a parser')
      return await Promise.resolve([])
    }

    const fileContent = document.getText()

    const tree = this.parser.parse(fileContent)
    const globalDeclarations = getGlobalDeclarations({ tree, uri })
    const embeddedRegions = getEmbeddedRegionsFromNode(tree, uri)
    /* eslint-disable-next-line prefer-const */
    let extraSymbols: GlobalDeclarations[] = []
    this.sourceIncludeFiles(uri, extraSymbols, { td: document, tree })

    this.uriToAnalyzedDocument[uri] = {
      document,
      globalDeclarations,
      embeddedRegions,
      tree,
      extraSymbols
    }

    let debouncedExecuteAnalyzation = this.debouncedExecuteAnalyzation
    if (debouncedExecuteAnalyzation === undefined) {
      debouncedExecuteAnalyzation = debounce(this.executeAnalyzation.bind(this), DEBOUNCE_TIME_MS)
      this.debouncedExecuteAnalyzation = debouncedExecuteAnalyzation
    }

    return await debouncedExecuteAnalyzation(document, uri, tree)
  }

  private executeAnalyzation (document: TextDocument, uri: string, tree: Tree): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    // It was used to provide diagnostics from tree-sitter, but it is not yet reliable.

    return diagnostics
  }

  public getGlobalDeclarationSymbols (uri: string): SymbolInformation[] {
    let symbols: SymbolInformation[] = []
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { globalDeclarations } = analyzedDocument
      Object.values(globalDeclarations).forEach((symbolArray) => {
        symbols = symbols.concat(symbolArray)
      })
      return symbols
    }
    return []
  }

  public getBashRegions (uri: string): SymbolInformation[] {
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { embeddedRegions } = analyzedDocument
      return embeddedRegions.bash
    }
    return []
  }

  public getPythonRegions (uri: string): SymbolInformation[] {
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { embeddedRegions } = analyzedDocument
      return embeddedRegions.python
    }
    return []
  }

  public getParsedTreeForUri (uri: string): Tree | undefined {
    return this.uriToAnalyzedDocument[uri]?.tree
  }

  /**
   * Find the full word at the given point.
   */
  public wordAtPoint (uri: string, line: number, column: number): string | null {
    const node = this.nodeAtPoint(uri, line, column)

    if (node === null || node.childCount > 0 || node.text.trim() === '') {
      return null
    }

    return node.text.trim()
  }

  public wordAtPointFromTextPosition (
    params: TextDocumentPositionParams
  ): string | null {
    return this.wordAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
  }

  public hasParser (): boolean {
    return this.parser !== undefined
  }

  public resetAnalyzedDocuments (): void {
    this.uriToAnalyzedDocument = {}
  }

  /**
   * Get the directive keyword when the statement is either include, require or inherit directive by looking up the tree nodes
   */
  public getDirectiveStatementKeywordByNodeType (
    params: TextDocumentPositionParams
  ): DirectiveStatementKeyword | undefined {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )

    const type = n?.type
    const parentType = n?.parent?.type
    switch (type) {
      case 'inherit_path':
        if (parentType === 'inherit_directive') {
          return 'inherit'
        }
        return undefined
      case 'include_path':
        if (parentType === 'require_directive') {
          return 'require'
        } else if (parentType === 'include_directive') {
          return 'include'
        }
        return undefined
      default:
        return undefined
    }
  }

  public getDirectivePathForPosition (
    params: TextDocumentPositionParams
  ): string | undefined {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )

    if (n?.type === 'inherit_path' || n?.type === 'include_path') {
      return n.text
    }

    return undefined
  }

  public isIdentifier (
    params: TextDocumentPositionParams
  ): boolean {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
    return n?.type === 'identifier'
  }

  public isFunctionIdentifier (
    params: TextDocumentPositionParams
  ): boolean {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
    if (n?.type === 'identifier') {
      return n?.parent?.type === 'function_definition' || n?.parent?.type === 'anonymous_python_function'
    } else if (n?.type === 'python_identifier') {
      return n?.parent?.type === 'python_function_definition'
    }
    return false
  }

  public isStringContent (
    uri: string,
    line: number,
    column: number
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    if (n?.type === 'string_content') {
      return true
    }
    return false
  }

  public isOverride (
    uri: string,
    line: number,
    column: number
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    // Current tree-sitter (as of @1.0.1) only treats 'append', 'prepend' and 'remove' as a node with "override" type. Other words following ":" will yield a node with "identifier" type whose parent node is of type "override"
    // However, in some cases, its parent node is not of type override but its grandparent is.
    // Some ugly checks were added (as of tree-sitter @1.1.0) due to: https://github.com/amaanq/tree-sitter-bitbake/issues/9
    // See if future tree-sitter has a nicer way to handle this.
    return n?.type === 'override' ||
    n?.parent?.type === 'override' ||
    n?.parent?.parent?.type === 'override' ||
    (n?.type === ':' && n?.parent?.firstNamedChild?.type === 'identifier') || // when having something like "MYVAR:append:" at the last line of the document
    (n?.type === ':' && n?.parent?.type === 'ERROR' && n?.parent?.previousSibling?.type === 'override') // when having MYVAR:append: = '123' and the second or later colon is typed
  }

  /**
   * Check if the variable expansion syntax is being typed. Only for expressions that reference variables. \
   * Example:
   * ```
   * NAME = "foo"
   * DESCRIPTION = "Name: ${NAME}"
   * ```
   */
  public isVariableExpansion (
    uri: string,
    line: number,
    column: number
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    // since @1.0.2 the tree-sitter gives empty variable expansion (e.g. `VAR = "${}""`) the type "variable_expansion". But the node type returned from nodeAtPoint() at the position between "${" and "}" is of type "${" which is the result from descendantForPosition() (It returns the smallest node containing the given postion). In this case, the parent node has type "variable_expansion". Hence, we have n?.parent?.type === 'variable_expansion' below. The second expression after the || will be true if it encounters non-empty variable expansion syntax. e.g. `VAR = "${A}". Note that inline python with ${@} has type "inline_python"
    return n?.parent?.type === 'variable_expansion' || (n?.type === 'identifier' && n?.parent?.type === 'variable_expansion')
  }

  /**
   * Check if the node is the identifier in a variable assignment syntax (identifiers are only on the left hand side)
   */
  public isIdentifierOfVariableAssignment (
    params: TextDocumentPositionParams
  ): boolean {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )
    return n?.type === 'identifier' && n?.parent?.type === 'variable_assignment'
  }

  public isVariableFlag (
    params: TextDocumentPositionParams
  ): boolean {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )

    return n?.type === 'flag' && n?.parent?.type === 'variable_flag'
  }

  public rangeForWordAtPoint (
    params: TextDocumentPositionParams
  ): Range | undefined {
    const n = this.nodeAtPoint(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    )

    if (n === null || n.childCount > 0 || n.text.trim() === '') {
      return undefined
    }

    return TreeSitterUtils.range(n)
  }

  /**
   * Check if the current line starts with any directive statement keyword. The keyword is one of `include`, `inherit` and `require`
   *
   * Tree-sitter functionalities are not used here since they (as of @1.0.1) can't reliably treat a line as directive statement if the keyword presents but nothing follows.
   */
  public getDirectiveStatementKeywordByLine (textDocumentPositionParams: TextDocumentPositionParams): DirectiveStatementKeyword | undefined {
    const { textDocument, position } = textDocumentPositionParams
    const documentAsText = this.getDocumentTexts(textDocument.uri)
    if (documentAsText === undefined) {
      return undefined
    }
    const currentLine = documentAsText[position.line]
    const lineTillCurrentPosition = currentLine.substring(0, position.character)
    const words = lineTillCurrentPosition.split(' ')

    if (words[0] === 'include' || words[0] === 'inherit' || words[0] === 'require') {
      return words[0]
    }

    return undefined
  }

  /**
   * Get the keyword based on the node type in the tree
   */
  public getKeywordForPosition (
    uri: string,
    line: number,
    column: number
  ): string | undefined {
    const n = this.nodeAtPoint(uri, line, column)

    const parentNodeType = n?.parent?.type
    if (parentNodeType !== undefined) {
      switch (parentNodeType) {
        case 'inherit_directive':
          return 'inherit'
        case 'include_directive':
          return 'include'
        case 'require_directive':
          return 'require'
        // other keywords...
        default:
          return undefined
      }
    }
    return undefined
  }

  /**
   * Find the node at the given point.
   */
  private nodeAtPoint (
    uri: string,
    line: number,
    column: number
  ): Parser.SyntaxNode | null {
    const tree = this.uriToAnalyzedDocument[uri]?.tree

    if (tree === undefined) {
      return null
    }

    if (tree.rootNode === null) {
      // Check for lacking rootNode (due to failed parse?)
      return null
    }

    return tree.rootNode.descendantForPosition({ row: line, column })
  }

  /**
   *
   * @param uri
   * @param document Main purpose of this param is to avoid re-reading the file from disk and re-parsing the tree when the file is opened for the first time since the same process will happen in the analyze() before calling this function.
   */
  public sourceIncludeFiles (uri: string, extraSymbols: GlobalDeclarations[], document?: { td: TextDocument, tree: Parser.Tree }): void {
    if (this.parser === undefined) {
      logger.error('[Analyzer] The analyzer is not initialized with a parser')
      return
    }
    const filePath = uri.replace('file://', '')
    logger.debug(`[Analyzer] Sourcing file: ${filePath}`)
    try {
      let textDocument: TextDocument
      let parsedTree: Parser.Tree
      if (document !== undefined) {
        textDocument = document.td
        parsedTree = document.tree
      } else {
        const analyzedDocument = this.uriToAnalyzedDocument[uri]
        let globalDeclarations: GlobalDeclarations
        if (analyzedDocument === undefined) {
          textDocument = TextDocument.create(
            uri,
            'bitbake',
            0,
            fs.readFileSync(uri.replace('file://', ''), 'utf8')
          )
          parsedTree = this.parser.parse(textDocument.getText())
          // Store it in analyzedDocument just like what analyze() does to avoid re-reading the file from disk and re-parsing the tree when editing on the same file
          globalDeclarations = getGlobalDeclarations({ tree: parsedTree, uri })
          this.uriToAnalyzedDocument[uri] = {
            document: textDocument,
            globalDeclarations,
            embeddedRegions: getEmbeddedRegionsFromNode(parsedTree, uri), // TODO: Avoid doing this operation as it is not needed during the sourcing process
            tree: parsedTree
          }
        } else {
          logger.debug('[Analyzer] File already analyzed')
          textDocument = analyzedDocument.document
          parsedTree = analyzedDocument.tree
          globalDeclarations = analyzedDocument.globalDeclarations
        }
        extraSymbols.push(globalDeclarations)
      }

      // Recursively scan for files in the directive statements `inherit`, `include` and `require` and pass the same reference of extraSymbols to each recursive call
      const fileUris = this.getDirectiveFileUris(parsedTree)
      for (const fileUri of fileUris) {
        this.sourceIncludeFiles(fileUri, extraSymbols, undefined)
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`[Analyzer] Error reading file at ${filePath}: ${error.message}`)
      } else if (typeof error === 'string') {
        logger.error(`[Analyzer] Error reading file at ${filePath}: ${error}`)
      } else {
        logger.error(`[Analyzer] An unknown error occurred while reading the file at ${filePath}`)
      }
    }
  }

  public getDirectiveFileUris (parsedTree: Parser.Tree): string[] {
    const fileUris: string[] = []
    parsedTree.rootNode.children.forEach((childNode) => {
      if (childNode.type === 'inherit_directive') {
        childNode.children.forEach((n) => {
          if (n.type === 'inherit_path') {
            logger.debug(`[Analyzer] Found inherit path: ${n.text}`)
            const bbclasses = bitBakeProjectScannerClient.bitbakeScanResult._classes.filter((bbclass) => {
              return bbclass.name === n.text
            })
            for (const bbclass of bbclasses) {
              if (bbclass.path !== undefined) {
                const uri: string = 'file://' + bbclass.path.dir + '/' + bbclass.path.base
                fileUris.push(encodeURI(uri))
              }
            }
          }
        })
      } else if (childNode.type === 'require_directive' || childNode.type === 'include_directive') {
        if (childNode.firstNamedChild !== null && childNode.firstNamedChild.type === 'include_path') {
          logger.debug(`[Analyzer] Found include path: ${childNode.firstNamedChild.text}`)
          const includeFile = path.parse(childNode.firstNamedChild.text)
          let includes = bitBakeProjectScannerClient.bitbakeScanResult._includes.filter((inc) => {
            return inc.name === includeFile.name
          })

          if (includes.length === 0) {
            includes = bitBakeProjectScannerClient.bitbakeScanResult._recipes.filter((recipe) => {
              return recipe.name === includeFile.name
            })
          }

          for (const include of includes) {
            if (include.path !== undefined) {
              const uri: string = 'file://' + include.path.dir + '/' + include.path.base
              fileUris.push(encodeURI(uri))
            }
          }
        }
      }
    })
    return fileUris
  }

  /**
   * Extract symbols from the string content of the tree
   */
  public getSymbolsInStringContent (uri: string, line: number, character: number): SymbolInformation[] {
    const allSymbolsAtPosition: SymbolInformation[] = []
    const wholeWordRegex = /(?<![-.:])\b(\w+)\b(?![-.:])/g
    const n = this.nodeAtPoint(uri, line, character)
    if (n?.type === 'string_content') {
      this.processSymbolsInStringContent(n, wholeWordRegex, (start, end, match) => {
        if (this.positionIsInRange(line, character, { start, end })) {
          const foundRecipe = bitBakeProjectScannerClient.bitbakeScanResult._recipes.find((recipe) => {
            return recipe.name === match[0]
          })
          if (foundRecipe !== undefined) {
            if (foundRecipe?.path !== undefined) {
              allSymbolsAtPosition.push({
                name: match[0],
                kind: SymbolKind.Variable,
                location: {
                  range: {
                    start,
                    end
                  },
                  uri: 'file://' + foundRecipe.path.dir + '/' + foundRecipe.path.base
                }
              })
            }
            if (foundRecipe?.appends !== undefined && foundRecipe.appends.length > 0) {
              foundRecipe.appends.forEach((append) => {
                allSymbolsAtPosition.push({
                  name: append.name,
                  kind: SymbolKind.Variable,
                  location: {
                    range: {
                      start,
                      end
                    },
                    uri: 'file://' + append.dir + '/' + append.base
                  }
                })
              })
            }
          }
        }
      })
    }

    return allSymbolsAtPosition
  }

  public getLinksInStringContent (uri: string): Array<{ value: string, range: Range }> {
    const links: Array<{ value: string, range: Range }> = []
    const uriRegex = /(file:\/\/)(?<uri>.*)\b/g
    const parsedTree = this.getAnalyzedDocument(uri)?.tree
    if (parsedTree === undefined) {
      return []
    }
    TreeSitterUtils.forEach(parsedTree.rootNode, (n) => {
      if (n?.type === 'string_content') {
        this.processSymbolsInStringContent(n, uriRegex, (start, end, match) => {
          const matchedUri = match.groups?.uri
          if (matchedUri !== undefined) {
            links.push({
              value: matchedUri,
              range: {
                start,
                end
              }
            })
          }
          return []
        })
      }
      return true
    })

    return links
  }

  public positionIsInRange (line: number, character: number, range: Range): boolean {
    return line === range.start.line && character >= range.start.character && character <= range.end.character
  }

  private calculateSymbolPositionInStringContent (n: Parser.SyntaxNode, index: number, match: RegExpMatchArray): Range {
    const start = {
      line: n.startPosition.row + index,
      character: match.index !== undefined ? match.index + n.startPosition.column : 0
    }
    const end = {
      line: n.startPosition.row + index,
      character: match.index !== undefined ? match.index + n.startPosition.column + match[0].length : 0
    }
    if (index > 0) {
      start.character = match.index ?? 0
      end.character = (match.index ?? 0) + match[0].length
    }
    return {
      start,
      end
    }
  }

  /**
   *
   * @param n The syntax node of type `string_content`
   * @param regex The regex to match the symbols
   * @param func The custom function to process the matched symbols
   */
  private processSymbolsInStringContent (n: Parser.SyntaxNode, regex: RegExp, func: (start: Position, end: Position, match: RegExpMatchArray) => void): void {
    const splittedStringContent = n.text.split(/\n/g)
    for (let i = 0; i < splittedStringContent.length; i++) {
      const lineText = splittedStringContent[i]
      for (const match of lineText.matchAll(regex)) {
        if (match !== undefined) {
          const { start, end } = this.calculateSymbolPositionInStringContent(n, i, match)
          func(start, end, match)
        }
      }
    }
  }
}

export const analyzer: Analyzer = new Analyzer()
