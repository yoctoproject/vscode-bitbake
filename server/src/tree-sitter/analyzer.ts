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
import { getGlobalDeclarations, type GlobalDeclarations } from './declarations'
import { debounce } from '../utils/async'
import { type Tree } from 'web-tree-sitter'
import { range } from './utils'
const DEBOUNCE_TIME_MS = 500

interface AnalyzedDocument {
  document: TextDocument
  globalDeclarations: GlobalDeclarations
  tree: Parser.Tree
}

export default class Analyzer {
  private parser?: Parser
  private uriToAnalyzedDocument: Record<string, AnalyzedDocument | undefined> = {}
  private debouncedExecuteAnalyzation?: ReturnType<typeof debounce>

  public getDocumentTexts (uri: string): string[] | undefined {
    return this.uriToAnalyzedDocument[uri]?.document.getText().split(/\r?\n/g)
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

    this.uriToAnalyzedDocument[uri] = {
      document,
      globalDeclarations,
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

  public shouldProvideCompletionItems (
    uri: string,
    line: number,
    column: number
  ): boolean {
    const n = this.nodeAtPoint(uri, line, column)
    if (n?.type === 'string_content' || n?.type === 'ERROR') {
      return false
    }
    return true
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
      // Caveat: In some cases, the current tree-sitter can't correctly parse the classes in inherit directive. For example, a bbclass file with a name update-rc.d.bbclass and the statement for inherting it is 'inherit update-rc.d', the tree-sitter will treat '.d' as ERROR.
      case 'identifier':
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
   * Tree-sitter functionalities are not used here since the current version @1.0.1 doesn't treat a line as directive statement if the keyword presents but nothing follows.
   */
  public getDirectiveStatementKeywordByLine (textDocumentPositionParams: TextDocumentPositionParams): string | undefined {
    const { textDocument, position } = textDocumentPositionParams
    const documentAsText = this.getDocumentTexts(textDocument.uri)
    if (documentAsText === undefined) {
      return undefined
    }
    const currentLine = documentAsText[position.line]
    const lineTillCurrentPosition = currentLine.substring(0, position.character)
    const words = lineTillCurrentPosition.split(' ')

    const directiveStatementKeywords = new Set(['include', 'inherit', 'require'])

    if (directiveStatementKeywords.has(words[0])) {
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
