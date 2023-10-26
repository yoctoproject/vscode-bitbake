/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { type Position } from 'vscode-languageserver'

import { generateBashEmbeddedDocument } from './bash-support'
import { generatePythonEmbeddedDocument } from './python-support'
import { embeddedDocumentsManager } from './documents-manager'
import { isInsideBashRegion, isInsidePythonRegion } from './utils'

export const generateEmbeddedDocuments = (textDocument: TextDocument): void => {
  generateBashEmbeddedDocument(textDocument)
  generatePythonEmbeddedDocument(textDocument)
}

export const getEmbeddedDocumentUriStringOnPosition = (uriString: string, position: Position): string | undefined => {
  if (isInsideBashRegion(uriString, position)) {
    const documentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(uriString, 'bash')
    return documentInfos?.uri
  }
  if (isInsidePythonRegion(uriString, position)) {
    const documentInfos = embeddedDocumentsManager.getEmbeddedDocumentInfos(uriString, 'python')
    return documentInfos?.uri
  }
  return undefined
}
