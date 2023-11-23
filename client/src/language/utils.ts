/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, Range, type TextDocument } from 'vscode'

export const getOriginalDocRange = (
  originalTextDocument: TextDocument,
  embeddedLanguageDocContent: string,
  characterIndexes: number[],
  embeddedRange: Range
): Range | undefined => {
  const start = getOriginalDocPosition(originalTextDocument, embeddedLanguageDocContent, characterIndexes, embeddedRange.start)
  const end = getOriginalDocPosition(originalTextDocument, embeddedLanguageDocContent, characterIndexes, embeddedRange.end)
  if (start === undefined || end === undefined) {
    return
  }
  return new Range(start, end)
}

const getOriginalDocPosition = (
  originalTextDocument: TextDocument,
  embeddedLanguageDocContent: string,
  characterIndexes: number[],
  embeddedPosition: Position
): Position | undefined => {
  const embeddedLanguageOffset = getOffset(embeddedLanguageDocContent, embeddedPosition)
  const originalOffset = characterIndexes.findIndex(index => index === embeddedLanguageOffset)
  if (originalOffset === -1) {
    return
  }
  return originalTextDocument.positionAt(originalOffset)
}

export const getEmbeddedLanguageDocPosition = (
  originalTextDocument: TextDocument,
  embeddedLanguageDocContent: string,
  characterIndexes: number[],
  originalPosition: Position
): Position => {
  const originalOffset = originalTextDocument.offsetAt(originalPosition)
  const embeddedLanguageDocOffset = characterIndexes[originalOffset]
  return getPosition(embeddedLanguageDocContent, embeddedLanguageDocOffset)
}

const getPosition = (documentContent: string, offset: number): Position => {
  let line = 0
  let character = 0
  for (let i = 0; i < offset; i++) {
    if (documentContent[i] === '\n') {
      line++
      character = 0
    } else {
      character++
    }
  }
  return new Position(line, character)
}

const getOffset = (documentContent: string, position: Position): number => {
  let offset = 0
  for (let i = 0; i < position.line; i++) {
    offset = documentContent.indexOf('\n', offset) + 1
  }
  offset += position.character
  return offset
}
