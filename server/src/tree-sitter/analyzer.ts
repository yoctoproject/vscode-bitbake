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
  type Range
} from 'vscode-languageserver'
import type Parser from 'web-tree-sitter'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { type EmbeddedRegions, getEmbeddedRegionsFromNode, getGlobalDeclarations, type GlobalDeclarations } from './declarations'
import { debounce } from '../utils/async'
import { type Tree } from 'web-tree-sitter'
import { range } from './utils'
const DEBOUNCE_TIME_MS = 500

interface AnalyzedDocument {
  document: TextDocument
  globalDeclarations: GlobalDeclarations
  embeddedRegions: EmbeddedRegions
  tree: Parser.Tree
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
      console.log('The analyzer is not initialized with a parser')
      return await Promise.resolve([])
    }

    const fileContent = document.getText()

    const tree = this.parser.parse(fileContent)
    const globalDeclarations = getGlobalDeclarations({ tree, uri })
    const embeddedRegions = getEmbeddedRegionsFromNode(tree, uri)

    this.uriToAnalyzedDocument[uri] = {
      document,
      globalDeclarations,
      embeddedRegions,
      tree
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
    const symbols: SymbolInformation[] = []
    const analyzedDocument = this.uriToAnalyzedDocument[uri]
    if (analyzedDocument !== undefined) {
      const { globalDeclarations } = analyzedDocument
      Object.values(globalDeclarations).forEach((symbol) => symbols.push(symbol))
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
  ): string | undefined {
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

    return range(n)
  }

  /**
   * Check if the current line starts with any directive statement keyword. The keyword is one of `include`, `inherit` and `require`
   *
   * Tree-sitter functionalities are not used here since they (as of @1.0.1) can't reliably treat a line as directive statement if the keyword presents but nothing follows.
   */
  public getDirectiveStatementKeywordByLine (textDocumentPositionParams: TextDocumentPositionParams): 'include' | 'inherit' | 'require' | undefined {
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
}

export const analyzer: Analyzer = new Analyzer()
