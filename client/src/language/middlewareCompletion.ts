/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type CompletionList, Uri, commands } from 'vscode'
import { type CompletionMiddleware } from 'vscode-languageclient/node'

import { requestsManager } from './RequestManager'

export const middlewareProvideCompletion: CompletionMiddleware['provideCompletionItem'] = async (document, position, context, token, next) => {
  const embeddedLanguageDocInfos = await requestsManager.getEmbeddedLanguageDocInfos(document.uri.toString(), position)
  if (embeddedLanguageDocInfos === undefined) {
    return await next(document, position, context, token)
  }
  const adjustedPosition = {
    ...position,
    line: position.line + embeddedLanguageDocInfos.lineOffset
  }
  const vdocUri = Uri.parse(embeddedLanguageDocInfos.uri)
  const result = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    adjustedPosition,
    context.triggerCharacter
  )
  return result
}
