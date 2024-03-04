/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Range, type Position } from 'vscode'
import { type EmbeddedLanguageType } from './embedded-languages'

export enum RequestType {
  EmbeddedLanguageTypeOnPosition = 'EmbeddedLanguageTypeOnPosition',
  IsSymbolDefinedInRecipe = 'IsSymbolDefinedInRecipe',
  getLinksInDocument = 'getLinksInDocument',
  ProcessRecipeScanResults = 'ProcessRecipeScanResults'
}

export const RequestMethod: Record<RequestType, string> = {
  [RequestType.EmbeddedLanguageTypeOnPosition]: 'bitbake/requestEmbeddedLanguageDocInfos',
  [RequestType.IsSymbolDefinedInRecipe]: 'bitbake/isVariableDefined',
  [RequestType.getLinksInDocument]: 'bitbake/getLinksInDocument',
  [RequestType.ProcessRecipeScanResults]: 'bitbake/ProcessRecipeScanResults'
}

export interface RequestParams {
  [RequestType.EmbeddedLanguageTypeOnPosition]: { uriString: string, position: Position }
  [RequestType.IsSymbolDefinedInRecipe]: { symbolName: string, recipeName: string }
  [RequestType.getLinksInDocument]: { documentUri: string }
  [RequestType.ProcessRecipeScanResults]: { scanResults: string, uri: any, chosenRecipe: string }
}

export interface RequestResult {
  [RequestType.EmbeddedLanguageTypeOnPosition]: Promise<EmbeddedLanguageType | undefined | null> // for unknown reasons, the client receives null instead of undefined
  [RequestType.IsSymbolDefinedInRecipe]: Promise<boolean | undefined>
  [RequestType.getLinksInDocument]: Promise<Array<{ value: string, range: Range }>>
  [RequestType.ProcessRecipeScanResults]: Record<string, unknown> | undefined
}
