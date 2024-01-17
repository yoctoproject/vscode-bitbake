/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverMiddleware } from 'vscode-languageclient'
import { type Hover, commands, workspace, MarkdownString, type TextDocument } from 'vscode'

import { getEmbeddedLanguageDocPosition } from './utils'
import { type EmbeddedLanguageDocInfos, embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { requestsManager } from './RequestManager'
import path from 'path'

export const middlewareProvideHover: HoverMiddleware['provideHover'] = async (document, position, token, next) => {
  const nextResult = await next(document, position, token)
  if (nextResult !== undefined && nextResult !== null) {
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
  const hovers = await commands.executeCommand<Hover[]>(
    'vscode.executeHoverProvider',
    embeddedLanguageDocInfos.uri,
    adjustedPosition
  )
  const selectedHover = hovers.find((hover) => {
    const contents = hover.contents
    return contents.find((content) => {
      if (content instanceof MarkdownString) {
        return content.value !== ''
      }
      return content !== ''
    })
  })
  if (selectedHover !== undefined) {
    fixBashIdeRelativePath(selectedHover, embeddedLanguageDocInfos, document)
  }
  return selectedHover
}

// Bash IDE gives relative paths relative to the embedded language document. This path does not make any sense to the user.
// This makes the path relative to the document the user is looking at instead.
const fixBashIdeRelativePath = (hover: Hover, embeddedLanguageDocInfos: EmbeddedLanguageDocInfos, document: TextDocument): void => {
  if (embeddedLanguageDocInfos.language !== 'bash') {
    return
  }

  hover.contents.forEach((content) => {
    if (content instanceof MarkdownString) {
      // ex: Function: **bbwarn** - *defined in ../../../../../../../../../poky/meta/classes-global/logging.bbclass*
      const match = content.value.match(/^Function: \*\*\b\w+\b\*\* - \*defined in (?<path>.*\.bbclass)\*/)
      const wrongRelativePath = match?.groups?.path
      if (wrongRelativePath === undefined) {
        return
      }
      const absolutePath = path.resolve(path.dirname(embeddedLanguageDocInfos.uri.fsPath), wrongRelativePath)
      const fixedRelativePath = path.relative(path.dirname(document.uri.fsPath), absolutePath)
      content.value = content.value.replace(wrongRelativePath, fixedRelativePath)
    }
  })
}
