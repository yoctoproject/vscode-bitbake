/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type TextDocument, type Definition, type Position } from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'

import { RequestMethod, type RequestParams, type RequestResult } from '../lib/src/types/requests'
import { getAllVariableValues } from './languageClient'

export class RequestManager {
  client: LanguageClient | undefined

  getEmbeddedLanguageTypeOnPosition = async (
    uriString: string,
    position: Position
  ): RequestResult['EmbeddedLanguageTypeOnPosition'] => {
    const params: RequestParams['EmbeddedLanguageTypeOnPosition'] = { uriString, position }
    return await this.client?.sendRequest(RequestMethod.EmbeddedLanguageTypeOnPosition, params)
  }

  getAllVariableValues = async (
    recipe: string
  ): Promise<ReturnType<typeof getAllVariableValues>> => {
    if (this.client === undefined) {
      return
    }
    return await getAllVariableValues(this.client, recipe, false)
  }

  getDefinition = async (textDocument: TextDocument, position: Position): Promise<Definition[]> => {
    if (this.client === undefined) {
      return []
    }
    return await this.client.sendRequest(
      'textDocument/definition',
      {
        textDocument: {
          uri: textDocument.uri.toString()
        },
        position
      }
    )
  }
}

export const requestsManager = new RequestManager()
