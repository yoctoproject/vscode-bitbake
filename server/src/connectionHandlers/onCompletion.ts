/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/server.ts#L408
 */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type CompletionItem, type SymbolInformation, CompletionItemKind, type Position } from 'vscode-languageserver/node'
import { symbolKindToCompletionKind } from '../utils/lsp'
import { BITBAKE_VARIABLES } from '../completions/bitbake-variables'
import { RESERVED_KEYWORDS } from '../completions/reserved-keywords'
import { analyzer } from '../tree-sitter/analyzer'
import { formatCompletionItems } from '../completions/snippet-utils'
import { bitBakeDocScanner, type DocInfoType } from '../BitBakeDocScanner'
import { BITBAKE_OPERATOR } from '../completions/bitbake-operator'
import { VARIABLE_FLAGS } from '../completions/variable-flags'
import type { ElementInfo } from '../lib/src/types/BitbakeScanResult'
import { bitBakeProjectScannerClient } from '../BitbakeProjectScannerClient'
import path from 'path'
import { commonDirectoriesVariables } from '../lib/src/availableVariables'
import { mergeArraysDistinctly } from '../lib/src/utils/arrays'
import { type BitbakeSymbolInformation } from '../tree-sitter/declarations'
import { getSpdxLicenseCompletionResolve, getLicenseCompletionItems, spdxLicenseDescription } from '../completions/spdx-licenses'

let documentUri = ''

export async function onCompletionHandler (textDocumentPositionParams: TextDocumentPositionParams): Promise<CompletionItem[]> {
  const wordPosition = {
    line: textDocumentPositionParams.position.line,
    // Go one character back to get completion on the current word.
    character: Math.max(textDocumentPositionParams.position.character - 1, 0)
  }

  documentUri = textDocumentPositionParams.textDocument.uri

  const word = analyzer.wordAtPointFromTextPosition({
    ...textDocumentPositionParams,
    position: wordPosition
  })

  logger.debug(`[onCompletion] current word: ${word}`)

  const bitBakeNode = analyzer.bitBakeNodeAtPoint(documentUri, wordPosition.line, wordPosition.character)
  if (bitBakeNode !== null && analyzer.isInsideBashRegion(bitBakeNode)) {
    return getBashCompletionItems(documentUri, word, wordPosition)
  }

  if (bitBakeNode !== null && analyzer.isInsidePythonRegion(bitBakeNode)) {
    return getPythonCompletionItems(documentUri, word, wordPosition)
  }

  return await getBitBakeCompletionItems(textDocumentPositionParams, word, wordPosition)
}

async function getBitBakeCompletionItems (textDocumentPositionParams: TextDocumentPositionParams, word: string | null, wordPosition: Position): Promise<CompletionItem[]> {
  if (analyzer.isString(documentUri, wordPosition.line, wordPosition.character)) {
    const variablesAllowedForRecipeCompletion = ['RDEPENDS', 'IMAGE_INSTALL', 'DEPENDS', 'RRECOMMENDS', 'RSUGGESTS', 'RCONFLICTS', 'RREPLACES', 'CORE_IMAGE_EXTRA_INSTALL', 'PACKAGE_INSTALL', 'PACKAGE_INSTALL_ATTEMPTONLY']
    const isVariableAllowedForRecipeCompletion = analyzer.isStringContentOfVariableAssignment(documentUri, wordPosition.line, wordPosition.character, variablesAllowedForRecipeCompletion)

    if (isVariableAllowedForRecipeCompletion) {
      return convertElementInfoListToCompletionItemList(
        bitBakeProjectScannerClient.bitbakeScanResult._recipes,
        CompletionItemKind.Interface,
        'bb',
        true
      )
    }

    const variablesAllowedForUriCompletion = ['SRC_URI']
    const isVariableAllowedForUriCompletion = analyzer.isStringContentOfVariableAssignment(documentUri, wordPosition.line, wordPosition.character, variablesAllowedForUriCompletion)
    const recipeLocalFiles = analyzer.getRecipeLocalFiles(documentUri)
    if (isVariableAllowedForUriCompletion && recipeLocalFiles !== undefined) {
      const fileUriCompletionItems = recipeLocalFiles.foundFileUris.map<CompletionItem>((fileUri) => {
        return {
          label: path.basename(fileUri),
          kind: CompletionItemKind.File,
          detail: fileUri,
          insertText: `file://${path.basename(fileUri)}`
        }
      })

      const dirCompletionItems = recipeLocalFiles.foundDirs.map<CompletionItem>((dir) => {
        return {
          label: path.basename(dir),
          kind: CompletionItemKind.Folder,
          insertText: `file://${path.basename(dir)}/`
        }
      })

      return [
        ...fileUriCompletionItems,
        ...dirCompletionItems
      ]
    }

    const variablesAllowedForLicenseCompletion = ['LICENSE']
    const isVariableAllowedForLicenseCompletion = analyzer.isStringContentOfVariableAssignment(documentUri, wordPosition.line, wordPosition.character, variablesAllowedForLicenseCompletion)
    if (isVariableAllowedForLicenseCompletion && recipeLocalFiles !== undefined && word !== null) {
      const textDocument = analyzer.getAnalyzedDocument(documentUri)?.document
      if (textDocument !== undefined) {
        return await getLicenseCompletionItems(textDocument, textDocumentPositionParams.position)
      }
    }

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

      const bitbakeOverridesCompletionItems: CompletionItem[] = bitBakeProjectScannerClient.bitbakeScanResult._overrides.map((override, index) => {
        let label = override
        if (override === 'pn-defaultpkgname') {
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

  const symbolCompletionItems: CompletionItem[] = getSymbolCompletionItems(word)

  // Directive statements completion items. bbclass files, include files, recipe files etc
  const directiveStatementKeyword = analyzer.getDirectiveStatementKeywordByLine(textDocumentPositionParams)
  if (directiveStatementKeyword !== undefined) {
    logger.debug(`[onCompletion] Found directive statement: ${directiveStatementKeyword}`)
    return getCompletionItemForDirectiveStatementKeyword(directiveStatementKeyword)
  }

  const isBitBakeVariableExpansion = analyzer.isBitBakeVariableExpansion(documentUri, wordPosition.line, wordPosition.character)
  const commonDirectoriesCompletionItems = isBitBakeVariableExpansion ? allCommonDirectoriesCompletionItems : []
  const reservedKeywordCompletionItems = !isBitBakeVariableExpansion ? allReserverdKeywordCompletionItems : []

  return mergeArraysDistinctly(
    (completionItem) => completionItem.label,
    // In priority order
    getSymbolCompletionItems(word),
    reservedKeywordCompletionItems,
    getVariablecompletionItems(symbolCompletionItems),
    getYoctoTaskSnippets(),
    commonDirectoriesCompletionItems
  )
}

function getBashCompletionItems (documentUri: string, word: string | null, wordPosition: Position): CompletionItem[] {
  if (analyzer.isBashVariableName(documentUri, wordPosition.line, wordPosition.character)) {
    const symbolCompletionItems = getSymbolCompletionItems(word)
    return mergeArraysDistinctly(
      (completionItem) => completionItem.label,
      getVariablecompletionItems(symbolCompletionItems),
      symbolCompletionItems,
      allCommonDirectoriesCompletionItems
    )
  }
  return getYoctoTaskSnippets()
}

function getPythonCompletionItems (documentUri: string, word: string | null, wordPosition: Position): CompletionItem[] {
  const bitbakeNode = analyzer.bitBakeNodeAtPoint(documentUri, wordPosition.line, wordPosition.character)
  if (bitbakeNode !== null && analyzer.isPythonDatastoreVariable(bitbakeNode, true)) {
    const symbolCompletionItems = getSymbolCompletionItems(word)
    return mergeArraysDistinctly(
      (completionItem) => completionItem.label,
      getVariablecompletionItems(symbolCompletionItems),
      symbolCompletionItems,
      allCommonDirectoriesCompletionItems
    )
  }
  if (analyzer.isString(documentUri, wordPosition.line, wordPosition.character)) {
    return []
  }
  return getYoctoTaskSnippets()
}

function getYoctoTaskSnippets (): CompletionItem[] {
  return formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.yoctoTaskInfo), CompletionItemKind.Snippet)
}

const allReserverdKeywordCompletionItems: CompletionItem[] = RESERVED_KEYWORDS.map(keyword => {
  return {
    label: keyword,
    kind: CompletionItemKind.Keyword
  }
})

const allCommonDirectoriesCompletionItems: CompletionItem[] = Array.from(commonDirectoriesVariables).map((variable) => {
  return {
    label: variable,
    kind: CompletionItemKind.Variable
  }
})

function getSymbolCompletionItems (word: string | null): CompletionItem[] {
  if (word !== null) {
    const uniqueSymbolSet = new Set()
    const globalDeclarationSymbols = analyzer.getGlobalDeclarationSymbols(documentUri).filter(symbol => {
      if (!uniqueSymbolSet.has(symbol.name)) {
        uniqueSymbolSet.add(symbol.name)
        return true
      }
      return false
    })
    // Filter out duplicate BITBAKE_VARIABLES as they will be included as global declaration after running analyzer.analyze() in documents.onDidChangeContent() in server.ts
    return [
      ...globalDeclarationSymbols.filter((symbol: SymbolInformation) => !(new Set(BITBAKE_VARIABLES).has(symbol.name))).map((symbol: SymbolInformation) => (
        {
          label: symbol.name,
          kind: symbolKindToCompletionKind(symbol.kind),
          documentation: `${symbol.name}`
        }
      )),
      ...formatCompletionItems(convertExtraSymbolsToCompletionItems(documentUri))
    ]
  }
  return []
}

function getBitBakeVariableCompletionItems (): CompletionItem[] {
  return bitBakeDocScanner.bitbakeVariableInfo.length > 0
    ? formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.bitbakeVariableInfo), CompletionItemKind.Variable)
    : BITBAKE_VARIABLES.map(keyword => {
      return {
        label: keyword,
        kind: CompletionItemKind.Variable
      }
    })
}

function getYoctoVariableCompletionItems (): CompletionItem[] {
  return formatCompletionItems(docInfoToCompletionItems(bitBakeDocScanner.yoctoVariableInfo), CompletionItemKind.Variable)
}

function getVariablecompletionItems (symbolCompletionItems: CompletionItem[] = []): CompletionItem[] {
  const yoctoVariableCompletionItems = getYoctoVariableCompletionItems()
  // 1. Remove the duplicate variables by their names. It still keeps the fallback variables from BITBAKE_VARIABLES before scanning the docs since yoctoVariableCompletionItems will be [] in that case
  // 2. Remove the duplicates in variable completion items if they exist in the extra symbols. Keep the ones in the extra symbols as they contain information about the relative path.
  return [...getBitBakeVariableCompletionItems().filter((bitbakeVariable) => !yoctoVariableCompletionItems.some(yoctoVariable => yoctoVariable.label === bitbakeVariable.label)),
    ...yoctoVariableCompletionItems
  ].filter((variableCompletionItem) => !symbolCompletionItems.some((symbolCompletionItem) => symbolCompletionItem.label === variableCompletionItem.label))
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
    case 'inherit_defer':
      completionItem = [
        ...convertElementInfoListToCompletionItemList(
          bitBakeProjectScannerClient.bitbakeScanResult._classes,
          CompletionItemKind.Class,
          'bbclass'
        )]
      break
    case 'require':
    case 'include':
      completionItem = [
        ...convertElementInfoListToCompletionItemList(
          bitBakeProjectScannerClient.bitbakeScanResult._includes,
          CompletionItemKind.Interface,
          'inc'
        ),
        ...convertElementInfoListToCompletionItemList(
          bitBakeProjectScannerClient.bitbakeScanResult._recipes,
          CompletionItemKind.Interface,
          'bb'
        )
      ]
      break
    default:
      break
  }

  return completionItem
}

function convertElementInfoListToCompletionItemList (elementInfoList: ElementInfo[], completionItemKind: CompletionItemKind, fileType: 'bbclass' | 'bb' | 'inc', nameOnly: boolean = false): CompletionItem[] {
  const completionItems: CompletionItem[] = []

  for (const element of elementInfoList) {
    const filePath = getFilePath(element, fileType)
    const base = element.name + '.' + fileType
    const completionItem: CompletionItem = {
      label: (nameOnly || fileType === 'bbclass') ? element.name : base,
      detail: base,
      labelDetails: {
        description: filePath ?? fileType
      },
      insertText: nameOnly ? element.name : filePath ?? element.name,
      documentation: element.extraInfo,
      data: element,
      kind: completionItemKind
    }
    completionItems.push(completionItem)
  }

  if (completionItems.length > 0) {
    const docUriSplit = documentUri.replace('file://', '').split('/')
    const condition = (item: CompletionItem): boolean => {
      if (item.insertText === undefined || item.insertText.split('.')[0] === item.label.split('.')[0]) {
        return false
      } else {
        return docUriSplit.includes(item.insertText.split('/')[0])
      }
    }

    completionItems.sort((a, b) => Number(condition(b)) - Number(condition(a)))
  }

  return completionItems
}

function getFilePath (elementInfo: ElementInfo, fileType: 'bbclass' | 'bb' | 'inc'): string | undefined {
  if (fileType === 'inc' || fileType === 'bb') {
    const path = elementInfo.path
    if (path === undefined) {
      return undefined
    }
    let pathAsString = path.dir.replace(elementInfo.layerInfo?.path ?? '', '')
    if (pathAsString.startsWith('/')) {
      pathAsString = pathAsString.slice(1)
    }

    return pathAsString + '/' + path.base
  }
  return undefined
}

function convertExtraSymbolsToCompletionItems (uri: string): CompletionItem[] {
  logger.debug(`[onCompletion] convertSymbolsToCompletionItems: ${uri}`)
  let completionItems: CompletionItem[] = []
  analyzer.getIncludeUrisForUri(uri).map((includeUri) => {
    return analyzer.getGlobalDeclarationSymbols(includeUri)
  })
    .flat()
    .reduce<BitbakeSymbolInformation[]>((acc, symbol) => {
    if (acc.find((s) => s.name === symbol.name) === undefined) { // Symbols with the same name are considered duplicates, regardless of overrides, because we only need one for each as a completion item
      acc.push(symbol)
    }
    return acc
  }, [])
    .forEach((extraSymbol) => {
      const variableInfo = [
        ...bitBakeDocScanner.bitbakeVariableInfo.filter((bitbakeVariable) => !bitBakeDocScanner.yoctoVariableInfo.some(yoctoVariable => yoctoVariable.name === bitbakeVariable.name)),
        ...bitBakeDocScanner.yoctoVariableInfo
      ]
      const foundInVariableInfo = variableInfo.find((variable) => variable.name === extraSymbol.name)
      const completionItem: CompletionItem = {
        label: extraSymbol.name,
        labelDetails: {
          description: path.relative(documentUri.replace('file://', ''), extraSymbol.location.uri.replace('file://', ''))
        },
        documentation: foundInVariableInfo?.definition ?? '',
        kind: symbolKindToCompletionKind(extraSymbol.kind),
        data: {
          referenceUrl: foundInVariableInfo?.referenceUrl
        },
        insertText: foundInVariableInfo?.insertText
      }
      completionItems.push(completionItem)
    })

  // Add supplement variables and function completions from the scan results (bitbake -e)
  const lastScanResult = analyzer.getLastScanResult(documentUri)
  if (lastScanResult !== undefined) {
    const scanResultCompletionItems = lastScanResult.symbols.filter((symbol) => !completionItems.some((item) => item.label === symbol.name)).map((symbol) => {
      const completionItem: CompletionItem = {
        label: symbol.name,
        kind: symbolKindToCompletionKind(symbol.kind),
        documentation: symbol.finalValue ?? ''
      }
      return completionItem
    })
    completionItems = [
      ...completionItems,
      ...scanResultCompletionItems
    ]
  }
  // Filter duplicates from the included files, current goal is to show only one item for one symbol even though it occurs in multiple included files. The one that remains will still contain the path in its label details but it doesn't necessarily indicate the location of the very first occurance.
  const uniqueItems = new Set()
  completionItems = completionItems.filter(item => {
    if (!uniqueItems.has(item.label)) {
      uniqueItems.add(item.label)
      return true
    }
    return false
  })
  return completionItems
}

export async function onCompletionResolveHandler (item: CompletionItem): Promise<CompletionItem> {
  logger.debug(`[onCompletionResolve]: ${JSON.stringify(item)}`)
  // For reason, item.labelDetails disappears once the item is here.
  if (item.data?.source === spdxLicenseDescription) {
    return await getSpdxLicenseCompletionResolve(item)
  }
  return item
}
