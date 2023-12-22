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
import { type GlobalSymbolComments } from '../tree-sitter/declarations'

export async function onHoverHandler (params: HoverParams): Promise<Hover | null> {
  const { position, textDocument } = params
  logger.debug(`[onHover] document uri: ${textDocument.uri} position: Line ${position.line} Column ${position.character}`)
  const word = analyzer.wordAtPoint(textDocument.uri, position.line, position.character)
  if (word === null) {
    return null
  }

  let hoverValue: string = ''
  const hoverKind: MarkupKind = 'markdown'

  // Show documentation of a bitbake variable
  // Triggers on global declaration expressions like "VAR = 'foo'" and inside variable expansion like "FOO = ${VAR}" but skip the ones like "python VAR(){}"
  const canShowHoverDefinitionForVariableName: boolean = (analyzer.getGlobalDeclarationSymbols(textDocument.uri).some((symbol) => symbol.name === word) && analyzer.isIdentifierOfVariableAssignment(params)) || analyzer.isVariableExpansion(textDocument.uri, position.line, position.character) || analyzer.isPythonDatastoreVariable(textDocument.uri, position.line, position.character)
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

  const comments = getGlobalSymbolComments(textDocument.uri, word)

  // Append comments for variables or tasks that don't have documentation from Yocto/BitBake
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

function getGlobalSymbolComments (uri: string, word: string): string | null {
  if (analyzer.getGlobalDeclarationSymbols(uri).some((symbol) => symbol.name === word)) {
    const analyzedDocument = analyzer.getAnalyzedDocument(uri)
    const symbolComments = analyzedDocument?.globalSymbolComments
    const includeFileUris = analyzedDocument?.includeFileUris
    if (symbolComments === undefined) {
      return null
    }
    if (symbolComments[word] !== undefined) {
      const localCommentsForSymbol = symbolComments[word]

      const otherCommentsForSymbol: GlobalSymbolComments[string] = []
      includeFileUris?.forEach((includeFileUri) => {
        const analyzedDocumentForIncludeFile = analyzer.getAnalyzedDocument(includeFileUri)
        const symbolCommentsForIncludeFile = analyzedDocumentForIncludeFile?.globalSymbolComments
        if (symbolCommentsForIncludeFile !== undefined) {
          otherCommentsForSymbol.push(...(symbolCommentsForIncludeFile[word] ?? []))
        }
      })
      const priority = ['.bbclass', '.conf', '.inc', '.bb', '.bbappend']

      const allCommentsForSymbol = [...localCommentsForSymbol, ...otherCommentsForSymbol]
      let commentsToShow: GlobalSymbolComments[string] = []
      // higher priority comments replace lower ones
      priority.reverse().forEach((ext) => {
        const commentsForExt = allCommentsForSymbol.filter((item) => path.parse(item.uri).ext === ext)
        if (commentsForExt.length > 0) {
          commentsToShow = commentsForExt
        }
      })

      if (commentsToShow.length > 0) {
        return `${commentsToShow.map((item) => item.comments.map(comment => comment.slice(1)).join('\n') + `\n\nSource: ${item.uri.replace('file://', '')} \`L: ${item.line + 1}\``).join('\n___\n')}`
      }
    }
  }

  return null
}
