/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type * as vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { type BitbakeScanResult } from '../lib/src/types/BitbakeScanResult'
import EventEmitter from 'events'
import { logger } from '../lib/src/utils/OutputLogger'

/// Keeps track of the bitbake scan results from the language server
export class BitBakeProjectScannerClient {
  bitbakeScanResult: BitbakeScanResult = { recipes: [], includes: [] }
  private readonly client: LanguageClient
  onChange: EventEmitter = new EventEmitter()

  constructor (client: LanguageClient) {
    this.client = client
  }

  buildHandlers (): vscode.Disposable[] {
    const handlers = [
      this.bitbakeScanHandler()
    ]

    return handlers
  }

  private bitbakeScanHandler (): vscode.Disposable {
    return this.client.onNotification('bitbake/scanReady', (scanResults: BitbakeScanResult) => {
      this.bitbakeScanResult = scanResults
      this.onChange.emit('scanReady', scanResults)
      logger.info('Bitbake scan results received from language server')
    })
  }
}
