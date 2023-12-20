/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverParams, type Hover } from 'vscode-languageserver'
import { analyzer } from '../tree-sitter/analyzer'
import { bitBakeDocScanner } from '../BitBakeDocScanner'
import { logger } from '../lib/src/utils/OutputLogger'
import { DIRECTIVE_STATEMENT_KEYWORDS } from '../lib/src/types/directiveKeywords'

export async function onHoverHandler (params: HoverParams): Promise<Hover | null> {
  const { position, textDocument } = params
  logger.debug(`[onHover] document uri: ${textDocument.uri} position: Line ${position.line} Column ${position.character}`)
  const word = analyzer.wordAtPoint(textDocument.uri, position.line, position.character)
  if (word === null) {
    return null
  }
  // Show documentation of a bitbake variable
  // Triggers on global declaration expressions like "VAR = 'foo'" and inside variable expansion like "FOO = ${VAR}" but skip the ones like "python VAR(){}"
  const canShowHoverDefinitionForVariableName: boolean = (analyzer.getGlobalDeclarationSymbols(textDocument.uri).some((symbol) => symbol.name === word) && analyzer.isIdentifierOfVariableAssignment(params)) || analyzer.isVariableExpansion(textDocument.uri, position.line, position.character) || analyzer.isPythonDatastoreVariable(textDocument.uri, position.line, position.character)
  if (canShowHoverDefinitionForVariableName) {
    const found = [
      ...bitBakeDocScanner.bitbakeVariableInfo.filter((bitbakeVariable) => !bitBakeDocScanner.yoctoVariableInfo.some(yoctoVariable => yoctoVariable.name === bitbakeVariable.name)),
      ...bitBakeDocScanner.yoctoVariableInfo
    ].find((item) => item.name === word)

    if (found === undefined) {
      logger.debug(`[onHover] Not a bitbake variable: ${word}`)
      return null
    }
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

    const hover: Hover = {
      contents: {
        kind: 'markdown',
        value: `**${found.name}**\n___\n${found.definition}`
      }
    }
    logger.debug(`[onHover] Hover item: ${JSON.stringify(hover)}`)
    return hover
  }

  // Variable flag
  if (analyzer.isVariableFlag(params)) {
    const found = bitBakeDocScanner.variableFlagInfo.find(item => item.name === word)
    if (found === undefined) {
      return null
    }
    logger.debug(`[onHover] Found variable flag: ${found.name}`)
    const hover: Hover = {
      contents: {
        kind: 'markdown',
        value: `**${found.name}**\n___\n${found.definition}`
      }
    }
    logger.debug(`[onHover] Hover item: ${JSON.stringify(hover)}`)
    return hover
  }

  // Yocto tasks
  if (analyzer.isFunctionIdentifier(params)) {
    const found = bitBakeDocScanner.yoctoTaskInfo.find(item => item.name === word)
    if (found === undefined) {
      return null
    }
    logger.debug(`[onHover] Found Yocto task: ${found.name}`)
    const hover: Hover = {
      contents: {
        kind: 'markdown',
        value: `**${found.name}**\n___\n${found.definition}`
      }
    }
    logger.debug(`[onHover] Hover item: ${JSON.stringify(hover)}`)
    return hover
  }

  // Keywords
  const keyword = analyzer.getKeywordForPosition(textDocument.uri, position.line, position.character)
  if (keyword !== undefined && DIRECTIVE_STATEMENT_KEYWORDS.includes(word)) {
    const keywordInfo = bitBakeDocScanner.keywordInfo.find(item => item.name === word)
    if (keywordInfo === undefined) {
      return null
    }
    return {
      contents: {
        kind: 'markdown',
        value: `**${keywordInfo.name}**\n___\n${keywordInfo.definition}`
      }
    }
  }

  return null
}
