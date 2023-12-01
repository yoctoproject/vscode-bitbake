/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

import { type EmbeddedLanguageDoc, type EmbeddedLanguageDocInfos, type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'
import { logger } from '../lib/src/utils/OutputLogger'

const EMBEDDED_DOCUMENTS_FOLDER = 'embedded-documents'

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
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

  private registerEmbeddedLanguageDocInfos (originalUriString: string, embeddedLanguageDocInfos: EmbeddedLanguageDocInfos): void {
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString) ?? {}
    embeddedLanguageDocs[embeddedLanguageDocInfos.language] = embeddedLanguageDocInfos
    this.embeddedLanguageDocsInfos.set(originalUriString, embeddedLanguageDocs)
  }

  getEmbeddedLanguageDocInfos (
    originalUriString: string,
    languageType: EmbeddedLanguageType
  ): EmbeddedLanguageDocInfos | undefined {
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString)
    return embeddedLanguageDocs?.[languageType]
  }

  private getPathToEmbeddedLanguageDoc (embeddedLanguageDoc: EmbeddedLanguageDoc): string | undefined {
    if (this.storagePath === undefined) {
      return undefined
    }
    const embeddedLanguageDocInfos = this.getEmbeddedLanguageDocInfos(
      embeddedLanguageDoc.originalUri,
      embeddedLanguageDoc.language
    )
    if (embeddedLanguageDocInfos !== undefined) {
      return embeddedLanguageDocInfos.uri.replace('file://', '')
    }
    const randomName = randomUUID()
    const fileExtension = fileExtensionsMap[embeddedLanguageDoc.language]
    const embeddedLanguageDocFilename = randomName + fileExtension
    const pathToEmbeddedLanguageDocsFolder = path.join(this.storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    return `${pathToEmbeddedLanguageDocsFolder}/${embeddedLanguageDocFilename}`
  }

  async saveEmbeddedLanguageDocs (
    embeddedLanguageDocs: EmbeddedLanguageDoc[]
  ): Promise<void> {
    await Promise.all(embeddedLanguageDocs.map(async (embeddedLanguageDoc) => {
      await this.saveEmbeddedLanguageDoc(embeddedLanguageDoc)
    }))
  }

  async saveEmbeddedLanguageDoc (
    embeddedLanguageDoc: EmbeddedLanguageDoc
  ): Promise<void> {
    logger.debug(`Save embedded document (${embeddedLanguageDoc.language}) for ${embeddedLanguageDoc.originalUri}`)
    const pathToEmbeddedLanguageDoc = this.getPathToEmbeddedLanguageDoc(embeddedLanguageDoc)
    if (pathToEmbeddedLanguageDoc === undefined) {
      return
    }
    await new Promise<void>((resolve, reject) => {
      fs.writeFile(pathToEmbeddedLanguageDoc, embeddedLanguageDoc.content, (err) => {
        err !== null ? reject(err) : resolve()
      })
    }).then(() => {
      const embeddedLanguageDocInfos: EmbeddedLanguageDocInfos = {
        ...embeddedLanguageDoc,
        uri: `file://${pathToEmbeddedLanguageDoc}`
      }
      this.registerEmbeddedLanguageDocInfos(embeddedLanguageDoc.originalUri, embeddedLanguageDocInfos)
    }).catch((err) => {
      logger.error(`Failed to create embedded document: ${err}`)
    })
  }

  async deleteEmbeddedLanguageDocs (originalUriString: string): Promise<void> {
    logger.debug(`Delete embedded documents for ${originalUriString}`)
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString) ?? {}
    await Promise.all(Object.values(embeddedLanguageDocs).map(async ({ uri }) => {
      await new Promise<void>((resolve, reject) => {
        const pathToEmbeddedLanguageDoc = uri.replace('file://', '')
        fs.unlink(pathToEmbeddedLanguageDoc, (err) => {
          err !== null ? reject(err) : resolve()
        })
      })
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
