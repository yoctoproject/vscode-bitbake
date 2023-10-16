/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

import path from 'path'
import fs from 'fs'
import { TextDocument } from 'vscode-languageserver-textdocument'

const FIXTURE_FOLDER = path.join(__dirname, './')

type FIXTURE_URI_KEY = keyof typeof FIXTURE_URI

function getDocument (uri: string): TextDocument {
  return TextDocument.create(
    uri,
    'bitbake',
    0,
    fs.readFileSync(uri.replace('file://', ''), 'utf8')
  )
}

export const FIXTURE_URI = {
  CORRECT: `file://${path.join(FIXTURE_FOLDER, 'correct.bb')}`,
  DECLARATION: `file://${path.join(FIXTURE_FOLDER, 'declarations.bb')}`
}

export const FIXTURE_DOCUMENT: Record<FIXTURE_URI_KEY, TextDocument> = (
  Object.keys(FIXTURE_URI) as FIXTURE_URI_KEY[]
).reduce<any>((acc, cur: FIXTURE_URI_KEY) => {
  acc[cur] = getDocument(FIXTURE_URI[cur])
  return acc
}, {})
