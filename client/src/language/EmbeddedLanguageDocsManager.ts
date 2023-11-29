/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

import { type EmbeddedLanguageDoc, type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { logger } from '../lib/src/utils/OutputLogger'
import { Range, Uri, WorkspaceEdit, workspace } from 'vscode'

const EMBEDDED_DOCUMENTS_FOLDER = 'embedded-documents'

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
}

export interface EmbeddedLanguageDocInfos {
  uri: Uri
  language: EmbeddedLanguageType
  characterIndexes: number[]
}

type EmbeddedLanguageDocsRecord = Partial<Record<EmbeddedLanguageType, EmbeddedLanguageDocInfos>>

export default class EmbeddedLanguageDocsManager {
  private readonly embeddedLanguageDocsInfos = new Map<string, EmbeddedLanguageDocsRecord>() // map of original uri to embedded documents infos
  private _storagePath: string | undefined

  get storagePath (): string | undefined {
    return this._storagePath
  }

  async setStoragePath (newStoragePath: string | undefined): Promise<void> {
    logger.debug(`Set embedded language documents storage path. New: ${newStoragePath}. Old: ${this._storagePath}`)
    if (this._storagePath === newStoragePath) {
      return
    }
    // Writing the code to move the existing files into the new folder is pointless optimization (and efforts):
    // In practice, storagePath is not intended to change.
    await Promise.all([
      new Promise<void>((resolve) => {
        if (newStoragePath === undefined) {
          resolve()
          return
        }
        const newPathToEmbeddedLanguageDocsFolder = path.join(newStoragePath, EMBEDDED_DOCUMENTS_FOLDER)
        fs.mkdir(newPathToEmbeddedLanguageDocsFolder, { recursive: true }, (err) => {
          if (err !== null) {
            logger.error(`Failed to create embedded language documents folder: ${err as any}`)
          }
          resolve()
        })
      }),
      new Promise<void>((resolve) => {
        if (this._storagePath === undefined) {
          resolve()
          return
        }
        const oldPathToEmbeddedLanguageDocsFolder = path.join(this._storagePath, EMBEDDED_DOCUMENTS_FOLDER)
        fs.rmdir(oldPathToEmbeddedLanguageDocsFolder, { recursive: true }, (err) => {
          if (err !== null) {
            logger.error(`Failed to remove embedded language documents folder: ${err as any}`)
          }
          resolve()
        })
      })
    ])
    this._storagePath = newStoragePath
  }

  private registerEmbeddedLanguageDocInfos (embeddedLanguageDoc: EmbeddedLanguageDoc, uri: Uri): void {
    const embeddedLanguageDocInfos: EmbeddedLanguageDocInfos = {
      ...embeddedLanguageDoc,
      uri
    }
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(embeddedLanguageDoc.originalUri) ?? {}
    embeddedLanguageDocs[embeddedLanguageDoc.language] = embeddedLanguageDocInfos
    this.embeddedLanguageDocsInfos.set(embeddedLanguageDoc.originalUri, embeddedLanguageDocs)
  }

  getEmbeddedLanguageDocInfos (
    originalUriString: string,
    languageType: EmbeddedLanguageType
  ): EmbeddedLanguageDocInfos | undefined {
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString)
    return embeddedLanguageDocs?.[languageType]
  }

  getOriginalUri (embeddedLanguageDocUri: Uri): Uri | undefined {
    let originalUri: Uri | undefined
    this.embeddedLanguageDocsInfos.forEach((embeddedLanguageDocs, stringUri) => {
      if (
        embeddedLanguageDocs.bash?.uri.toString() === embeddedLanguageDocUri.toString() ||
        embeddedLanguageDocs.python?.uri.toString() === embeddedLanguageDocUri.toString()
      ) {
        originalUri = Uri.parse(stringUri)
      }
    })
    return originalUri
  }

  private createEmbeddedLanguageDocUri (embeddedLanguageDoc: EmbeddedLanguageDoc): Uri | undefined {
    if (this.storagePath === undefined) {
      return undefined
    }
    const randomName = randomUUID()
    const fileExtension = fileExtensionsMap[embeddedLanguageDoc.language]
    const embeddedLanguageDocFilename = randomName + fileExtension
    const pathToEmbeddedLanguageDocsFolder = path.join(this.storagePath, EMBEDDED_DOCUMENTS_FOLDER)
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
    const fullRange = new Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    )
    const workspaceEdit = new WorkspaceEdit()
    workspaceEdit.replace(uri, fullRange, embeddedLanguageDoc.content)
    await workspace.applyEdit(workspaceEdit)
    await document.save()
    this.registerEmbeddedLanguageDocInfos(embeddedLanguageDoc, uri)
  }

  private async createEmbeddedLanguageDocFile (embeddedLanguageDoc: EmbeddedLanguageDoc): Promise<void> {
    const uri = this.createEmbeddedLanguageDocUri(embeddedLanguageDoc)
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
      embeddedLanguageDoc.originalUri,
      embeddedLanguageDoc.language
    )
    if (embeddedLanguageDocInfos !== undefined) {
      await this.updateEmbeddedLanguageDocFile(embeddedLanguageDoc, embeddedLanguageDocInfos.uri)
    } else {
      await this.createEmbeddedLanguageDocFile(embeddedLanguageDoc)
    }
  }

  async deleteEmbeddedLanguageDocs (originalUriString: string): Promise<void> {
    logger.debug(`Delete embedded documents for ${originalUriString}`)
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString) ?? {}
    await Promise.all(Object.values(embeddedLanguageDocs).map(async ({ uri }) => {
      await workspace.fs.delete(uri)
    })).then(() => {
      this.embeddedLanguageDocsInfos.delete(originalUriString)
    }).catch((err) => {
      logger.error(`Failed to delete embedded document: ${err}`)
    })
  }

  renameEmbeddedLanguageDocs (oldUriString: string, newUriString: string): void {
    logger.debug(`Rename embedded documents from ${oldUriString} to ${newUriString}`)
    const oldInfos = this.embeddedLanguageDocsInfos.get(oldUriString)
    if (oldInfos === undefined) {
      return
    }
    this.embeddedLanguageDocsInfos.delete(oldUriString)
    this.embeddedLanguageDocsInfos.set(newUriString, oldInfos)
  }
}

export const embeddedLanguageDocsManager = new EmbeddedLanguageDocsManager()
