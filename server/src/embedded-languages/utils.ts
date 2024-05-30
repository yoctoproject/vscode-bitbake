/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument } from 'vscode-languageserver-textdocument'

import { getEmbeddedLanguageDocFilename, type EmbeddedLanguageDoc, type EmbeddedLanguageType } from '../lib/src/embedded-languages'
import { checkIsDirectiveStatementKeyword } from '../lib/src/types/directiveKeywords'
import { analyzer } from '../tree-sitter/analyzer'
import { extractRecipeName } from '../lib/src/utils/files'
import { getDefinitionForDirectives } from '../connectionHandlers/onDefinition'

const replaceTextForSpaces = (text: string): string => {
  return text.replace(/[^\r\n]+/g, (match) => ' '.repeat(match.length))
}

const initCharactersOffsetArrays = (length: number): number[] => {
  return Array.from({ length: length + 1 }, (_, i) => i)
}

export const initEmbeddedLanguageDoc = (textDocument: TextDocument, language: EmbeddedLanguageType): EmbeddedLanguageDoc => {
  return {
    originalUri: textDocument.uri,
    language,
    content: replaceTextForSpaces(textDocument.getText()),
    characterIndexes: initCharactersOffsetArrays(textDocument.getText().length)
  }
}

const addCharacterOffset = (charactersOffsetArray: number[], character: number, offset: number): void => {
  for (let i = character; i < charactersOffsetArray.length; i++) {
    charactersOffsetArray[i] += offset
  }
}

const insertTextBetweenIndexes = (inputString: string, start: number, end: number, replacementText: string): string => {
  const beforeTarget = inputString.substring(0, start)
  const afterTarget = inputString.substring(end)
  return `${beforeTarget}${replacementText}${afterTarget}`
}

// Important constraint: Regions of the document on which the user interacts must keep the same size
// Otherwise it will not be possible to map the cursor position from the original document to the embedded document
export const insertTextIntoEmbeddedLanguageDoc = (embeddedLanguageDoc: EmbeddedLanguageDoc, start: number, end: number, textToInsert: string): void => {
  const adjustedStart = embeddedLanguageDoc.characterIndexes[start]
  const adjustedEnd = embeddedLanguageDoc.characterIndexes[end]
  embeddedLanguageDoc.content = insertTextBetweenIndexes(embeddedLanguageDoc.content, adjustedStart, adjustedEnd, textToInsert)
  const previousLength = end - start
  const newLength = textToInsert.length
  const diff = newLength - previousLength
  if (diff !== 0) {
    addCharacterOffset(embeddedLanguageDoc.characterIndexes, end, diff)
  }
}

export interface ImportedResourceInfos {
  embeddedLanguageDocFilename: string
  originalUri: string
}

export const getImportedRessourcesInfos = (
  directiveStatementKeyword: string | undefined,
  includePath: string | undefined,
  uri: string,
  languageType: EmbeddedLanguageType
): ImportedResourceInfos[] => {
  if (!checkIsDirectiveStatementKeyword(directiveStatementKeyword) || includePath === undefined) {
    return []
  }
  const lastScanResult = analyzer.getLastScanResult(extractRecipeName(uri))
  let resolvedDirectivePath = includePath
  if (lastScanResult !== undefined) {
    resolvedDirectivePath = analyzer.resolveSymbol(includePath, lastScanResult.symbols)
  }
  const definitions = getDefinitionForDirectives(directiveStatementKeyword, resolvedDirectivePath)
  const modules: ImportedResourceInfos[] = []
  definitions.forEach((definition) => {
    const originalUri = definition.uri
    const embeddedLanguageDocFilename = getEmbeddedLanguageDocFilename(originalUri, languageType)
    modules.push({ embeddedLanguageDocFilename, originalUri })
    analyzer.pushDocumentToAnalyze(originalUri)
  })
  return modules
}
