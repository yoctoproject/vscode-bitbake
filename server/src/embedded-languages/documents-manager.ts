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
  storagePath: string = ''

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

  saveEmbeddedLanguageDoc (
    originalUriString: string,
    embeddedLanguageDocContent: string,
    partialEmbeddedLanguageDocInfos: Omit<EmbeddedLanguageDocInfos, 'uri'>
  ): void {
    logger.debug(`Save embedded document (${partialEmbeddedLanguageDocInfos.language}) for`, originalUriString)
    const randomName = randomUUID()
    const fileExtension = fileExtensionsMap[partialEmbeddedLanguageDocInfos.language]
    const embeddedLanguageDocFilename = randomName + fileExtension
    const pathToEmbeddedLanguageDocsFolder = path.join(this.storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    const pathToEmbeddedLanguageDoc = `${pathToEmbeddedLanguageDocsFolder}/${embeddedLanguageDocFilename}`
    try {
      fs.mkdirSync(pathToEmbeddedLanguageDocsFolder, { recursive: true })
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

  moveEmbeddedLanguageDocs (oldUriString: string, newUriString: string): void {
    logger.debug(`Move embedded documents from ${oldUriString} to ${newUriString}`)
    const oldInfos = this.embeddedLanguageDocsInfos.get(oldUriString)
    if (oldInfos === undefined) {
      return
    }
    this.embeddedLanguageDocsInfos.delete(oldUriString)
    this.embeddedLanguageDocsInfos.set(newUriString, oldInfos)
  }
}

export const embeddedLanguageDocsManager = new EmbeddedLanguageDocsManager()
