/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument, type Position, workspace } from 'vscode'

import { type EmbeddedLanguageDocInfos } from '../lib/src/types/embedded-languages'

export const getEmbeddedLanguageDocPosition = async (
  originalTextDocument: TextDocument,
  embeddedLanguageDocInfos: EmbeddedLanguageDocInfos,
  originalPosition: Position
): Promise<Position> => {
  const originalOffset = originalTextDocument.offsetAt(originalPosition)
  const embeddedLanguageDocOffset = embeddedLanguageDocInfos.characterIndexes[originalOffset]
  const embeddedLanguageDoc = await workspace.openTextDocument(embeddedLanguageDocInfos.uri.replace('file://', ''))
  return embeddedLanguageDoc.positionAt(embeddedLanguageDocOffset)
}
