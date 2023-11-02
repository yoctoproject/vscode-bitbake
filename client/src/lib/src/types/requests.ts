/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position } from 'vscode'
import { type EmbeddedLanguageDocInfos } from './embedded-languages'

enum RequestType {
  EmbeddedLanguageDocInfos = 'EmbeddedLanguageDocInfos'
}

export const RequestMethod: Record<RequestType, string> = {
  [RequestType.EmbeddedLanguageDocInfos]: 'custom/requestEmbeddedLanguageDocInfos'
}

export interface RequestParams {
  [RequestType.EmbeddedLanguageDocInfos]: RequestEmbeddedLanguageDocInfosParams
}

export interface RequestResult {
  [RequestType.EmbeddedLanguageDocInfos]: Promise<EmbeddedLanguageDocInfos | undefined>
}

interface RequestEmbeddedLanguageDocInfosParams {
  uriString: string
  position: Position
}
