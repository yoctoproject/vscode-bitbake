/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import logger from 'winston'
import { type TextDocumentPositionParams, type Definition } from 'vscode-languageserver/node'
import { analyzer } from '../tree-sitter/analyzer'
import contextHandler from '../ContextHandler'

export function onDefinitionHandler (textDocumentPositionParams: TextDocumentPositionParams): Definition {
  logger.debug(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`)
  const documentAsText = analyzer.getDocumentTexts(textDocumentPositionParams.textDocument.uri)

  if (documentAsText === undefined) {
    return []
  }

  return contextHandler.getDefinition(textDocumentPositionParams, documentAsText)
}
