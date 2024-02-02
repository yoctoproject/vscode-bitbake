/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type CompletionList, commands, Range, workspace } from 'vscode'
import { type CompletionMiddleware } from 'vscode-languageclient/node'

import { requestsManager } from './RequestManager'
import { getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'

export const middlewareProvideCompletion: CompletionMiddleware['provideCompletionItem'] = async (document, position, context, token, next) => {
  const nextResult = await next(document, position, context, token)
  if (Array.isArray(nextResult) && nextResult.length > 0) {
    return nextResult
  }
  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)
  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    return await next(document, position, context, token)
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
  const vdocUri = embeddedLanguageTextDocument.uri
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
      item.range = getOriginalDocRange(document, embeddedLanguageTextDocument, embeddedLanguageDocInfos.characterIndexes, item.range)
    } else {
      const inserting = getOriginalDocRange(document, embeddedLanguageTextDocument, embeddedLanguageDocInfos.characterIndexes, item.range.inserting)
      const replacing = getOriginalDocRange(document, embeddedLanguageTextDocument, embeddedLanguageDocInfos.characterIndexes, item.range.replacing)
      if (inserting === undefined || replacing === undefined) {
        return
      }
      item.range = { inserting, replacing }
    }
  })
  return result
}
