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
  SymbolInformation,
  Range,
  SymbolKind,
  Position,
  Location
} from 'vscode-languageserver'
import type Parser from 'web-tree-sitter'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { type BitbakeSymbolInformation, getGlobalDeclarations, type GlobalDeclarations, nodeToSymbolInformation } from './declarations'
import { type Tree } from 'web-tree-sitter'
import * as TreeSitterUtils from './utils'
import { DIRECTIVE_STATEMENT_KEYWORDS, type DirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { logger } from '../lib/src/utils/OutputLogger'
import fs from 'fs'
import path, { type ParsedPath } from 'path'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { type ElementInfo } from '../lib/src/types/BitbakeScanResult'
import { type RequestResult } from '../lib/src/types/requests'

export interface AnalyzedDocument {
  version: number // TextDocument is mutable and its version updates as the document updates
  document: TextDocument
  globalDeclarations: GlobalDeclarations
  variableExpansionSymbols: BitbakeSymbolInformation[]
  pythonDatastoreVariableSymbols: BitbakeSymbolInformation[]
  includeFileUris: string[]
  tree: Parser.Tree
}

interface LastScanResult {
  symbols: BitbakeSymbolInformation[]
  includeHistory: ParsedPath[]
}

export default class Analyzer {
  private bitBakeParser?: Parser
  private bashParser?: Parser
  private uriToAnalyzedDocument: Record<string, AnalyzedDocument | undefined> = {}
  private readonly uriToLastScanResult: Record<string, LastScanResult | undefined> = {} // Store the results of the last scan for each recipe
  private uriToRecipeLocalFiles: Record<string, RequestResult['getRecipeLocalFiles']> = {}

  public getDocumentTexts (uri: string): string[] | undefined {
    return this.uriToAnalyzedDocument[uri]?.document.getText().split(/\r?\n/g)
  }

  public getAnalyzedDocument (uri: string): AnalyzedDocument | undefined {
    return this.uriToAnalyzedDocument[uri]
  }

  public getLastScanResult (recipe: string): LastScanResult | undefined {
    return this.uriToLastScanResult[recipe]
  }

  public getRecipeLocalFiles (uri: string): RequestResult['getRecipeLocalFiles'] | undefined {
    return this.uriToRecipeLocalFiles[uri]
  }

  public setRecipeLocalFiles (uri: string, recipeLocalFiles: RequestResult['getRecipeLocalFiles']): void {
    this.uriToRecipeLocalFiles[uri] = recipeLocalFiles
  }

  public clearRecipeLocalFiles (): void {
    this.uriToRecipeLocalFiles = {}
  }

  public getIncludeUrisForUri (uri: string): string[] {
    return this.uriToAnalyzedDocument[uri]?.includeFileUris ?? []
  }

  public getVariableExpansionSymbols (uri: string): BitbakeSymbolInformation[] {
    return this.uriToAnalyzedDocument[uri]?.variableExpansionSymbols ?? []
  }

  public getPythonDatastoreVariableSymbols (uri: string): BitbakeSymbolInformation[] {
    return this.uriToAnalyzedDocument[uri]?.pythonDatastoreVariableSymbols ?? []
  }

  public getAllSymbols (uri: string): BitbakeSymbolInformation[] {
    return [
      ...this.getGlobalDeclarationSymbols(uri),
      ...this.getVariableExpansionSymbols(uri),
      ...this.getPythonDatastoreVariableSymbols(uri)
    ]
  }

  public removeLastScanResultForRecipe (recipe: string): void {
    this.uriToLastScanResult[recipe] = undefined
  }

  public initialize (bitBakeParser: Parser, bashParser: Parser): void {
    this.bitBakeParser = bitBakeParser
    this.bashParser = bashParser
  }

  public analyze ({
    document,
    uri
  }: {
    document: TextDocument
    uri: string
  }): Diagnostic[] {
    if (this.bitBakeParser === undefined) {
      logger.debug('[Analyzer] The analyzer is not initialized with a parser')
      return []
    }

    const fileContent = document.getText()

    const tree = this.bitBakeParser.parse(fileContent)
    const globalDeclarations = getGlobalDeclarations({ tree, uri })

    const { variableExpansionSymbols, pythonDatastoreVariableSymbols } = this.getSymbolsFromTree({ tree, uri })

    this.uriToAnalyzedDocument[uri] = {
      version: document.version,
      document,
      globalDeclarations,
      variableExpansionSymbols,
      pythonDatastoreVariableSymbols,
      includeFileUris: this.extractIncludeFileUris(uri, tree),
      tree
    }

    return this.executeAnalyzation(document, uri, tree)
  }

  private executeAnalyzation (document: TextDocument, uri: string, tree: Tree): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    // It was used to provide diagnostics from tree-sitter, but it is not yet reliable.

    return diagnostics
  }

  // TODO: Traverse the tree once to get all the symbols: globalDeclarations, variable expansion symbols, python datastore variables symbols
  public getSymbolsFromTree ({ tree, uri }: { tree: Tree, uri: string }): { variableExpansionSymbols: BitbakeSymbolInformation[], pythonDatastoreVariableSymbols: BitbakeSymbolInformation[] } {
    const variableExpansionSymbols: BitbakeSymbolInformation[] = []
    const pythonDatastoreVariableSymbols: BitbakeSymbolInformation[] = []
    TreeSitterUtils.forEach(tree.rootNode, (node) => {
      const isNonEmptyVariableExpansion = (node.type === 'identifier' && node.parent?.type === 'variable_expansion')
      const isPythonDatastoreVariable = this.isPythonDatastoreVariable(uri, node.startPosition.row, node.startPosition.column)

      const followChildren = !(isNonEmptyVariableExpansion || isPythonDatastoreVariable)

      if (isNonEmptyVariableExpansion) {
        const symbol = nodeToSymbolInformation({ node, uri, getFinalValue: false, isVariableExpansion: true })
        symbol !== null && variableExpansionSymbols.push(symbol)
      }

      if (isPythonDatastoreVariable) {
        const actualVariableNode = node?.parent
        if (actualVariableNode !== null) {
          const range = TreeSitterUtils.range(actualVariableNode)
          const symbol: BitbakeSymbolInformation = {
            ...SymbolInformation.create(
              // The node text includes the leading and trailing single quotes, so we need to remove them.
              // The range is adjusted for the same reason.
              actualVariableNode.text.replace(/'/g, ''),
              SymbolKind.Variable,
              Range.create(Position.create(range.start.line, range.start.character + 1), Position.create(range.end.line, range.end.character - 1)),
              uri
            ),
            commentsAbove: [],
            overrides: []
          }
          pythonDatastoreVariableSymbols.push(symbol)
        }
      }

      return followChildren
    })

    return { variableExpansionSymbols, pythonDatastoreVariableSymbols }
  }

  public getGlobalDeclarationSymbols (uri: string): BitbakeSymbolInformation[] {
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { globalDeclarations } = analyzedDocument
      return this.getAllSymbolsFromGlobalDeclarations(globalDeclarations)
    }
    return []
  }

  private getAllSymbolsFromGlobalDeclarations (globalDeclarations: GlobalDeclarations): BitbakeSymbolInformation[] {
    let symbols: BitbakeSymbolInformation[] = []
    Object.values(globalDeclarations).forEach((symbolArray) => {
      symbols = symbols.concat(symbolArray)
    })
    return symbols
  }

  public findExactSymbolAtPoint (uri: string, position: Position, wordAtPoint: string): BitbakeSymbolInformation | undefined {
    const allSymbols = this.getAllSymbols(uri)
    return allSymbols.find((symbol) => symbol.name === wordAtPoint && this.positionIsInRange(position.line, position.character, symbol.location.range))
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

  public hasParsers (): boolean {
    return this.bitBakeParser !== undefined && this.bashParser !== undefined
  }

  public resetAnalyzedDocuments (): void {
    this.uriToAnalyzedDocument = {}
  }

  /**
   * Get the directive keyword whether the expression is a directive statement by looking up the tree nodes
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
        if (parentType === 'inherit_defer_directive') {
          return 'inherit_defer'
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

  /**
   * Check if the current position is inside a string content of a variable assignment.
   * Pass an array of variable names to check if the string content is of any of the variable assignments.
   */
  public isStringContentOfVariableAssignment (
    uri: string,
    line: number,
    column: number,
    variableNames?: string[]
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    if (n?.type !== 'string_content') {
      return false
    }
    if (n?.parent?.parent?.parent?.type !== 'variable_assignment') {
      return false
    }
    if (variableNames !== undefined) {
      if (n.parent.parent.parent.firstNamedChild?.type === 'identifier') {
        const name = n.parent.parent.parent.firstNamedChild.text
        return variableNames.includes(name)
      }
      return false
    }
    return true
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

  // While the user is typing on a line right before a function, tree-sitter-bitbake wrongly assumes the identifier is part of the function.
  // See tree-sitter-bitbake issue: https://github.com/amaanq/tree-sitter-bitbake/issues/16
  // TODO: Remove this function when the issue is fixed
  public isBuggyIdentifier (
    uri: string,
    line: number,
    column: number
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    // The bug appears on identifiers, and also on the colon of overrides
    if (n?.type !== 'identifier' && n?.type !== ':') {
      return false
    }
    const currentLine = n.startPosition.row
    const parent = n.parent

    // The bug occurs when tree-sitter-bitbake mistakens the identifier as part of the name of a function
    // The name of a function is on the same line as a function_definition node
    if (parent?.type !== 'function_definition' && currentLine !== parent?.startPosition.row) {
      return false
    }

    const nextSibling = n.nextSibling
    // If the identifier is the name of a function, then the next sibling should be '(' or an override.
    // In any case, it should be on the same line as the identifier.
    // If it is not, then we have our buggy identifier.
    return nextSibling?.endPosition.row !== currentLine
  }

  public isInsideBashRegion (
    uri: string,
    line: number,
    column: number
  ): boolean {
    let n = this.nodeAtPoint(uri, line, column)
    if (this.isBuggyIdentifier(uri, line, column)) {
      return false
    }

    while (n !== null) {
      if (TreeSitterUtils.isShellDefinition(n)) {
        return true
      }
      n = n.parent
    }

    return false
  }

  public isInsidePythonRegion (
    uri: string,
    line: number,
    column: number
  ): boolean {
    let n = this.nodeAtPoint(uri, line, column)
    if (this.isBuggyIdentifier(uri, line, column)) {
      return false
    }

    while (n !== null) {
      if (TreeSitterUtils.isInlinePython(n) || TreeSitterUtils.isPythonDefinition(n)) {
        return true
      }
      n = n.parent
    }

    return false
  }

  public isPythonDatastoreVariable (
    uri: string,
    line: number,
    column: number,
    // Whether or not the opening quote should be considered as part of the variable
    // We want to be able to suggest completion items as the user open the quotes
    // However, when the user hover on the variable, the quotes are not part of the variable
    includeOpeningQuote: boolean = false
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    if (!this.isInsidePythonRegion(uri, line, column)) {
      return false
    }

    if (n?.type !== 'string_content' && (includeOpeningQuote ? n?.type !== 'string_start' : true)) {
      return false
    }

    // Example:
    // n.text: FOO
    // n.parent.text: 'FOO'
    // n.parent.parent.text: ('FOO')
    // n.parent.parent.parent.text: d.getVar('FOO')
    const parentParentParent = n?.parent?.parent?.parent
    if (parentParentParent?.type !== 'call') {
      return false
    }
    const match = parentParentParent.text.match(/^(d|e\.data)\.(?<name>.*)\((?<params>.*)\)$/) // d.name(params), e.data.name(params)
    const functionName = match?.groups?.name
    if (functionName === undefined || !(bitBakeDocScanner.pythonDatastoreFunction.includes(functionName))) {
      return false
    }

    // Example for d.getVar('FOO'):
    // n.text: FOO
    // n.parent.text: 'FOO'
    // n.parent.previousSibling.text: (
    const isFirstParameter = n?.parent?.previousSibling?.text === '('
    if (isFirstParameter) {
      const firstParameter = match?.groups?.params?.split(',')[0]?.trim()
      return firstParameter === n?.parent?.text
    }

    // Example for d.renameVar('FOO', 'BAR'):
    // n.text: BAR
    // n.parent.text: 'BAR'
    // n.parent.previousSibling.text: ,
    // n.parent.previousSibling.previousSibling.text: 'FOO'
    // n.parent.previousSibling.previousSibling.previousSibling.text: (
    const isSecondParameter = n?.parent?.previousSibling?.previousSibling?.previousSibling?.text === '('
    // d.renameVar is the only function for which the second parameter could be a Yocto defined variable
    if (functionName === 'renameVar' && isSecondParameter) {
      const secondParameter = match?.groups?.params?.split(',')[1]?.trim()
      return secondParameter === n?.parent?.text
    }

    return false
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

  public isBashVariableExpansion (
    uri: string,
    line: number,
    column: number
  ): boolean {
    return this.isInsideBashRegion(uri, line, column) && this.isVariableExpansion(uri, line, column)
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
   * Check if the current line starts with any directive statement keyword defined in 'DirectiveStatementKeyword'
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

    if (DIRECTIVE_STATEMENT_KEYWORDS.includes(words[0])) {
      return words[0] as DirectiveStatementKeyword
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

  // Return the uris in the diretive statements for unlimited depth
  public extractIncludeFileUris (uri: string, tree?: Parser.Tree): string[] {
    const includeUris: string[] = []
    this.sourceIncludeFiles(uri, includeUris, tree)
    return includeUris
  }

  /**
   * The files pointed by the include URIs will analyzed if not yet done so such that the symbols in the included files are available for querying.
   */
  private sourceIncludeFiles (uri: string, includeFileUris: string[], tree?: Parser.Tree): void {
    if (this.bitBakeParser === undefined) {
      logger.error('[Analyzer] The analyzer is not initialized with a parser')
      return
    }
    const filePath = uri.replace('file://', '')
    logger.debug(`[Analyzer] Sourcing file: ${filePath}`)
    try {
      let parsedTree: Parser.Tree
      if (tree !== undefined) {
        parsedTree = tree
      } else {
        const analyzedDocument = this.uriToAnalyzedDocument[uri]
        if (analyzedDocument === undefined) {
          const textDocument = TextDocument.create(
            uri,
            'bitbake',
            0,
            fs.readFileSync(uri.replace('file://', ''), 'utf8')
          )
          parsedTree = this.bitBakeParser.parse(textDocument.getText())
          // Store it in analyzedDocument just like what analyze() does to avoid re-reading the file from disk and re-parsing the tree when editing on the same file
          const { variableExpansionSymbols, pythonDatastoreVariableSymbols } = this.getSymbolsFromTree({ tree: parsedTree, uri })
          this.uriToAnalyzedDocument[uri] = {
            version: textDocument.version,
            document: textDocument,
            globalDeclarations: getGlobalDeclarations({ tree: parsedTree, uri }),
            variableExpansionSymbols,
            pythonDatastoreVariableSymbols,
            includeFileUris: [],
            tree: parsedTree
          }
        } else {
          logger.debug('[Analyzer] File already analyzed')
          parsedTree = analyzedDocument.tree
        }
      }

      // Recursively scan for files in the directive statements `inherit`, `include` and `require` and pass the same reference of extraSymbols to each recursive call
      const fileUris = this.getDirectiveFileUris(parsedTree)
      fileUris.forEach(uri => {
        if (!includeFileUris.includes(uri)) {
          includeFileUris.push(uri)
        }
      })
      for (const fileUri of fileUris) {
        this.sourceIncludeFiles(fileUri, includeFileUris)
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
          logger.debug(`[Analyzer] Found path: ${childNode.firstNamedChild.text}`)

          const foundFiles = this.findFilesInProjectScanner(childNode.firstNamedChild.text)

          for (const file of foundFiles) {
            if (file.path !== undefined) {
              const uri: string = 'file://' + file.path.dir + '/' + file.path.base
              fileUris.push(encodeURI(uri))
            }
          }
        }
      }
    })
    return fileUris
  }

  public findFilesInProjectScanner (filePath: string): ElementInfo[] {
    const parsedPath = path.parse(filePath)
    let foundFiles: ElementInfo[] = []

    switch (parsedPath.ext) {
      case '.inc':
        foundFiles = bitBakeProjectScannerClient.bitbakeScanResult._includes.filter((inc) => {
          return inc.name === parsedPath.name
        })
        break
      case '.bb':
        foundFiles = bitBakeProjectScannerClient.bitbakeScanResult._recipes.filter((recipe) => {
          return recipe.name === parsedPath.name
        })
        break
      case '.conf':
        foundFiles = bitBakeProjectScannerClient.bitbakeScanResult._confFiles.filter((conf) => {
          return conf.name === parsedPath.name
        })
        break
      default:
        logger.warn(`[Analyzer] Unsupported file extension: ${parsedPath.ext}`)
        break
    }

    return foundFiles
  }

  /**
   * Extract symbols from the string content of the tree
   */
  public getSymbolsInStringContent (uri: string, line: number, character: number): SymbolInformation[] {
    const allSymbolsAtPosition: SymbolInformation[] = []
    const wholeWordRegex = /(?<![-.:])(--(enable|disable)-)?\b(?<name>[a-zA-Z0-9][a-zA-Z0-9-+.]*[a-zA-Z0-9])\b(?![-.:])/g
    const n = this.nodeAtPoint(uri, line, character)
    if (n?.type === 'string_content') {
      this.processSymbolsInStringContent(n, wholeWordRegex, (start, end, match) => {
        const symbolName = match.groups?.name
        if (symbolName !== undefined) {
          logger.debug(`[Analyzer] Found symbol in string content: ${symbolName}`)
          if (this.positionIsInRange(line, character, { start, end })) {
            const foundRecipe = bitBakeProjectScannerClient.bitbakeScanResult._recipes.find((recipe) => {
              return recipe.name === symbolName
            })
            if (foundRecipe !== undefined) {
              if (foundRecipe?.path !== undefined) {
                allSymbolsAtPosition.push({
                  name: symbolName,
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

    parsedTree.rootNode.children.forEach((childNode) => {
      if (childNode.type === 'variable_assignment' && childNode.firstNamedChild?.text === 'SRC_URI') {
        TreeSitterUtils.forEach(childNode, (n) => {
          const followChild = n.type !== 'string_content'
          if (n.type === 'string_content') {
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
          return followChild
        })
      }
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
    const splittedStringContent = n.text.split(/\r?\n/g)
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

  /**
   *
   * @param scanResult
   * @param uri
   *
   * Process scan results sent from the client. The scan results are generated by bitbake -e <recipe> command
   */
  public processRecipeScanResults (scanResult: string, chosenRecipe: string): void {
    if (this.bitBakeParser === undefined) {
      logger.debug('[ProcessRecipeScanResults] The analyzer is not initialized with a parser')
      return undefined
    }

    if (chosenRecipe === undefined) {
      logger.error('[ProcessRecipeScanResults] The chosenRecipe is undefined, abort processing scan results')
      return
    }

    const lines = scanResult.split(/\r?\n/g)
    const index = lines.findIndex((line) => line.includes('INCLUDE HISTORY'))
    if (index === -1) {
      logger.debug('[ProcessRecipeScanResults] Cannot find INCLUDE HISTORY in scan results, abort processing scan results')
      return undefined
    }

    const scanResultText = lines.slice(index).join('\r\n')
    const scanResultParsedTree = this.bitBakeParser.parse(scanResultText)

    const scanResultGlobalDeclarations = getGlobalDeclarations({ tree: scanResultParsedTree, uri: 'scanResultDummyUri', getFinalValue: true })
    const scanResultSymbols = this.getAllSymbolsFromGlobalDeclarations(scanResultGlobalDeclarations)

    this.uriToLastScanResult[chosenRecipe] = {
      symbols: scanResultSymbols,
      includeHistory: this.extractIncludeHistory(scanResult, index)
    }
  }

  private extractIncludeHistory (scanResult: string, includeHistoryIndex: number): ParsedPath[] {
    const result: string[] = []
    const lines = scanResult.split(/\r?\n/g)

    /**
     * # INCLUDE HISTORY
     * #
     * # ...include paths we want
     * #
     * # ...operation history for variables
     */
    for (let i = includeHistoryIndex + 2; i < lines.length; i++) {
      if (lines[i] === '#') {
        break
      }

      result.push(lines[i])
    }

    return result.map((line) => path.parse(line.slice(1).trim()))
  }

  /**
   * @param symbol The symbol to match
   * @param lookUpSymbolList The list of symbols to look up the symbol
   * @returns The symbol that matches the symbol in the scan results
   *
   * Match the symbol in the scan results with the symbol in the original document. If the exact symbol is not found, it will try to find the symbol without 0 overrides as fallback
   */
  public matchSymbol (symbol: BitbakeSymbolInformation, lookUpSymbolList: BitbakeSymbolInformation[]): BitbakeSymbolInformation | undefined {
    return lookUpSymbolList.find((scanResultDocSymbol) => {
      return this.symbolsAreTheSame(scanResultDocSymbol, symbol)
    }) ??
    lookUpSymbolList.find((scanResultDocSymbol) => {
      return scanResultDocSymbol.name === symbol.name && scanResultDocSymbol.overrides.length === 0
    })
  }

  // overload
  public resolveSymbol (symbol: BitbakeSymbolInformation, lookUpSymbolList: BitbakeSymbolInformation[]): BitbakeSymbolInformation
  public resolveSymbol (symbol: string, lookUpSymbolList: BitbakeSymbolInformation[]): string
  /**
   *
   * @param symbol A symbol that contains variable expansion syntax. e.g. VAR:${PN} or require ${PN}.inc
   * @param lookUpSymbolList A list of symbols to look up the final value of the variables in the variable expansion syntax
   *
   * Resolve the symbol if it contains variable expansion syntax in its overrides
   */
  public resolveSymbol (symbol: BitbakeSymbolInformation | string, lookUpSymbolList: BitbakeSymbolInformation[]): BitbakeSymbolInformation | string {
    if (typeof symbol !== 'string') {
      const resolvedOverrides = symbol.overrides.map((override) => {
        return this.resolveVariableExpansionValues(override, lookUpSymbolList)
      })

      const resolvedSymbol: BitbakeSymbolInformation = {
        ...symbol,
        overrides: [...resolvedOverrides]
      }

      return resolvedSymbol
    } else {
      return this.resolveVariableExpansionValues(symbol, lookUpSymbolList)
    }
  }

  private resolveVariableExpansionValues (symbol: string, lookUpSymbolList: BitbakeSymbolInformation[]): string {
    const regex = /\$\{(?<variable>.*)\}/g
    let resolvedSymbol = symbol

    for (const match of symbol.matchAll(regex)) {
      const variable = match.groups?.variable
      if (variable !== undefined) {
        const value = lookUpSymbolList.find((symbol) => symbol.name === variable)?.finalValue
        value !== undefined && (resolvedSymbol = resolvedSymbol.replace(new RegExp('\\$\\{' + variable + '\\}', 'g'), value.endsWith('+git') ? value.replace('+git', '') : value)) // PV usually has +git appended to it
      }
    }

    return resolvedSymbol
  }

  public extractModificationHistoryFromComments (symbol: BitbakeSymbolInformation): Location[] {
    const comments = symbol.commentsAbove
    const history: Location[] = []
    let regex = /()?/g // dummy regex

    if (symbol.kind === SymbolKind.Variable) {
      regex = /(?<=#\s{3}set\??\s)(?<filePath>\/.*):(?<lineNumber>\d+)/g
    } else if (symbol.kind === SymbolKind.Function) {
      regex = /(?<=#\s)line:\s(?<lineNumber>\d+),\sfile:\s(?<filePath>\/.*)/g
    }

    comments?.forEach((comment) => {
      /**
       *  Examples:
       *  Variable:
       *  #   set /home/projects/poky/meta/conf/bitbake.conf:396
          #     [_defaultval] "gnu"
          TC_CXX_RUNTIME="gnu"

          Function:
          # line: 331, file: /home/projects/poky/meta/classes-global/base.bbclass
          base_do_configure(){

          }
       */
      for (const match of comment.matchAll(regex)) {
        const filePath = match.groups?.filePath
        const lineNumber = match.groups?.lineNumber
        if (filePath !== undefined && lineNumber !== undefined) {
          const uri = 'file://' + filePath
          // Assuming the variables start at the beginning of the line (character 0)
          // Could traverse the target file tree-sitter tree to find the exact range of the variable, but it costs performance
          const location = Location.create(uri, { start: { line: parseInt(lineNumber) - 1, character: 0 }, end: { line: parseInt(lineNumber) - 1, character: symbol.name.length } })
          history.push(location)
        }
      }
    })

    return history
  }

  /**
   *
   * @param symbolA
   * @param symbolB
   * @returns
   *
   * This functions doesn't check the deep equality of the two symbols. It only checkes the neccesary fields to determine if the two symbols are referring the same thing in the file.
   */
  public symbolsAreTheSame (symbolA: BitbakeSymbolInformation, symbolB: BitbakeSymbolInformation): boolean {
    const conditions = symbolA.name === symbolB.name && symbolA.overrides.length === symbolB.overrides.length
    // Only compare the overrides that are not variable expansions.
    // For symbols with variable expansions, first resolve the values of the variables in '${}' then reconstrcut a symbol with only literal overrdies before comparing
    const overridesWithValuesForA = symbolA.overrides.filter(override => typeof override === 'string')
    const overridesWithValuesForB = symbolB.overrides.filter(override => typeof override === 'string')

    return conditions && overridesWithValuesForA.every((override) => overridesWithValuesForB.includes(override))
    // Question: should we care about the order of the overrides?
  }
}

export const analyzer: Analyzer = new Analyzer()
