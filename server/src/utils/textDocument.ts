/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'

export const getLine = (document: TextDocument, lineNumber: number): string => {
  const range = {
    start: {
      line: lineNumber,
      character: 0
    },
    end: {
      line: lineNumber,
      character: Number.POSITIVE_INFINITY
    }
  }
  return document.getText(range)
}
