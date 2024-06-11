/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type ReferencesMiddleware } from 'vscode-languageclient'
import { type EmbeddedLanguageDocInfos, embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { requestsManager } from './RequestManager'
import { type Location, commands, workspace, type TextDocument } from 'vscode'
import { getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils/embeddedLanguagesUtils'
import { mergeArraysDistinctly } from '../lib/src/utils/arrays'

export const middlewareProvideReferences: ReferencesMiddleware['provideReferences'] = async (document, position, options, token, next) => {
  const nextResult = await next(document, position, options, token) ?? []
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return nextResult
  }
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri, embeddedLanguageType)
  if (embeddedLanguageDocInfos === undefined || embeddedLanguageDocInfos === null) {
    return nextResult
  }
  const embeddedLanguageTextDocument = await workspace.openTextDocument(embeddedLanguageDocInfos.uri)
  const adjustedPosition = getEmbeddedLanguageDocPosition(
    document,
    embeddedLanguageTextDocument,
    embeddedLanguageDocInfos.characterIndexes,
    position
  )
  const dirtyForwardedResults = await commands.executeCommand<Location[]>(
    'vscode.executeReferenceProvider',
    embeddedLanguageDocInfos.uri,
    adjustedPosition
  )

  const forwardedResults = processReferences(dirtyForwardedResults, document, embeddedLanguageTextDocument, embeddedLanguageDocInfos)

  const result = mergeArraysDistinctly(
    // There can't be two different references with the same "start" position
    (location) => `${location.uri.toString()}${location.range.start.line}${location.range.start.character}`,
    nextResult,
    forwardedResults
  )

  return result
}

const processReferences = (
  references: Location[],
  originalTextDocument: TextDocument,
  embeddedLanguageTextDocument: TextDocument,
  embeddedLanguageDocInfos: EmbeddedLanguageDocInfos
): Location[] => {
  const result: Location[] = []
  references.forEach((reference) => {
    if (reference.uri.fsPath !== embeddedLanguageDocInfos.uri.fsPath) {
      if (reference.uri.fsPath.includes(embeddedLanguageDocsManager.embeddedLanguageDocsFolder as string)) {
        // This is a reference to an other embedded language document. It has to be ignored.
        return
      }
      // only references located on the embedded language documents need ajustments
      result.push(reference)
      return
    }
    reference.uri = originalTextDocument.uri

    const adjustedRange = getOriginalDocRange(
      originalTextDocument,
      embeddedLanguageTextDocument,
      embeddedLanguageDocInfos.characterIndexes,
      reference.range
    )

    if (adjustedRange === undefined) {
      return
    }
    reference.range = adjustedRange
    result.push(reference)
  })

  return result
}
