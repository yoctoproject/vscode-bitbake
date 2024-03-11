/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode'

export const getIndentationOnLine = (document: TextDocument, lineNumber: number): string => {
  const line = document.lineAt(lineNumber)
  return line.text.slice(0, line.firstNonWhitespaceCharacterIndex)
}
