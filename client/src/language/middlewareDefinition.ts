/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Location, Position, Range, Uri, commands, type LocationLink, type TextDocument } from 'vscode'
import { type DefinitionMiddleware } from 'vscode-languageclient'

import { getFileContent } from '../lib/src/utils/files'
import { requestsManager } from './RequestManager'
import { changeDefinitionUri, checkIsDefinitionRangeEqual, checkIsDefinitionUriEqual, convertToSameDefinitionType, getDefinitionUri, getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils'
import { type EmbeddedLanguageDocInfos } from '../lib/src/types/embedded-languages'
import { logger } from '../lib/src/utils/OutputLogger'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'

export const middlewareProvideDefinition: DefinitionMiddleware['provideDefinition'] = async (document, position, token, next) => {
  logger.debug(`[middlewareProvideDefinition] ${document.uri.toString()}, line ${position.line}, character ${position.character}`)
  const nextResult = await next(document, position, token)
  if ((Array.isArray(nextResult) && nextResult.length !== 0) || (!Array.isArray(nextResult) && nextResult !== undefined)) {
    logger.debug('[middlewareProvideDefinition] returning nextResult')
    return nextResult
  }
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return
  }
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri.toString(), embeddedLanguageType)
  logger.debug(`[middlewareProvideDefinition] embeddedLanguageDoc ${embeddedLanguageDocInfos?.uri}`)
  if (embeddedLanguageDocInfos === undefined || embeddedLanguageDocInfos === null) {
    return
  }
  const embeddedLanguageDocContent = await getFileContent(Uri.parse(embeddedLanguageDocInfos.uri).fsPath)
  if (embeddedLanguageDocContent === undefined) {
    return
  }
  const adjustedPosition = getEmbeddedLanguageDocPosition(
    document,
    embeddedLanguageDocContent,
    embeddedLanguageDocInfos.characterIndexes,
    position
  )
  const vdocUri = Uri.parse(embeddedLanguageDocInfos.uri)
  const tempResult = await commands.executeCommand<Location[] | LocationLink[]>(
    'vscode.executeDefinitionProvider',
    vdocUri,
    adjustedPosition
  )

  // This check's purpose is only to please TypeScript.
  // We'd rather have a pointless check than losing the type assurance provided by TypeScript.
  if (checkIsArrayLocation(tempResult)) {
    return await processDefinitions(tempResult, document, embeddedLanguageDocContent, embeddedLanguageDocInfos)
  } else {
    return await processDefinitions(tempResult, document, embeddedLanguageDocContent, embeddedLanguageDocInfos)
  }
}

const checkIsArrayLocation = (array: Location[] | LocationLink[]): array is Location[] => {
  return array[0] instanceof Location
}

const processDefinitions = async <DefinitionType extends Location | LocationLink>(
  definitions: DefinitionType[],
  originalTextDocument: TextDocument,
  embeddedLanguageDocContent: string,
  embeddedLanguageDocInfos: EmbeddedLanguageDocInfos
): Promise<DefinitionType[]> => {
  const result: DefinitionType[] = []
  await Promise.all(definitions.map(async (definition) => {
    if (!checkIsDefinitionUriEqual(definition, Uri.parse(embeddedLanguageDocInfos.uri))) {
      result.push(definition) // only definitions located on the embedded language documents need ajustments
      return
    }
    if (embeddedLanguageDocInfos.language === 'python') {
      for (const redirectionFunction of redirectionFunctions) {
        const redirection = await redirectionFunction(definition)
        if (redirection !== undefined) {
          result.push(...redirection)
          return
        }
      }
    }
    changeDefinitionUri(definition, originalTextDocument.uri)
    ajustDefinitionRange(definition, originalTextDocument, embeddedLanguageDocContent, embeddedLanguageDocInfos.characterIndexes)
    result.push(definition)
  }))
  return result
}

// Map the range of the definitin from the embedded language document to the original document
const ajustDefinitionRange = (
  definition: Location | LocationLink,
  originalTextDocument: TextDocument,
  embeddedLanguageDocContent: string,
  characterIndexes: number[]
): void => {
  if (definition instanceof Location) {
    const newRange = getOriginalDocRange(originalTextDocument, embeddedLanguageDocContent, characterIndexes, definition.range)
    if (newRange !== undefined) {
      definition.range = newRange
    }
  } else {
    const newTargetRange = getOriginalDocRange(originalTextDocument, embeddedLanguageDocContent, characterIndexes, definition.targetRange)
    if (newTargetRange !== undefined) {
      definition.targetRange = newTargetRange
    }
    if (definition.targetSelectionRange !== undefined) {
      const newTargetSelectionRange = getOriginalDocRange(originalTextDocument, embeddedLanguageDocContent, characterIndexes, definition.targetSelectionRange)
      if (newTargetSelectionRange !== undefined) {
        definition.targetSelectionRange = newTargetRange
      }
    }
  }
}

// Redirect a definition to an other definition
// For example, `d` of `d.getVar('')` is redirected to the definition of `data_smart.DataSmart()`
const redirectDefinition = async <DefinitionType extends Location | LocationLink>(
  initialDefinition: DefinitionType, // The definition that might be redirected
  testedRange: Range, // The range for which a redirection would be made
  redirectedPosition: Position // The new position to look at
): Promise<DefinitionType[] | undefined> => {
  if (!checkIsDefinitionRangeEqual(initialDefinition, testedRange)) {
    return
  }
  const uri = getDefinitionUri(initialDefinition)
  const redirectedResult = await commands.executeCommand<Location[] | LocationLink[]>(
    'vscode.executeDefinitionProvider',
    uri,
    redirectedPosition
  )
  // The middleware is expecting to return `Location[] | LocationLink[]`, not `(Location | LocationLink)[]`
  // Ensure all the new definitions have the same type has the reference definition
  return redirectedResult.map((redirectedDefinition) => convertToSameDefinitionType(initialDefinition, redirectedDefinition))
}

export const dRange = new Range(2, 0, 2, 1) // Where `d` is located in the embedded language document
export const dataSmartPosition = new Position(2, 19) // Where `DataSmart` (data_smart.DataSmart()) is reachable in the embedded language document

// Handle `d` in `d.getVar('')`
const getDefinitionOfD = async <DefinitionType extends Location | LocationLink>(
  definition: DefinitionType
): Promise<DefinitionType[] | undefined> => {
  return await redirectDefinition(definition, dRange, dataSmartPosition)
}

export const eRange = new Range(4, 0, 4, 1) // Where `e` is located in the embedded language document
export const eventPosition = new Position(4, 12) // Where `Event` (event.Event()) is reachable in the embedded language document

// Handle `e` in `e.data.getVar('')`
const getDefinitionOfE = async <DefinitionType extends Location | LocationLink>(
  definition: DefinitionType
): Promise<DefinitionType[] | undefined> => {
  return await redirectDefinition(definition, eRange, eventPosition)
}

const redirectionFunctions = [getDefinitionOfD, getDefinitionOfE]
