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
  ProcessGlobalEnvScanResults = 'ProcessGlobalEnvScanResults',
  GetVar = 'getVar',
  GetRecipeLocalFiles = 'getRecipeLocalFiles'
}

export const RequestMethod: Record<RequestType, string> = {
  [RequestType.EmbeddedLanguageTypeOnPosition]: 'bitbake/requestEmbeddedLanguageDocInfos',
  [RequestType.getLinksInDocument]: 'bitbake/getLinksInDocument',
  [RequestType.ProcessRecipeScanResults]: 'bitbake/ProcessRecipeScanResults',
  [RequestType.ProcessGlobalEnvScanResults]: 'bitbake/ProcessGlobalEnvScanResults',
  [RequestType.GetVar]: 'bitbake/getVar',
  [RequestType.GetRecipeLocalFiles]: 'bitbake/getRecipeLocalFiles'
}

export interface RequestParams {
  [RequestType.EmbeddedLanguageTypeOnPosition]: { uriString: string, position: Position }
  [RequestType.getLinksInDocument]: { documentUri: string }
  [RequestType.ProcessRecipeScanResults]: { scanResults: string, uri: unknown, chosenRecipe: string }
  [RequestType.ProcessGlobalEnvScanResults]: { scanResults: string }
  [RequestType.GetVar]: { variable: string, recipe: string }
  [RequestType.GetRecipeLocalFiles]: { uri: string }
}

export interface RequestResult {
  [RequestType.EmbeddedLanguageTypeOnPosition]: Promise<EmbeddedLanguageType | undefined | null> // for unknown reasons, the client receives null instead of undefined
  [RequestType.getLinksInDocument]: Promise<Array<{ value: string, range: Range }>>
  [RequestType.ProcessRecipeScanResults]: Record<string, unknown> | undefined
  [RequestType.GetRecipeLocalFiles]: { foundFileUris: string[], foundDirs: string[] }
}
