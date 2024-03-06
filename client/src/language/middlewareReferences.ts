/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type ReferencesMiddleware } from 'vscode-languageclient'
import { type EmbeddedLanguageDocInfos, embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { requestsManager } from './RequestManager'
import { type Location, commands, workspace, type TextDocument } from 'vscode'
import { getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils'

export const middlewareProvideReferences: ReferencesMiddleware['provideReferences'] = async (document, position, options, token, next) => {
  const nextResult = await next(document, position, options, token)
  if (nextResult !== undefined && nextResult !== null) {
    return nextResult
  }
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return
  }
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri, embeddedLanguageType)
  if (embeddedLanguageDocInfos === undefined || embeddedLanguageDocInfos === null) {
    return
  }
  const embeddedLanguageTextDocument = await workspace.openTextDocument(embeddedLanguageDocInfos.uri)
  const adjustedPosition = getEmbeddedLanguageDocPosition(
    document,
    embeddedLanguageTextDocument,
    embeddedLanguageDocInfos.characterIndexes,
    position
  )
  const tempResult = await commands.executeCommand<Location[]>(
    'vscode.executeReferenceProvider',
    embeddedLanguageDocInfos.uri,
    adjustedPosition
  )

  return processReferences(tempResult, document, embeddedLanguageTextDocument, embeddedLanguageDocInfos)
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

    const newRange = getOriginalDocRange(
      originalTextDocument,
      embeddedLanguageTextDocument,
      embeddedLanguageDocInfos.characterIndexes,
      reference.range
    )

    if (newRange === undefined) {
      return
    }
    reference.range = newRange
    result.push(reference)
  })

  return result
}
