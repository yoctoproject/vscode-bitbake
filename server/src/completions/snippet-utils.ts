/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/snippets.ts#L659
 */

import { InsertTextFormat, type CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver'

/* eslint-disable no-template-curly-in-string */

export function formatCompletionItems (completions: CompletionItem[], completionItemKind?: CompletionItemKind): CompletionItem[] {
  return completions.map((item) => {
    const formatted = {
      ...item,
      insertTextFormat: item.insertText !== undefined ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
      documentation: {
        value: [
          markdownBlock(
            `${item.label} (bitbake-language-server)\n\n`,
            'man'
          ),
          markdownBlock(item.insertText?.replace(/\$\{\d+:(?<code>.*)\}/g, (m, p1) => p1), 'bitbake'),
          '---',
          `${JSON.parse(JSON.stringify(item.documentation))}`,
          item.data.referenceUrl !== undefined ? `[Reference](${item.data?.referenceUrl})` : ''
        ].join('\n'),
        kind: MarkupKind.Markdown
      },

      kind: item.kind ?? completionItemKind ?? CompletionItemKind.Snippet
    }

    const { data, ...filtered } = formatted

    return filtered
  })
}

function markdownBlock (text: string | undefined, language: string | undefined): string {
  const tripleQuote = '```'
  return [tripleQuote + language, text, tripleQuote].join('\n')
}
