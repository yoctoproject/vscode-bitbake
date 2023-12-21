/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Location, type LocationLink, type Position, type Range, type Uri } from 'vscode'

export const checkIsPositionEqual = (position1: Position, position2: Position): boolean => {
  return position1.line === position2.line && position1.character === position2.character
}

export const checkIsRangeEqual = (range1: Range, range2: Range): boolean => {
  return checkIsPositionEqual(range1.start, range2.start) && checkIsPositionEqual(range1.end, range2.end)
}

export const getDefinitionUri = (definition: Location | LocationLink): Uri => {
  if (definition instanceof Location) {
    return definition.uri
  }
  return definition.targetUri
}
