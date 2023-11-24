/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverMiddleware } from 'vscode-languageclient'
import { type Hover, Uri, commands } from 'vscode'

import { getEmbeddedLanguageDocPosition } from './utils'
import { getFileContent } from '../lib/src/utils/files'
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
  const result = await commands.executeCommand<Hover[]>(
    'vscode.executeHoverProvider',
    vdocUri,
    adjustedPosition
  )
  return result[0]
}
