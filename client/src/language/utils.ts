/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Location, type LocationLink, type Position, Range, type Uri, type TextDocument } from 'vscode'

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

export const checkIsPositionEqual = (position1: Position, position2: Position): boolean => {
  return position1.line === position2.line && position1.character === position2.character
}

export const checkIsRangeEqual = (range1: Range, range2: Range): boolean => {
  return checkIsPositionEqual(range1.start, range2.start) && checkIsPositionEqual(range1.end, range2.end)
}

export const checkIsDefinitionUriEqual = (definition: Location | LocationLink, uri: Uri): boolean => {
  if (definition instanceof Location) {
    return definition.uri.fsPath === uri.fsPath
  }
  return definition.targetUri.fsPath === uri.fsPath
}

export const changeDefinitionUri = (definition: Location | LocationLink, uri: Uri): void => {
  if (definition instanceof Location) {
    definition.uri = uri
  } else {
    definition.targetUri = uri
  }
}

export const getDefinitionUri = (definition: Location | LocationLink): Uri => {
  if (definition instanceof Location) {
    return definition.uri
  }
  return definition.targetUri
}

export const checkIsDefinitionRangeEqual = (definition: Location | LocationLink, range: Range): boolean => {
  if (definition instanceof Location) {
    return checkIsRangeEqual(definition.range, range)
  }
  return checkIsRangeEqual(definition.targetRange, range)
}

export const convertDefinitionToLocation = (definition: Location | LocationLink): Location => {
  if (definition instanceof Location) {
    return definition
  }
  return {
    uri: definition.targetUri,
    range: definition.targetRange
  }
}

export const convertDefinitionToLocationLink = (definition: Location | LocationLink): LocationLink => {
  if (definition instanceof Location) {
    return {
      targetUri: definition.uri,
      targetRange: definition.range,
      targetSelectionRange: definition.range
    }
  }
  return definition
}

export const convertToSameDefinitionType = <DefinitionType extends Location | LocationLink>(
  referenceDefinition: DefinitionType,
  definitionToConvert: Location | LocationLink
): DefinitionType => {
  if (referenceDefinition instanceof Location) {
    return convertDefinitionToLocation(definitionToConvert) as DefinitionType
  } else {
    return convertDefinitionToLocationLink(definitionToConvert) as DefinitionType
  }
}
