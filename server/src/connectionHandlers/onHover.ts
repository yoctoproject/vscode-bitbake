/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverParams, type Hover, type MarkupKind } from 'vscode-languageserver'
import { analyzer } from '../tree-sitter/analyzer'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { logger } from '../lib/src/utils/OutputLogger'
import { DIRECTIVE_STATEMENT_KEYWORDS } from '../lib/src/types/directiveKeywords'
import path from 'path'
import type { BitbakeSymbolInformation } from '../tree-sitter/declarations'
import { extractRecipeName } from '../lib/src/utils/files'

export async function onHoverHandler (params: HoverParams): Promise<Hover | null> {
  const { position, textDocument } = params
  logger.debug(`[onHover] document uri: ${textDocument.uri} position: Line ${position.line} Column ${position.character}`)
  const word = analyzer.wordAtPoint(textDocument.uri, position.line, position.character)
  if (word === null) {
    return null
  }

  let hoverValue: string = ''
  const hoverKind: MarkupKind = 'markdown'

  // Find the exact variable at the position
  const exactSymbol = analyzer.findExactSymbolAtPoint(textDocument.uri, position, word)

  // Show documentation of a bitbake variable
  // Triggers on global declaration expressions like "VAR = 'foo'" and inside variable expansion like "FOO = ${VAR}" but skip the ones like "python VAR(){}"
  const canShowHoverDefinitionForVariableName: boolean = (analyzer.getGlobalDeclarationSymbols(textDocument.uri).some((symbol) => symbol.name === word) && analyzer.isIdentifierOfVariableAssignment(params)) || analyzer.isVariableExpansion(textDocument.uri, position.line, position.character) || analyzer.isPythonDatastoreVariable(textDocument.uri, position.line, position.character) || analyzer.isBashVariableExpansion(textDocument.uri, position.line, position.character)
  if (canShowHoverDefinitionForVariableName) {
    const found = [
      ...bitBakeDocScanner.bitbakeVariableInfo.filter((bitbakeVariable) => !bitBakeDocScanner.yoctoVariableInfo.some(yoctoVariable => yoctoVariable.name === bitbakeVariable.name)),
      ...bitBakeDocScanner.yoctoVariableInfo
    ].find((item) => item.name === word)

    if (found !== undefined) {
      logger.debug(`[onHover] Found bitbake variable: ${word}`)
      const range = analyzer.rangeForWordAtPoint(params)
      if (range === undefined) {
        logger.debug(`[onHover] Can't find the range for word: ${word}`)
        return null
      }
      const start = range.start.character
      const end = range.end.character
      if ((start > position.character) || (end <= position.character)) {
        logger.debug(`[onHover] Invalid position: Line: ${position.line} Character: ${position.character}`)
        return null
      }

      hoverValue = `**${found.name}**\n___\n${found.definition}`
    }

    const lastScanResult = analyzer.getLastScanResult(extractRecipeName(textDocument.uri))
    if (lastScanResult !== undefined && exactSymbol !== undefined) {
      const resolvedSymbol = analyzer.resolveSymbol(exactSymbol, lastScanResult.symbols)
      const foundSymbol = analyzer.matchSymbol(resolvedSymbol, lastScanResult.symbols)
      if (foundSymbol?.finalValue !== undefined) {
        if (hoverValue.split('\n___\n').length === 2) { // when the variable has a definition obtained from above
          const splitted = hoverValue.split('\n___\n')
          splitted.splice(1, 0, `**Final Value**\n___\n\t'${foundSymbol.finalValue}'`) // Alternative: use the array method toSpliced() for node.js >= 20.0.0
          hoverValue = splitted.join('\n___\n')
        } else {
          hoverValue += `**Final Value**\n___\n\t'${foundSymbol.finalValue}'`
        }
      }
    }
  }

  // Variable flag
  if (analyzer.isVariableFlag(params)) {
    const found = bitBakeDocScanner.variableFlagInfo.find(item => item.name === word)
    if (found !== undefined) {
      logger.debug(`[onHover] Found variable flag: ${found.name}`)
      hoverValue = `**${found.name}**\n___\n${found.definition}`
    }
  }

  // Yocto tasks
  if (analyzer.isFunctionIdentifier(params)) {
    const found = bitBakeDocScanner.yoctoTaskInfo.find(item => item.name === word)
    if (found !== undefined) {
      logger.debug(`[onHover] Found Yocto task: ${found.name}`)
      hoverValue = `**${found.name}**\n___\n${found.definition}`
    }
  }

  // Keywords
  const keyword = analyzer.getKeywordForPosition(textDocument.uri, position.line, position.character)
  if (keyword !== undefined && DIRECTIVE_STATEMENT_KEYWORDS.includes(word)) {
    const keywordInfo = bitBakeDocScanner.keywordInfo.find(item => item.name === word)
    if (keywordInfo !== undefined) {
      hoverValue = `**${keywordInfo.name}**\n___\n${keywordInfo.definition}`
    }
  }

  let comments: string | null = null
  if (exactSymbol !== undefined) {
    comments = getGlobalSymbolComments(textDocument.uri, word, exactSymbol)
  }

  // Append comments for symbols that don't already have documentation from Yocto/BitBake
  if (hoverValue === '' && comments !== null) {
    hoverValue += comments ?? ''
  }

  if (hoverValue !== '') {
    const hover: Hover = {
      contents: {
        kind: hoverKind,
        value: hoverValue
      }
    }
    logger.debug(`[onHover] Hover item: ${JSON.stringify(hover)}`)

    return hover
  }

  return null
}

function getGlobalSymbolComments (uri: string, word: string, currentSymbolAtPoint: BitbakeSymbolInformation): string | null {
  const localSymbolsWithComments = analyzer.getGlobalDeclarationSymbols(uri).filter((symbol) => symbol.name === word).filter((symbol) => symbol.commentsAbove.length > 0)
  const externalSymbolsWithComments: BitbakeSymbolInformation[] = []

  analyzer.getIncludeUrisForUri(uri).forEach((includeFileUri) => {
    externalSymbolsWithComments.push(...analyzer.getGlobalDeclarationSymbols(includeFileUri).filter((symbol) => symbol.name === word).filter((symbol) => symbol.commentsAbove.length > 0))
  })
  const priority = ['.bbclass', '.conf', '.inc', '.bb', '.bbappend']

  const allSymbolsWithCommentsFoundWithWord = [...localSymbolsWithComments, ...externalSymbolsWithComments]
  let finalComments: string = ''
  // higher priority comments replace lower ones
  priority.reverse().forEach((ext) => {
    const symbolsForTheExt = allSymbolsWithCommentsFoundWithWord.filter((symbol) => path.parse(symbol.location.uri).ext === ext)
    if (symbolsForTheExt.length > 0) {
      // Only show comments from one of the symbols to not flood the hover definition with comments
      const symbol = symbolsForTheExt[0]
      finalComments = `${symbol.commentsAbove.map((comment) => comment.slice(1)).join('\n')}` + `\n\nSource: ${symbol.location.uri.replace('file://', '')} \`L: ${symbol.location.range.start.line + 1}\`}`
    }
  })

  return finalComments
}
