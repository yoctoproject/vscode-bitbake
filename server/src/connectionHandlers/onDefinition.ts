/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { logger } from '../lib/src/utils/OutputLogger'
import { type TextDocumentPositionParams, type Definition } from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import contextHandler from '../ContextHandler'

export function onDefinitionHandler (textDocumentPositionParams: TextDocumentPositionParams): Definition | null {
  const { textDocument, position } = textDocumentPositionParams
  logger.debug(`[onDefinition] Position: Line ${position.line} Character ${position.character}`)

  const documentAsText = analyzer.getDocumentTexts(textDocument.uri)
  if (documentAsText === undefined) {
    logger.debug(`[onDefinition] Document not found for ${textDocument.uri}`)
    return []
  }

  // require, inherit & include directives
  const directiveStatementKeyword = analyzer.getDirectiveStatementKeywordByNodeType(textDocumentPositionParams)
  if (directiveStatementKeyword !== undefined) {
    logger.debug(`[onDefinition] Found directive: ${directiveStatementKeyword}`)
    const definition = contextHandler.getDefinitionForDirectives(directiveStatementKeyword, textDocumentPositionParams, documentAsText)
    logger.debug(`[onDefinition] definition item: ${JSON.stringify(definition)}`)
    return definition
  }

  return contextHandler.getDefinition(textDocumentPositionParams, documentAsText)
}
