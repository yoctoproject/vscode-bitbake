/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { CompletionItemKind } from 'vscode-languageserver'
import type { CompletionItem } from 'vscode-languageserver'

export const BasicKeywordMap: CompletionItem[] = [
  {
    label: 'require',
    kind: CompletionItemKind.Keyword
  },
  {
    label: 'inherit',
    kind: CompletionItemKind.Keyword
  },
  {
    label: 'include',
    kind: CompletionItemKind.Keyword
  }
]
