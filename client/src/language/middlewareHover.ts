/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverMiddleware } from 'vscode-languageclient'
import { type Hover, Uri, commands } from 'vscode'

import { requestsManager } from './RequestManager'
import { getEmbeddedLanguageDocPosition } from './utils'

export const middlewareProvideHover: HoverMiddleware['provideHover'] = async (document, position, token, next) => {
  const embeddedLanguageDocInfos = await requestsManager.getEmbeddedLanguageDocInfos(document.uri.toString(), position)
  if (embeddedLanguageDocInfos === undefined) {
    return await next(document, position, token)
  }
  const adjustedPosition = await getEmbeddedLanguageDocPosition(document, embeddedLanguageDocInfos, position)
  const vdocUri = Uri.parse(embeddedLanguageDocInfos.uri)
  const result = await commands.executeCommand<Hover[]>(
    'vscode.executeHoverProvider',
    vdocUri,
    adjustedPosition
  )
  return result[0]
}
