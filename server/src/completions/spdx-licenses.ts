/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { type CompletionItem, CompletionItemKind } from 'vscode-languageserver/node'

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

const spdxLicensesPath = path.join(__dirname, '../../resources/spdx-licenses.json')
const spdxLicensesFileContent = fs.readFileSync(spdxLicensesPath, 'utf8')
export const spdxLicensesCollection = JSON.parse(spdxLicensesFileContent) as SpdxLicenseCollection
export const spdxLicenses = spdxLicensesCollection.licenses

export const licenseCompletionItems: CompletionItem[] = spdxLicenses.map((license) => (
  {
    label: license.licenseId,
    kind: CompletionItemKind.Value,
    deprecated: license.isDeprecatedLicenseId === true,
    labelDetails: {
      description: spdxLicenseSource
    }
  }
))
