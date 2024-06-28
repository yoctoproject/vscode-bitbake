/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { type CompletionItem, CompletionItemKind, type Range } from 'vscode-languageserver/node'
import { type CompletionItemData } from './completion-item-data'
import { logger } from '../lib/src/utils/OutputLogger'
import NodeCache from 'node-cache'

export interface SpdxLicenseCollection {
  licenseListVersion: string
  licenses: SpdxLicense[]
  releaseDate: string
}

export interface SpdxLicense {
  reference: string
  isDeprecatedLicenseId?: boolean
  detailsUrl: string
  referenceNumber?: number
  name: string
  licenseId: string
  seeAlso: string[]
  isOsiApproved?: boolean
}

export const spdxLicenseSource = 'Source: SPDX License List'

export interface SpdxLicenseDetails {
  isDeprecatedLicenseId: boolean
  licenseText: string
  name: string
  licenseId: string
  crossRef: Array<{
    match: string
    url: string
    isValid: boolean
    isLive: boolean
    timestamp: string
    isWayBackLink: boolean
    order: number
  }>
  seeAlso: string[]
  isOsiApproved: boolean
  licenseTextHtml: string
}

export const spdxLicenseDescription = 'Source: SPDX License List'
const cache = new NodeCache()

const loadSpdxLicenses = async (): Promise<SpdxLicense[]> => {
  logger.debug('[loadSpdxLicenses] Load SPDX licenses')
  return await new Promise<SpdxLicense[]>((resolve) => {
    const spdxLicensesPath = path.join(__dirname, '../../resources/spdx-licenses.json')
    fs.readFile(spdxLicensesPath, (error, data) => {
      if (error !== null) {
        logger.error(`[loadSpdxLicenses] error: ${JSON.stringify(error)}`)
        resolve([])
      }
      const spdxLicensesCollection = JSON.parse(data.toString()) as SpdxLicenseCollection
      resolve(spdxLicensesCollection.licenses)
    })
  })
}

const getSpdxLicenses = async (): Promise<SpdxLicense[]> => {
  logger.debug('[getSpdxLicenses] Get SPDX licenses')
  const cacheKey = 'spdxLicenses'
  // node-cache will eventually release the memory, compared to a simple global variable.
  const cachedSpdxLicenses = cache.get<SpdxLicense[]>(cacheKey)
  if (cachedSpdxLicenses !== undefined) {
    return cachedSpdxLicenses
  }
  const spdxLicenses = await loadSpdxLicenses()
  cache.set(cacheKey, spdxLicenses)
  return spdxLicenses
}

export const getLicenseCompletionItems = async (rangeOfText: Range): Promise<CompletionItem[]> => {
  const spdxLicenses = await getSpdxLicenses()
  return spdxLicenses.map((license) => (
    {
      label: license.licenseId,
      kind: CompletionItemKind.Value,
      deprecated: license.isDeprecatedLicenseId === true,
      labelDetails: {
        description: spdxLicenseDescription
      },
      documentation: 'Loading...',
      textEdit: {
        range: rangeOfText,
        newText: license.licenseId
      },
      data: {
        source: spdxLicenseDescription,
        payload: license
      } satisfies CompletionItemData
    }
  ))
}

export const getSpdxLicenseCompletionResolve = async (item: CompletionItem): Promise<CompletionItem> => {
  try {
    const license = item.data.payload as SpdxLicense
    const cachedItem = cache.get<CompletionItem>(license.detailsUrl)
    if (cachedItem !== undefined) {
      return cachedItem
    }
    const detailsResponse = await fetch(license.detailsUrl)
    const spdxLicenseDetails = await detailsResponse.json() as SpdxLicenseDetails
    const resolvedItem = {
      ...item,
      documentation: spdxLicenseDetails.licenseText
    }
    cache.set(license.detailsUrl, resolvedItem)
    return resolvedItem
  } catch (error: any) {
    logger.error(`[getSpdxLicenseCompletionResolve] error: ${error}`)
    return item
  }
}
