/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type CompletionItem, CompletionItemKind } from 'vscode-languageserver/node'
import { type CompletionItemData } from './completion-item-data'
import { logger } from '../lib/src/utils/OutputLogger'
import { type Position, type TextDocument } from 'vscode-languageserver-textdocument'
import { getRangeOfTextToReplace, getPreviousCharactersOnLine } from '../utils/textDocument'
import { getSpdxLicenseDetails, getSpdxLicenses, type SpdxLicense } from '../utils/spdx-licenses'

export const spdxLicenseDescription = 'Source: SPDX License List'

export const licenseOperators: CompletionItem[] = [
  {
    label: '&',
    kind: CompletionItemKind.Operator,
    insertText: '& '
  },
  {
    label: '|',
    kind: CompletionItemKind.Operator,
    insertText: '| '
  }
]

export const getLicenseCompletionItems = async (
  textDocument: TextDocument,
  position: Position
): Promise<CompletionItem[]> => {
  const previousCharacters = getPreviousCharactersOnLine(textDocument, position)
  if (
    previousCharacters.at(-1) === ' ' &&
    !'&|'.includes(previousCharacters.at(-2) as string)
  ) {
    return licenseOperators
  }

  const rangeOfText = getRangeOfTextToReplace(textDocument, position)
  const spdxLicenses = await getSpdxLicenses()
  return spdxLicenses.map<CompletionItem>((license) => (
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
    const spdxLicenseDetails = await getSpdxLicenseDetails(license)
    const resolvedItem = {
      ...item,
      documentation: spdxLicenseDetails.licenseText
    }
    return resolvedItem
  } catch (error: any) {
    logger.error(`[getSpdxLicenseCompletionResolve] error: ${error}`)
    return item
  }
}
