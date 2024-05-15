/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/**
 * Inspired by bash-language-server under MIT
 * Reference: https://github.com/bash-lsp/bash-language-server/blob/8c42218c77a9451b308839f9a754abde901323d5/testing/fixtures.ts
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
  DECLARATION: `file://${path.join(FIXTURE_FOLDER, 'declarations.bb')}`,
  COMPLETION: `file://${path.join(FIXTURE_FOLDER, 'completion.bb')}`,
  HOVER: `file://${path.join(FIXTURE_FOLDER, 'hover.bb')}`,
  EMBEDDED: `file://${path.join(FIXTURE_FOLDER, 'embedded.bb')}`,
  SEMANTIC_TOKENS: `file://${path.join(FIXTURE_FOLDER, 'semanticTokens.bb')}`,
  DIRECTIVE: `file://${path.join(FIXTURE_FOLDER, 'directive.bb')}`,
  RENAME: `file://${path.join(FIXTURE_FOLDER, 'rename.bb')}`,
  BAZ_BBCLASS: `file://${path.join(FIXTURE_FOLDER, 'bbclass', 'baz.bbclass')}`,
  BAR_INC: `file://${path.join(FIXTURE_FOLDER, 'inc', 'bar.inc')}`,
  FOO_INC: `file://${path.join(FIXTURE_FOLDER, 'inc', 'foo.inc')}`,
  BITBAKE_CONF: `file://${path.join(FIXTURE_FOLDER, 'conf', 'bitbake.conf')}`
}

export const FIXTURE_DOCUMENT: Record<FIXTURE_URI_KEY, TextDocument> = (
  Object.keys(FIXTURE_URI) as FIXTURE_URI_KEY[]
).reduce<any>((acc, cur: FIXTURE_URI_KEY) => {
  acc[cur] = getDocument(FIXTURE_URI[cur])
  return acc
}, {})

export const DUMMY_URI = 'file://dummy_uri.bb'
