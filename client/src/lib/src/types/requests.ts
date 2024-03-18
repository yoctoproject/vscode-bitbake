/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Range, type Position } from 'vscode'
import { type EmbeddedLanguageType } from './embedded-languages'

export enum RequestType {
  EmbeddedLanguageTypeOnPosition = 'EmbeddedLanguageTypeOnPosition',
  getLinksInDocument = 'getLinksInDocument',
  ProcessRecipeScanResults = 'ProcessRecipeScanResults',
  GetVar = 'getVar',
  GetAllVar = 'getAllVar'
}

export const RequestMethod: Record<RequestType, string> = {
  [RequestType.EmbeddedLanguageTypeOnPosition]: 'bitbake/requestEmbeddedLanguageDocInfos',
  [RequestType.getLinksInDocument]: 'bitbake/getLinksInDocument',
  [RequestType.ProcessRecipeScanResults]: 'bitbake/ProcessRecipeScanResults',
  [RequestType.GetVar]: 'bitbake/getVar',
  [RequestType.GetAllVar]: 'bitbake/getAllVar'
}

export interface RequestParams {
  [RequestType.EmbeddedLanguageTypeOnPosition]: { uriString: string, position: Position }
  [RequestType.getLinksInDocument]: { documentUri: string }
  [RequestType.ProcessRecipeScanResults]: { scanResults: string, uri: any, chosenRecipe: string }
  [RequestType.GetVar]: { variable: string, recipe: string }
  [RequestType.GetAllVar]: { recipe: string }
}

export interface RequestResult {
  [RequestType.EmbeddedLanguageTypeOnPosition]: Promise<EmbeddedLanguageType | undefined | null> // for unknown reasons, the client receives null instead of undefined
  [RequestType.getLinksInDocument]: Promise<Array<{ value: string, range: Range }>>
  [RequestType.ProcessRecipeScanResults]: Record<string, unknown> | undefined
}
