/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverMiddleware } from 'vscode-languageclient'
import { type Hover, commands, workspace } from 'vscode'

import { getEmbeddedLanguageDocPosition } from './utils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { requestsManager } from './RequestManager'

export const middlewareProvideHover: HoverMiddleware['provideHover'] = async (document, position, token, next) => {
  const nextResult = await next(document, position, token)
  if (nextResult !== undefined) {
    return nextResult
  }
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return
  }
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri.toString(), embeddedLanguageType)
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
  const result = await commands.executeCommand<Hover[]>(
    'vscode.executeHoverProvider',
    embeddedLanguageDocInfos.uri,
    adjustedPosition
  )
  return result[0]
}
