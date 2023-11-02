/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'
import { replaceTextForSpaces } from './utils'

import { analyzer } from '../tree-sitter/analyzer'
import { embeddedLanguageDocsManager } from './documents-manager'
import { type EmbeddedLanguageDocInfos } from '../lib/src/types/embedded-languages'

export const generatePythonEmbeddedLanguageDoc = async (textDocument: TextDocument): Promise<void> => {
  const pythonRegions = analyzer.getPythonRegions(textDocument.uri)
  const documentAsText = textDocument.getText().split(/\r?\n/g)
  const embeddedLanguageDocAsText = replaceTextForSpaces(documentAsText)
  pythonRegions.forEach((region) => {
    const { start, end } = region.location.range
    const declarationLine = documentAsText[start.line]
      .replace(/^(\s*fakeroot)?\s*python/, 'def')
      .replace(/:(append|prepend|remove)/, (_match, p1) => { return `_${p1}` })
      .replace('{', ':')
    embeddedLanguageDocAsText[start.line] = declarationLine
    for (let i = start.line + 1; i < end.line; i++) {
      embeddedLanguageDocAsText[i] = documentAsText[i]
    }
  })
  embeddedLanguageDocAsText.unshift('import bb')
  const content = embeddedLanguageDocAsText.join('\n')
  const partialInfos: Omit<EmbeddedLanguageDocInfos, 'uri'> = {
    language: 'python',
    lineOffset: 1
  }
  await embeddedLanguageDocsManager.saveEmbeddedLanguageDoc(textDocument.uri, content, partialInfos)
}
