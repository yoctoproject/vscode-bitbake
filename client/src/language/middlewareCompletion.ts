/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type CompletionList, Uri, commands, Range } from 'vscode'
import { type CompletionMiddleware } from 'vscode-languageclient/node'

import { requestsManager } from './RequestManager'
import { getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils'
import { getFileContent } from '../lib/src/utils/files'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'

export const middlewareProvideCompletion: CompletionMiddleware['provideCompletionItem'] = async (document, position, context, token, next) => {
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return await next(document, position, context, token)
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
  const result = await commands.executeCommand<CompletionList>(
    'vscode.executeCompletionItemProvider',
    vdocUri,
    adjustedPosition,
    context.triggerCharacter
  )
  result.items.forEach((item) => {
    if (item.range === undefined) {
      // pass
    } else if (item.range instanceof Range) {
      item.range = getOriginalDocRange(document, embeddedLanguageDocContent, embeddedLanguageDocInfos.characterIndexes, item.range)
    } else {
      const inserting = getOriginalDocRange(document, embeddedLanguageDocContent, embeddedLanguageDocInfos.characterIndexes, item.range.inserting)
      const replacing = getOriginalDocRange(document, embeddedLanguageDocContent, embeddedLanguageDocInfos.characterIndexes, item.range.replacing)
      if (inserting === undefined || replacing === undefined) {
        return
      }
      item.range = { inserting, replacing }
    }
  })
  return result
}
