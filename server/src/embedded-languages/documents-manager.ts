/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

import logger from 'winston'

import { type EmbeddedLanguageDocInfos, type EmbeddedLanguageType } from './utils'

const EMBEDDED_DOCUMENTS_FOLDER = 'embedded-documents'

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
}

type EmbeddedLanguageDocsRecord = Partial<Record<EmbeddedLanguageType, EmbeddedLanguageDocInfos>>

export default class EmbeddedLanguageDocsManager {
  private readonly embeddedLanguageDocsInfos = new Map<string, EmbeddedLanguageDocsRecord>() // map of original uri to embedded documents infos
  private _storagePath: string = ''

  get storagePath (): string {
    return this._storagePath
  }

  set storagePath (storagePath: string) {
    logger.debug(`Set embedded language documents storage path. New: ${storagePath}. Old: ${this._storagePath}`)
    if (this._storagePath === storagePath) {
      return
    }
    const oldPathToEmbeddedLanguageDocsFolder = path.join(this._storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    const newPathToEmbeddedLanguageDocsFolder = path.join(storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    // Writing the code to move the existing files into the new folder is pointless optimization (and efforts):
    // In practice, storagePath is not intended to change.
    try {
      fs.mkdirSync(newPathToEmbeddedLanguageDocsFolder, { recursive: true })
    } catch (error) {
      logger.error('Failed to create embedded language documents folder:', error)
    }
    try {
      fs.rmdirSync(oldPathToEmbeddedLanguageDocsFolder, { recursive: true })
    } catch (error) {
      logger.error('Failed to remove embedded language documents folder:', error)
    }
    this._storagePath = storagePath
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

  private getPathToEmbeddedLanguageDoc (originalUriString: string, languageType: EmbeddedLanguageType): string {
    const embeddedLanguageDocInfos = this.getEmbeddedLanguageDocInfos(originalUriString, languageType)
    if (embeddedLanguageDocInfos !== undefined) {
      return embeddedLanguageDocInfos.uri.replace('file://', '')
    }
    const randomName = randomUUID()
    const fileExtension = fileExtensionsMap[languageType]
    const embeddedLanguageDocFilename = randomName + fileExtension
    const pathToEmbeddedLanguageDocsFolder = path.join(this.storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    return `${pathToEmbeddedLanguageDocsFolder}/${embeddedLanguageDocFilename}`
  }

  saveEmbeddedLanguageDoc (
    originalUriString: string,
    embeddedLanguageDocContent: string,
    partialEmbeddedLanguageDocInfos: Omit<EmbeddedLanguageDocInfos, 'uri'>
  ): void {
    logger.debug(`Save embedded document (${partialEmbeddedLanguageDocInfos.language}) for`, originalUriString)
    const pathToEmbeddedLanguageDoc = this.getPathToEmbeddedLanguageDoc(
      originalUriString,
      partialEmbeddedLanguageDocInfos.language
    )
    try {
      fs.writeFileSync(pathToEmbeddedLanguageDoc, embeddedLanguageDocContent)
    } catch (error) {
      logger.error('Failed to create embedded document:', error)
    }
    const documentInfos = {
      ...partialEmbeddedLanguageDocInfos,
      uri: `file://${pathToEmbeddedLanguageDoc}`
    }
    this.registerEmbeddedLanguageDocInfos(originalUriString, documentInfos)
  }

  deleteEmbeddedLanguageDocs (originalUriString: string): void {
    logger.debug('Delete embedded documents for', originalUriString)
    const embeddedLanguageDocs = this.embeddedLanguageDocsInfos.get(originalUriString) ?? {}
    Object.values(embeddedLanguageDocs).forEach(({ uri }) => {
      const pathToEmbeddedLanguageDoc = uri.replace('file://', '')
      try {
        fs.unlink(pathToEmbeddedLanguageDoc, () => {})
      } catch (error) {
        logger.error('Failed to delete embedded document:', error)
      }
    })
    this.embeddedLanguageDocsInfos.delete(originalUriString)
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
