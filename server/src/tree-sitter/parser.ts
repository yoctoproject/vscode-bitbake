/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */
import * as path from 'path'
import Parser from 'web-tree-sitter'

export async function generateParser (): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()

  const language = await Parser.Language.load(path.join(__dirname, '/../../tree-sitter-bitbake.wasm'))
  parser.setLanguage(language)
  return parser
}
