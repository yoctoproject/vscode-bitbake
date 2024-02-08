/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'

import { type EmbeddedLanguageDoc, type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { logger } from '../lib/src/utils/OutputLogger'
import { Range, Uri, WorkspaceEdit, workspace } from 'vscode'
import { hashString } from '../lib/src/utils/hash'

const EMBEDDED_DOCUMENTS_FOLDER = 'embedded-documents'

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
}

export interface EmbeddedLanguageDocInfos {
  uri: Uri
  originalUri: Uri
  language: EmbeddedLanguageType
  characterIndexes: number[]
}
export default class EmbeddedLanguageDocsManager {
  private readonly embeddedLanguageDocsInfosMap = new Map<string, EmbeddedLanguageDocInfos>() // map of the embedded document name with its infos
  private _storagePath: string | undefined
  private readonly filesWaitingToUpdate = new Map<string, EmbeddedLanguageDoc>()

  get storagePath (): string | undefined {
    return this._storagePath
  }

  get embeddedLanguageDocsFolder (): string | undefined {
    if (this._storagePath === undefined) {
      return
    }
    return path.join(this._storagePath, EMBEDDED_DOCUMENTS_FOLDER)
  }

  async setStoragePath (newStoragePath: string | undefined): Promise<void> {
    logger.debug(`Set embedded language documents storage path. New: ${newStoragePath}. Old: ${this._storagePath}`)
    this._storagePath = newStoragePath // also changes the value of this.embeddedLanguageDocsFolder
    await new Promise<void>((resolve) => {
      if (this.embeddedLanguageDocsFolder === undefined) {
        return
      }
      fs.mkdir(this.embeddedLanguageDocsFolder, { recursive: true }, (err) => {
        if (err !== null) {
          logger.error(`Failed to create embedded language documents folder: ${err as any}`)
        }
        resolve()
      })
    })
  }

  private registerEmbeddedLanguageDocInfos (embeddedLanguageDoc: EmbeddedLanguageDoc, uri: Uri): void {
    const embeddedLanguageDocInfos: EmbeddedLanguageDocInfos = {
      ...embeddedLanguageDoc,
      uri,
      originalUri: Uri.parse(embeddedLanguageDoc.originalUri)
    }
    this.embeddedLanguageDocsInfosMap.set(uri.toString(), embeddedLanguageDocInfos)
  }

  getEmbeddedLanguageDocInfos (
    originalUri: Uri,
    languageType: EmbeddedLanguageType
  ): EmbeddedLanguageDocInfos | undefined {
    const embeddedLanguageDocumentUri = this.getEmbeddedLanguageDocUri(originalUri, languageType)
    if (embeddedLanguageDocumentUri === undefined) {
      return undefined
    }
    return this.embeddedLanguageDocsInfosMap.get(embeddedLanguageDocumentUri.toString())
  }

  getOriginalUri (embeddedLanguageDocUri: Uri): Uri | undefined {
    return this.embeddedLanguageDocsInfosMap.get(embeddedLanguageDocUri.toString())?.originalUri
  }

  private getEmbeddedLanguageDocUri (originalUri: Uri, languageType: EmbeddedLanguageType): Uri | undefined {
    if (this.embeddedLanguageDocsFolder === undefined) {
      return undefined
    }
    const hashedName = hashString(originalUri.toString())
    const fileExtension = fileExtensionsMap[languageType]
    const embeddedLanguageDocFilename = hashedName + fileExtension
    const pathToEmbeddedLanguageDocsFolder = this.embeddedLanguageDocsFolder
    return Uri.parse(`file://${pathToEmbeddedLanguageDocsFolder}/${embeddedLanguageDocFilename}`)
  }

  async saveEmbeddedLanguageDocs (
    embeddedLanguageDocs: EmbeddedLanguageDoc[]
  ): Promise<void> {
    await Promise.all(embeddedLanguageDocs.map(async (embeddedLanguageDoc) => {
      await this.saveEmbeddedLanguageDoc(embeddedLanguageDoc)
    }))
  }

  private async updateEmbeddedLanguageDocFile (embeddedLanguageDoc: EmbeddedLanguageDoc, uri: Uri): Promise<void> {
    const document = await workspace.openTextDocument(uri)
    if (document.isDirty) {
      this.filesWaitingToUpdate.set(uri.toString(), embeddedLanguageDoc)
      return
    }
    const fullRange = new Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    )
    const workspaceEdit = new WorkspaceEdit()
    workspaceEdit.replace(uri, fullRange, embeddedLanguageDoc.content)
    await workspace.applyEdit(workspaceEdit)
    // Sometimes document closes before the saving, so we open it again just in case
    await workspace.openTextDocument(uri)
    await document.save()
    this.registerEmbeddedLanguageDocInfos(embeddedLanguageDoc, uri)
    const fileWaitingToUpdate = this.filesWaitingToUpdate.get(uri.toString())
    if (fileWaitingToUpdate !== undefined) {
      this.filesWaitingToUpdate.delete(uri.toString())
      await this.updateEmbeddedLanguageDocFile(fileWaitingToUpdate, uri)
    }
  }

  private async createEmbeddedLanguageDocFile (embeddedLanguageDoc: EmbeddedLanguageDoc): Promise<void> {
    const uri = this.getEmbeddedLanguageDocUri(Uri.parse(embeddedLanguageDoc.originalUri), embeddedLanguageDoc.language)
    if (uri === undefined) {
      return undefined
    }
    try {
      await workspace.fs.writeFile(uri, Buffer.from(embeddedLanguageDoc.content))
      await workspace.openTextDocument(uri)
    } catch (err) {
      logger.error(`Failed to create embedded document: ${err as any}`)
    }
    this.registerEmbeddedLanguageDocInfos(embeddedLanguageDoc, uri)
  }

  async saveEmbeddedLanguageDoc (
    embeddedLanguageDoc: EmbeddedLanguageDoc
  ): Promise<void> {
    logger.debug(`Save embedded document (${embeddedLanguageDoc.language}) for ${embeddedLanguageDoc.originalUri}`)
    const embeddedLanguageDocInfos = this.getEmbeddedLanguageDocInfos(
      Uri.parse(embeddedLanguageDoc.originalUri),
      embeddedLanguageDoc.language
    )
    if (embeddedLanguageDocInfos !== undefined) {
      await this.updateEmbeddedLanguageDocFile(embeddedLanguageDoc, embeddedLanguageDocInfos.uri)
    } else {
      await this.createEmbeddedLanguageDocFile(embeddedLanguageDoc)
    }
  }
}

export const embeddedLanguageDocsManager = new EmbeddedLanguageDocsManager()
