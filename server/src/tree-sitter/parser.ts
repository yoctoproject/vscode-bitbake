/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/server/src/parser.ts
 */
import * as path from 'path'
import Parser from 'web-tree-sitter'

export async function generateParser (wasmPath: string): Promise<Parser> {
  await Parser.init()
  const parser = new Parser()

  const language = await Parser.Language.load(wasmPath)
  parser.setLanguage(language)

  return parser
}

export async function generateBitBakeParser (): Promise<Parser> {
  const wasmPath = path.join(__dirname, '/../../tree-sitter-bitbake.wasm')
  return await generateParser(wasmPath)
}

export async function generateBashParser (): Promise<Parser> {
  const wasmPath = path.join(__dirname, '/../../tree-sitter-bash.wasm')
  return await generateParser(wasmPath)
}
