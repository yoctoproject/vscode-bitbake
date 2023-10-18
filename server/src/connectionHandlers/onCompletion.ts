import logger from 'winston'
import { type TextDocumentPositionParams, type CompletionItem, type SymbolInformation, CompletionItemKind } from 'vscode-languageserver/node'
import { symbolKindToCompletionKind } from '../utils/lsp'
import { BITBAKE_VARIABLES } from '../completions/bitbake-variables'
import { RESERVED_KEYWORDS } from '../completions/reserved-keywords'
import { analyzer } from '../tree-sitter/analyzer'
import { SNIPPETS } from '../completions/snippets'

export function onCompletionHandler (textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] {
  logger.debug('onCompletion')

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: {
      line: textDocumentPositionParams.position.line,
      // Go one character back to get completion on the current word. This is used as a parameter in descendantForPosition()
      character: Math.max(textDocumentPositionParams.position.character - 1, 0)
    }
  })

  logger.debug(`onCompletion - current word: ${word}`)

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

  const allCompletions = [
    ...reserverdKeywordCompletionItems,
    ...reserverdVariableCompletionItems,
    ...SNIPPETS,
    ...symbolCompletions
  ]

  return allCompletions
}
