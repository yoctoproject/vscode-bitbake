/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

import { InsertTextFormat, type CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver'

export const SNIPPETS: CompletionItem[] = [
  {
    documentation: 'Fetch something',
    label: 'do_fetch',
    insertText: [
      'def do_fetch():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Unpack something',
    label: 'do_unpack',
    insertText: [
      'def do_unpack():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Patch something',
    label: 'do_patch',
    insertText: [
      'def do_patch():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Configure something',
    label: 'do_configure',
    insertText: [
      'def do_configure():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Compile something',
    label: 'do_compile',
    insertText: [
      'def do_compile():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Install something',
    label: 'do_install',
    insertText: [
      'def do_install():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Package something',
    label: 'do_package',
    insertText: [
      'def do_package():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Rootfs',
    label: 'do_rootfs',
    insertText: [
      'def do_rootfs():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Populate sysroot',
    label: 'do_populate_sysroot',
    insertText: [
      'def do_populate_sysroot():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  },
  {
    documentation: 'Deploy something',
    label: 'do_deploy',
    insertText: [
      'def do_deploy():',
      '\t# Your code here',
      /* eslint-disable no-template-curly-in-string */
      '\t${1:pass}'
    ].join('\n')
  }
].map((item) => {
  return {
    ...item,
    insertTextFormat: InsertTextFormat.Snippet,
    documentation: {
      value: [
        markdownBlock(
            `${item.documentation ?? item.label} (bitbake-language-server)\n\n`,
            'man'
        ),
        markdownBlock(item.insertText, 'bitbake')
      ].join('\n'),
      kind: MarkupKind.Markdown
    },
    kind: CompletionItemKind.Snippet
  }
})

function markdownBlock (text: string, language: string): string {
  const tripleQuote = '```'
  return [tripleQuote + language, text, tripleQuote].join('\n')
}
