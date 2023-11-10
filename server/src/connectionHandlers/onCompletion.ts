/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/server.ts#L408
 */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type CompletionItem, type SymbolInformation, CompletionItemKind } from 'vscode-languageserver/node'
import { symbolKindToCompletionKind } from '../utils/lsp'
import { BITBAKE_VARIABLES } from '../completions/bitbake-variables'
import { RESERVED_KEYWORDS } from '../completions/reserved-keywords'
import { analyzer } from '../tree-sitter/analyzer'
import { formatCompletionItems } from '../completions/snippet-utils'
import { bitBakeDocScanner, type DocInfoType } from '../BitBakeDocScanner'
import { BITBAKE_OPERATOR } from '../completions/bitbake-operator'
import { VARIABLE_FLAGS } from '../completions/variable-flags'
import { bitBakeProjectScanner } from '../BitBakeProjectScanner'
import type { ElementInfo } from '../lib/src/types/BitbakeScanResult'

export function onCompletionHandler (textDocumentPositionParams: TextDocumentPositionParams): CompletionItem[] {
  const wordPosition = {
    line: textDocumentPositionParams.position.line,
    // Go one character back to get completion on the current word. This is used as a parameter in descendantForPosition()
    character: Math.max(textDocumentPositionParams.position.character - 1, 0)
  }

  const documentUri = textDocumentPositionParams.textDocument.uri

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: wordPosition
  })

  logger.debug(`[onCompletion] current word: ${word}`)

  if (analyzer.isStringContent(documentUri, wordPosition.line, wordPosition.character)) {
    return []
  }

  // bitbake operators
  const isOverride = analyzer.isOverride(documentUri, wordPosition.line, wordPosition.character)
  if (word === ':' || isOverride) {
    const wordBeforeIsIdentifier = analyzer.isIdentifier({
      ...textDocumentPositionParams,
      position: {
        line: textDocumentPositionParams.position.line,
        // Go two character back as one character back is ':'
        character: Math.max(textDocumentPositionParams.position.character - 2, 0)
      }
    })
    if (wordBeforeIsIdentifier || isOverride) {
      const bitBakeOperatorCompletionItems: CompletionItem[] = BITBAKE_OPERATOR.map(keyword => {
        return {
          label: keyword,
          kind: CompletionItemKind.Operator
        }
      })

      const bitbakeOverridesCompletionItems: CompletionItem[] = bitBakeProjectScanner.overrides.map((override, index) => {
        let label = override
        if (override === 'pn-defaultpkgname') {
          // eslint-disable-next-line no-template-curly-in-string
          label = '${PN}'
        }
        return {
          label,
          kind: CompletionItemKind.Property,
          // Present overrides after operators, in order of priority
          sortText: '~' + String.fromCharCode(21 + index) + label
        }
      })

      return [...bitBakeOperatorCompletionItems, ...bitbakeOverridesCompletionItems]
    } else {
      return []
    }
  }

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
      const variableFlagsFromScanner: CompletionItem[] = formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.variableFlagInfo), CompletionItemKind.Keyword)

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
    const globalDeclarationSymbols = analyzer.getGlobalDeclarationSymbols(documentUri)
    // Filter out duplicate BITBAKE_VARIABLES as they will be included as global declaration after running analyzer.analyze() in documents.onDidChangeContent() in server.ts
    symbolCompletions = globalDeclarationSymbols.filter((symbol: SymbolInformation) => !(new Set(BITBAKE_VARIABLES).has(symbol.name))).map((symbol: SymbolInformation) => (
      {
        label: symbol.name,
        kind: symbolKindToCompletionKind(symbol.kind),
        documentation: `${symbol.name}`
      }
    ))
  }

  // Directive statements completion items. bbclass files, include files, recipe files etc
  const directiveStatementKeyword = analyzer.getDirectiveStatementKeywordByLine(textDocumentPositionParams)
  if (directiveStatementKeyword !== undefined) {
    logger.debug(`[onCompletion] Found directive statement: ${directiveStatementKeyword}`)
    return getCompletionItemForDirectiveStatementKeyword(directiveStatementKeyword)
  }

  let reserverdKeywordCompletionItems: CompletionItem[] = []
  if (!analyzer.isVariableExpansion(documentUri, wordPosition.line, wordPosition.character)) {
    reserverdKeywordCompletionItems = RESERVED_KEYWORDS.map(keyword => {
      return {
        label: keyword,
        kind: CompletionItemKind.Keyword
      }
    })
  }

  const bitBakeVariableCompletionItems: CompletionItem[] = bitBakeDocScanner.bitbakeVariableInfo.length > 0
    ? formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.bitbakeVariableInfo), CompletionItemKind.Variable)
    : BITBAKE_VARIABLES.map(keyword => {
      return {
        label: keyword,
        kind: CompletionItemKind.Variable
      }
    })

  const yoctoTaskSnippets: CompletionItem[] = formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.yoctoTaskInfo), CompletionItemKind.Snippet)

  const yoctoVariableCompletionItems: CompletionItem[] = formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.yoctoVariableInfo), CompletionItemKind.Variable)

  // Remove the duplicate variables by their names. It still keeps the fallback variables from BITBAKE_VARIABLES before scanning the docs since yoctoVariableCompletionItems will be [] in that case
  const variableCompletionItems: CompletionItem[] = [
    ...bitBakeVariableCompletionItems.filter((bitbakeVariable) => !yoctoVariableCompletionItems.some(yoctoVariable => yoctoVariable.label === bitbakeVariable.label)),
    ...yoctoVariableCompletionItems
  ]

  const allCompletions = [
    ...reserverdKeywordCompletionItems,
    ...variableCompletionItems,
    ...yoctoTaskSnippets,
    ...symbolCompletions
  ]

  return allCompletions
}

/**
 * Convert data in BitBakeDocScanner to completion items
 */
function docInfoToCompletionItems (docInfo: DocInfoType): CompletionItem[] {
  const completionItems: CompletionItem[] = []
  docInfo.forEach((info) => {
    completionItems.push({
      label: info.name,
      labelDetails: {
        description: info.docSource !== undefined ? `Source: ${info.docSource}` : ''
      },
      documentation: info.definition,
      data: {
        referenceUrl: info.referenceUrl
      },
      insertText: info?.insertText
    })
  })

  return completionItems
}

function getCompletionItemForDirectiveStatementKeyword (keyword: string): CompletionItem[] {
  let completionItem: CompletionItem[] = []

  switch (keyword) {
    case 'inherit':
      completionItem = [
        ...convertElementInfoListToCompletionItemList(
          bitBakeProjectScanner.classes,
          CompletionItemKind.Class,
          'bbclass'
        )]
      break
    case 'require':
    case 'include':
      completionItem = [
        ...convertElementInfoListToCompletionItemList(
          bitBakeProjectScanner.includes,
          CompletionItemKind.Interface,
          'inc'
        )
      ]
      break
    default:
      break
  }

  return completionItem
}

function convertElementInfoListToCompletionItemList (elementInfoList: ElementInfo[], completionItemKind: CompletionItemKind, fileType: string): CompletionItem[] {
  const completionItems: CompletionItem[] = []

  for (const element of elementInfoList) {
    const filePath = getFilePath(element, fileType)
    const completionItem: CompletionItem = {
      label: element.name,
      labelDetails: {
        description: filePath ?? fileType
      },
      // TODO1: Construct the file path which should be relative to the current document for insertText.
      // TODO2: Limit what should be shown in the completion list for directive statment?
      // insertText: filePath ?? element.name,
      documentation: element.extraInfo,
      data: element,
      kind: completionItemKind
    }
    completionItems.push(completionItem)
  }

  return completionItems
}

function getFilePath (elementInfo: ElementInfo, fileType: string): string | undefined {
  if (fileType === 'inc' || fileType === 'bbclass') {
    const path = elementInfo.path
    let pathAsString = path?.dir.replace(elementInfo.layerInfo?.path as string, '')
    if (pathAsString !== undefined && pathAsString.startsWith('/')) {
      pathAsString = pathAsString.slice(1)
    }

    return pathAsString + '/' + elementInfo?.path?.base
  }
  return undefined
}

// TBD: Recipe completion, the code from CompletionProvider.ts
// function createCompletionItemForRecipes (): CompletionItem[] {
//   return [
//     ...convertElementInfoListToCompletionItemList(
//       bitBakeProjectScanner.recipes,
//       CompletionItemKind.Method,
//       'bb'
//     )
//   ]
// }
