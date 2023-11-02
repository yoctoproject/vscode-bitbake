/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position } from 'vscode-languageserver'
import type * as LSP from 'vscode-languageserver/node'

import { analyzer } from '../tree-sitter/analyzer'
import { positionIsWithinRange } from '../utils/range'

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

export const replaceTextForSpaces = (documentAsText: string[]): string[] => {
  return documentAsText.map((line) => ' '.repeat(line.length))
}
