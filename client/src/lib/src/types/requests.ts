/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Range, type Position } from 'vscode'
import { type EmbeddedLanguageDocInfos } from './embedded-languages'

export enum RequestType {
  EmbeddedLanguageDocInfos = 'EmbeddedLanguageDocInfos',
  getLinksInDocument = 'getLinksInDocument'
}

export const RequestMethod: Record<RequestType, string> = {
  [RequestType.EmbeddedLanguageDocInfos]: 'custom/requestEmbeddedLanguageDocInfos',
  [RequestType.getLinksInDocument]: 'custom/getLinksInDocument'
}

export interface RequestParams {
  [RequestType.EmbeddedLanguageDocInfos]: RequestEmbeddedLanguageDocInfosParams
  [RequestType.getLinksInDocument]: { documentUri: string }
}

export interface RequestResult {
  [RequestType.EmbeddedLanguageDocInfos]: Promise<EmbeddedLanguageDocInfos | undefined | null> // for unknown reasons, the client receives null instead of undefined
  [RequestType.getLinksInDocument]: Promise<Array<{ value: string, range: Range }>>
}

interface RequestEmbeddedLanguageDocInfosParams {
  uriString: string
  position: Position
}
