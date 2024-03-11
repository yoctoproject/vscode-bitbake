/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Location, type LocationLink, type Range, type Uri } from 'vscode'

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
    return definition.range.isEqual(range)
  }
  return definition.targetRange.isEqual(range)
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
