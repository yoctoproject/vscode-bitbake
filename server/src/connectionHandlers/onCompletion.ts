/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import logger from 'winston'
import { type TextDocumentPositionParams, type CompletionItem, type SymbolInformation, CompletionItemKind } from 'vscode-languageserver/node'
import { symbolKindToCompletionKind } from '../utils/lsp'
import { BITBAKE_VARIABLES } from '../completions/bitbake-variables'
import { RESERVED_KEYWORDS } from '../completions/reserved-keywords'
import { analyzer } from '../tree-sitter/analyzer'
import { formatCompletionItems } from '../completions/snippet-utils'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { BITBAKE_OPERATOR } from '../completions/bitbake-operator'
import { VARIABLE_FLAGS } from '../completions/variable-flags'

export function onCompletionHandler (textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] {
  logger.debug('onCompletion')

  const wordPosition = {
    line: textDocumentPositionParams.position.line,
    // Go one character back to get completion on the current word. This is used as a parameter in descendantForPosition()
    character: Math.max(textDocumentPositionParams.position.character - 1, 0)
  }

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: wordPosition
  })

  logger.debug(`onCompletion - current word: ${word}`)

  const shouldComplete = analyzer.shouldProvideCompletionItems(textDocumentPositionParams.textDocument.uri, wordPosition.line, wordPosition.character)
  // Do not provide completions if it is inside a string but not inside a variable expansion
  if (!shouldComplete) {
    return []
  }

  // bitbake operators
  if (word === ':') {
    const wordBeforeIsIdentifier = analyzer.isIdentifier({
      ...textDocumentPositionParams,
      position: {
        line: textDocumentPositionParams.position.line,
        // Go two character back as one character back is ':'
        character: Math.max(textDocumentPositionParams.position.character - 2, 0)
      }
    })
    if (wordBeforeIsIdentifier) {
      const bitBakeOperatorCompletionItems: CompletionItem[] = BITBAKE_OPERATOR.map(keyword => {
        return {
          label: keyword,
          kind: CompletionItemKind.Operator
        }
      })

      return bitBakeOperatorCompletionItems
    } else {
      return []
    }
  }
  // TODO: add dynamic overrides, completion type: Property

  // variable flags
  if (word === '[') {
    const wordBeforeIsIdentifier = analyzer.isIdentifier({
      ...textDocumentPositionParams,
      position: {
        line: textDocumentPositionParams.position.line,
        // Go two character back as one character back is ':'
        character: Math.max(textDocumentPositionParams.position.character - 2, 0)
      }
    })
    if (wordBeforeIsIdentifier) {
      const variableFlagsFromScanner: CompletionItem[] = formatCompletionItems(bitBakeDocScanner.variablFlags)

      const variableFlagCompletionItems: CompletionItem[] = VARIABLE_FLAGS.map(keyword => {
        return {
          label: keyword,
          kind: CompletionItemKind.Keyword
        }
      })

      return variableFlagsFromScanner.length > 0 ? variableFlagsFromScanner : variableFlagCompletionItems
    } else {
      return []
    }
  }

  let symbolCompletions: CompletionItem[] = []
  if (word !== null) {
    const globalDeclarationSymbols = analyzer.getGlobalDeclarationSymbols(textDocumentPositionParams.textDocument.uri)

    symbolCompletions = globalDeclarationSymbols.map((symbol: SymbolInformation) => (
      {
        label: symbol.name,
        kind: symbolKindToCompletionKind(symbol.kind),
        documentation: `${symbol.name}`
      }
    ))
  }

  const reserverdKeywordCompletionItems: CompletionItem[] = RESERVED_KEYWORDS.map(keyword => {
    return {
      label: keyword,
      kind: CompletionItemKind.Keyword
    }
  })

  const reserverdVariableCompletionItems: CompletionItem[] = BITBAKE_VARIABLES.map(keyword => {
    return {
      label: keyword,
      kind: CompletionItemKind.Variable
    }
  })

  const yoctoTaskSnippets: CompletionItem[] = formatCompletionItems(bitBakeDocScanner.yoctoTasks)

  const allCompletions = [
    ...reserverdKeywordCompletionItems,
    ...reserverdVariableCompletionItems,
    ...yoctoTaskSnippets,
    ...symbolCompletions
  ]

  return allCompletions
}
