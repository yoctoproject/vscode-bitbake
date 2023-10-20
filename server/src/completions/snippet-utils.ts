/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

import { InsertTextFormat, type CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver'

/* eslint-disable no-template-curly-in-string */

export function formatYoctoTaskSnippets (completions: CompletionItem[]): CompletionItem[] {
  return completions.map((item) => {
    return {
      ...item,
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: {
        value: [
          markdownBlock(
            `${item.label} (bitbake-language-server)\n\n`,
            'man'
          ),
          markdownBlock(item.insertText?.replace(/\$\{\d+:(?<code>.*)\}/g, (m, p1) => p1), 'bitbake'),
          '---',
          `${JSON.parse(JSON.stringify(item.documentation))}`,
          `[Reference](https://docs.yoctoproject.org/singleindex.html#${item.label.replace(/_/g, '-')})`
        ].join('\n'),
        kind: MarkupKind.Markdown
      },

      kind: CompletionItemKind.Snippet
    }
  })
}

function markdownBlock (text: string | undefined, language: string | undefined): string {
  const tripleQuote = '```'
  return [tripleQuote + language, text, tripleQuote].join('\n')
}
