/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type HoverMiddleware } from 'vscode-languageclient'
import { type Hover, commands, workspace, MarkdownString, type TextDocument, Position } from 'vscode'

import { getEmbeddedLanguageDocPosition, getOriginalDocPosition } from './utils'
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
    fixBashIdeIssue(selectedHover, embeddedLanguageDocInfos, document, embeddedLanguageTextDocument)
  }
  return selectedHover
}

const fixBashIdeIssue = (hover: Hover, embeddedLanguageDocInfos: EmbeddedLanguageDocInfos, document: TextDocument, embeddedLanguageTextDocument: TextDocument): void => {
  if (embeddedLanguageDocInfos.language !== 'bash') {
    return
  }

  hover.contents.forEach((content) => {
    if (content instanceof MarkdownString) {
      fixBashIdeRelativePath(content, embeddedLanguageDocInfos, document)
      fixBashIdeLine(content, embeddedLanguageDocInfos, document, embeddedLanguageTextDocument)
    }
  })
}

// Bash IDE gives relative paths relative to the embedded language document. This path does not make any sense to the user.
// This makes the path relative to the document the user is looking at instead.
const fixBashIdeRelativePath = (content: MarkdownString, embeddedLanguageDocInfos: EmbeddedLanguageDocInfos, document: TextDocument): void => {
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

const fixBashIdeLine = (content: MarkdownString, embeddedLanguageDocInfos: EmbeddedLanguageDocInfos, document: TextDocument, embeddedLanguageTextDocument: TextDocument): void => {
  // ex: Function: **bbwarn** - *defined on line 12*
  const match = content.value.match(/^(Function|Variable): \*\*\b\w+\b\*\* - \*defined on line (?<line>\d+)/)
  const wrongLine = match?.groups?.line
  if (wrongLine === undefined) {
    return
  }
  const fixedPosition = getOriginalDocPosition(document, embeddedLanguageTextDocument, embeddedLanguageDocInfos.characterIndexes, new Position(parseInt(wrongLine) - 1, 0))
  if (fixedPosition === undefined) {
    return
  }
  const fixedLine = fixedPosition.line + 1
  content.value = content.value.replace(wrongLine, fixedLine.toString())
}
