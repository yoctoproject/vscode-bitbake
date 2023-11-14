/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fs from 'fs'

import { type TextDocument, Position } from 'vscode'

import { type EmbeddedLanguageDocInfos } from '../lib/src/types/embedded-languages'
import { logger } from '../lib/src/utils/OutputLogger'

export const getEmbeddedLanguageDocPosition = async (
  originalTextDocument: TextDocument,
  embeddedLanguageDocInfos: EmbeddedLanguageDocInfos,
  originalPosition: Position
): Promise<Position | undefined> => {
  const originalOffset = originalTextDocument.offsetAt(originalPosition)
  const embeddedLanguageDocOffset = embeddedLanguageDocInfos.characterIndexes[originalOffset]
  try {
    const embeddedLanguageDocContent = await new Promise<string>((resolve, reject) => {
      fs.readFile(embeddedLanguageDocInfos.uri.replace('file://', ''), { encoding: 'utf-8' },
        (error, data) => { error !== null ? reject(error) : resolve(data) }
      )
    })
    return getPosition(embeddedLanguageDocContent, embeddedLanguageDocOffset)
  } catch (error) {
    logger.error(`Failed to get embedded language document position: ${error as any}`)
    return undefined
  }
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
