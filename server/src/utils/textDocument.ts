/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from 'vscode-languageserver-textdocument'
import { loadFileContent } from '../lib/src/utils/files'

export async function loadTextDocument (uri: string): Promise<TextDocument | undefined> {
  const filePath = uri.replace('file://', '')
  const fileContent = await loadFileContent(filePath)
  if (fileContent === undefined) {
    return undefined
  }
  return TextDocument.create(uri, 'plaintext', 0, fileContent)
}
