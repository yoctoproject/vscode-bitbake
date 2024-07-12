/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
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

export const getSpdxLicenses = async (): Promise<SpdxLicense[]> => {
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

export const getSpdxLicense = async (licenseId: string): Promise<SpdxLicense | undefined> => {
  logger.debug(`[getSpdxLicense] Get SPDX license for ${licenseId}`)
  const spdxLicenses = await getSpdxLicenses()
  return spdxLicenses.find((license) => license.licenseId === licenseId)
}

export const getSpdxLicenseDetails = async (license: SpdxLicense): Promise<SpdxLicenseDetails> => {
  logger.debug('[getSpdxLicenseDetails] Get SPDX licenses details')
  const cachedDetails = cache.get<SpdxLicenseDetails>(license.detailsUrl)
  if (cachedDetails !== undefined) {
    return cachedDetails
  }
  logger.debug('[getSpdxLicenseDetails] Fetch SPDX licenses details')
  const detailsResponse = await fetch(license.detailsUrl)
  const spdxLicenseDetails = await detailsResponse.json() as SpdxLicenseDetails
  cache.set(license.detailsUrl, spdxLicenseDetails)
  return spdxLicenseDetails
}
