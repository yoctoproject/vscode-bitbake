/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position } from 'vscode-languageserver'
import type * as LSP from 'vscode-languageserver/node'
import { type TextDocument } from 'vscode-languageserver-textdocument'

import { analyzer } from '../tree-sitter/analyzer'
import { positionIsWithinRange } from '../utils/range'
import { type EmbeddedLanguageType } from '../lib/src/types/embedded-languages'

export interface EmbeddedLanguageDoc {
  originalUri: string
  language: EmbeddedLanguageType
  content: string
  characterIndexes: number[]
}

const isInsideRegion = (position: Position, region: LSP.SymbolInformation): boolean => {
  return positionIsWithinRange(position, region.location.range)
}

export const isInsideBashRegion = (stringUri: string, position: Position): boolean => {
  const bashRegions = analyzer.getBashRegions(stringUri)
  return bashRegions.some((region) => isInsideRegion(position, region))
}

export const isInsidePythonRegion = (stringUri: string, position: Position): boolean => {
  const pythonRegions = analyzer.getPythonRegions(stringUri)
  return pythonRegions.some((region) => isInsideRegion(position, region))
}

const replaceTextForSpaces = (text: string): string => {
  return text.replace(/[^\r\n]+/g, (match) => ' '.repeat(match.length))
}

const initCharactersOffsetArrays = (length: number): number[] => {
  return Array.from({ length }, (_, i) => i)
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

export const isQuotes = (value: unknown): value is "'" | '"' => {
  return value === '"' || value === "'"
}
