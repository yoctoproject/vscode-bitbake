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


export const FIXTURE_DOCUMENT = {
  CORRECT: getDocument(FIXTURE_URI.CORRECT),
  DECLARATION: getDocument(FIXTURE_URI.DECLARATION),
  COMPLETION: getDocument(FIXTURE_URI.COMPLETION),
  HOVER: getDocument(FIXTURE_URI.HOVER),
  EMBEDDED: getDocument(FIXTURE_URI.EMBEDDED),
  SEMANTIC_TOKENS: getDocument(FIXTURE_URI.SEMANTIC_TOKENS),
  DIRECTIVE: getDocument(FIXTURE_URI.DIRECTIVE),
  RENAME: getDocument(FIXTURE_URI.RENAME),
  BAZ_BBCLASS: getDocument(FIXTURE_URI.BAZ_BBCLASS),
  BAR_INC: getDocument(FIXTURE_URI.BAR_INC),
  FOO_INC: getDocument(FIXTURE_URI.FOO_INC),
  BITBAKE_CONF: getDocument(FIXTURE_URI.BITBAKE_CONF)
}

export const DUMMY_URI = 'file://dummy_uri.bb'
