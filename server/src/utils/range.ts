/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position, type Range } from 'vscode-languageserver'

export const positionIsAfterOrEqual = (position: Position, other: Position): boolean => {
  if (position.line > other.line) {
    return true
  }
  if (position.line === other.line && position.character >= other.character) {
    return true
  }
  return false
}

export const positionIsBeforeOrEqual = (position: Position, other: Position): boolean => {
  if (position.line < other.line) {
    return true
  }
  if (position.line === other.line && position.character <= other.character) {
    return true
  }
  return false
}

export const positionIsWithinRange = (position: Position, range: Range): boolean => {
  const { start, end } = range
  return positionIsAfterOrEqual(position, start) && positionIsBeforeOrEqual(position, end)
}
