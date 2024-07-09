/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position, type Range, type TextDocument } from 'vscode-languageserver-textdocument'
import { getLine } from '../utils/textDocument'

export const getRangeOfTextToReplace = (
  document: TextDocument,
  position: Position,
  boundRegex: RegExp = /\s|'|"/
): Range => {
  const line = getLine(document, position.line)

  const baseIndex = position.character

  let startIndex = baseIndex
  while (startIndex > 0 && !boundRegex.test(line[startIndex - 1])) {
    startIndex--
  }

  let endIndex = baseIndex
  while (endIndex < line.length && !boundRegex.test(line[endIndex])) {
    endIndex++
  }

  return {
    start: {
      line: position.line,
      character: startIndex
    },
    end: {
      line: position.line,
      character: endIndex
    }
  }
}
