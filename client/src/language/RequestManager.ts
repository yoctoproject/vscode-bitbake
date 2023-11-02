/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Position } from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { RequestMethod, type RequestParams, type RequestResult } from '../lib/src/types/requests'

export class RequestManager {
  client: LanguageClient | undefined

  getEmbeddedLanguageDocInfos = async (
    uriString: string,
    position: Position
  ): RequestResult['EmbeddedLanguageDocInfos'] => {
    const params: RequestParams['EmbeddedLanguageDocInfos'] = { uriString, position }
    return await this.client?.sendRequest(RequestMethod.EmbeddedLanguageDocInfos, params)
  }
}

export const requestsManager = new RequestManager()
