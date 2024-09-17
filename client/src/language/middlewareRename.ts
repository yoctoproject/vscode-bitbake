/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type RenameMiddleware } from 'vscode-languageclient'
import { commands, workspace, WorkspaceEdit, type Range, type TextEdit } from 'vscode'

import { getEmbeddedLanguageDocPosition, getOriginalDocRange } from './utils/embeddedLanguagesUtils'
import { embeddedLanguageDocsManager } from './EmbeddedLanguageDocsManager'
import { requestsManager } from './RequestManager'

export const middlewareProvideRenameEdits: RenameMiddleware['provideRenameEdits'] = async (document, position, newName, token, next) => {
  const nextResult = await next(document, position, newName, token)
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
  const tempWorkspaceEdit = await commands.executeCommand<WorkspaceEdit>(
    'vscode.executeDocumentRenameProvider',
    embeddedLanguageDocInfos.uri,
    adjustedPosition,
    newName
  )

  const workspaceEdit = new WorkspaceEdit()

  tempWorkspaceEdit.entries().forEach(([tempUri, tempTextEdits]) => {
    const textEdits: TextEdit[] = []
    const originalUri = embeddedLanguageDocsManager.getOriginalUri(tempUri)
    if (originalUri === undefined) {
      return
    }
    tempTextEdits.forEach((tempTextEdit) => {
      const range = getOriginalDocRange(
        document,
        embeddedLanguageTextDocument,
        embeddedLanguageDocInfos.characterIndexes,
        tempTextEdit.range
      )
      if (range === undefined) {
        return
      }
      textEdits.push({
        range,
        newText: tempTextEdit.newText
      })
    })
    workspaceEdit.set(originalUri, textEdits)
  })

  return workspaceEdit
}

// It seems RenameMiddleware['prepareRename'] expects to throw an error when rename is not possible.
const invalidRenameError = new Error("The element can't be renamed.")

export const middlewarePrepareRename: RenameMiddleware['prepareRename'] = async (document, position, token, next) => {
  let nextResult: Awaited<ReturnType<typeof next>> | undefined
  try {
    nextResult = await next(document, position, token)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // pass
  }

  if (nextResult !== undefined && nextResult !== null) {
    return nextResult
  }

  const embeddedLanguageType = await requestsManager.getEmbeddedLanguageTypeOnPosition(document.uri.toString(), position)

  if (embeddedLanguageType === undefined || embeddedLanguageType === null) {
    throw invalidRenameError
  }
  const embeddedLanguageDocInfos = embeddedLanguageDocsManager.getEmbeddedLanguageDocInfos(document.uri, embeddedLanguageType)

  if (embeddedLanguageDocInfos === undefined || embeddedLanguageDocInfos === null) {
    throw invalidRenameError
  }
  const embeddedLanguageTextDocument = await workspace.openTextDocument(embeddedLanguageDocInfos.uri)
  const adjustedPosition = getEmbeddedLanguageDocPosition(
    document,
    embeddedLanguageTextDocument,
    embeddedLanguageDocInfos.characterIndexes,
    position
  )
  const tempPrepareRename = await commands.executeCommand<{ range: Range, placeholder: string } | undefined>(
    'vscode.prepareRename',
    embeddedLanguageDocInfos.uri,
    adjustedPosition
  )

  if (tempPrepareRename === undefined) {
    throw invalidRenameError
  }

  const range = getOriginalDocRange(
    document,
    embeddedLanguageTextDocument,
    embeddedLanguageDocInfos.characterIndexes,
    tempPrepareRename.range
  )

  if (range === undefined) {
    throw invalidRenameError
  }

  return {
    range,
    placeholder: tempPrepareRename.placeholder
  }
}
