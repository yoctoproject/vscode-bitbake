/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position, Range, type TextDocument } from 'vscode'

export const getOriginalDocRange = (
  originalTextDocument: TextDocument,
  embeddedLanguageTextDocument: TextDocument,
  characterIndexes: number[],
  embeddedRange: Range
): Range | undefined => {
  const start = getOriginalDocPosition(originalTextDocument, embeddedLanguageTextDocument, characterIndexes, embeddedRange.start)
  const end = getOriginalDocPosition(originalTextDocument, embeddedLanguageTextDocument, characterIndexes, embeddedRange.end)
  if (start === undefined || end === undefined) {
    return
  }
  return new Range(start, end)
}

const getOriginalDocPosition = (
  originalTextDocument: TextDocument,
  embeddedLanguageTextDocument: TextDocument,
  characterIndexes: number[],
  embeddedPosition: Position
): Position | undefined => {
  const embeddedLanguageOffset = embeddedLanguageTextDocument.offsetAt(embeddedPosition)
  const originalOffset = characterIndexes.findIndex(index => index === embeddedLanguageOffset)
  if (originalOffset === -1) {
    return
  }
  return originalTextDocument.positionAt(originalOffset)
}

export const getEmbeddedLanguageDocPosition = (
  originalTextDocument: TextDocument,
  embeddedLanguageTextDocument: TextDocument,
  characterIndexes: number[],
  originalPosition: Position
): Position => {
  const originalOffset = originalTextDocument.offsetAt(originalPosition)
  const embeddedLanguageDocOffset = characterIndexes[originalOffset]
  return embeddedLanguageTextDocument.positionAt(embeddedLanguageDocOffset)
}
