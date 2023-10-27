/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

import logger from 'winston'

import { type EmbeddedDocumentInfos, type EmbeddedLanguageType } from './utils'

const EMBEDDED_DOCUMENTS_FOLDER = 'embedded-documents'

const fileExtensionsMap = {
  bash: '.sh',
  python: '.py'
}

type EmbeddedDocumentsRecord = Partial<Record<EmbeddedLanguageType, EmbeddedDocumentInfos>>

export default class EmbeddedDocumentsManager {
  private readonly embeddedDocumentsInfos = new Map<string, EmbeddedDocumentsRecord>() // map of original uri to embedded documents infos
  storagePath: string = ''

  private registerEmbeddedDocumentInfos (originalUriString: string, embeddedDocumentInfos: EmbeddedDocumentInfos): void {
    const embeddedDocuments = this.embeddedDocumentsInfos.get(originalUriString) ?? {}
    embeddedDocuments[embeddedDocumentInfos.language] = embeddedDocumentInfos
    this.embeddedDocumentsInfos.set(originalUriString, embeddedDocuments)
  }

  getEmbeddedDocumentInfos (
    originalUriString: string,
    languageType: EmbeddedLanguageType
  ): EmbeddedDocumentInfos | undefined {
    const embeddedDocuments = this.embeddedDocumentsInfos.get(originalUriString)
    return embeddedDocuments?.[languageType]
  }

  saveEmbeddedDocument (
    originalUriString: string,
    embeddedDocumentContent: string,
    partialEmbeddedDocumentInfos: Omit<EmbeddedDocumentInfos, 'uri'>
  ): void {
    const randomName = randomUUID()
    const fileExtension = fileExtensionsMap[partialEmbeddedDocumentInfos.language]
    const embeddedDocumentFilename = randomName + fileExtension
    const pathToEmbeddedDocumentsFolder = path.join(this.storagePath, EMBEDDED_DOCUMENTS_FOLDER)
    const pathToEmbeddedDocument = `${pathToEmbeddedDocumentsFolder}/${embeddedDocumentFilename}`
    try {
      fs.mkdirSync(pathToEmbeddedDocumentsFolder, { recursive: true })
      fs.writeFileSync(pathToEmbeddedDocument, embeddedDocumentContent)
    } catch (error) {
      logger.error('Failed to create embedded document:', error)
    }
    const documentInfos = {
      ...partialEmbeddedDocumentInfos,
      uri: `file://${pathToEmbeddedDocument}`
    }
    this.registerEmbeddedDocumentInfos(originalUriString, documentInfos)
  }

  deleteEmbeddedDocuments (originalUriString: string): void {
    const embeddedDocuments = this.embeddedDocumentsInfos.get(originalUriString) ?? {}
    Object.values(embeddedDocuments).forEach(({ uri }) => {
      const pathToEmbeddedDocument = uri.replace('file://', '')
      try {
        fs.unlink(pathToEmbeddedDocument, () => {})
      } catch (error) {
        logger.error('Failed to delete embedded document:', error)
      }
    })
    this.embeddedDocumentsInfos.delete(originalUriString)
  }

  moveEmbeddedDocuments (): void {
    // TODO: Handle the case where the file has been moved or renamed. How?
  }
}

export const embeddedDocumentsManager = new EmbeddedDocumentsManager()
