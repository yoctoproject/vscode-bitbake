/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { type CompletionItem, CompletionItemKind, type Range } from 'vscode-languageserver/node'
import { type CompletionItemData } from './completion-item-data'
import { logger } from '../lib/src/utils/OutputLogger'

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

const spdxLicensesPath = path.join(__dirname, '../../resources/spdx-licenses.json')
const spdxLicensesFileContent = fs.readFileSync(spdxLicensesPath, 'utf8')
export const spdxLicensesCollection = JSON.parse(spdxLicensesFileContent) as SpdxLicenseCollection
export const spdxLicenses = spdxLicensesCollection.licenses

export const getLicenseCompletionItems = (rangeOfText: Range): CompletionItem[] => {
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
    const detailsResponse = await fetch(license.detailsUrl)
    const spdxLicenseDetails = await detailsResponse.json() as SpdxLicenseDetails
    return {
      ...item,
      documentation: spdxLicenseDetails.licenseText
    }
  } catch (error: any) {
    logger.error(`[getSpdxLicenseCompletionResolve] error: ${error}`)
    return item
  }
}
