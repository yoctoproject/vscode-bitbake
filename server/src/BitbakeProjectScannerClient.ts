/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { type Connection, type Disposable } from 'vscode-languageserver'
import { type BitbakeScanResult } from './lib/src/types/BitbakeScanResult'
import EventEmitter from 'events'
import { logger } from './lib/src/utils/OutputLogger'

/// Keeps track of the bitbake scan results from the language server
export class BitBakeProjectScannerClient {
  bitbakeScanResult: BitbakeScanResult = {
    _layers: [],
    _classes: [],
    _includes: [],
    _recipes: [],
    _overrides: [],
    _workspaces: []
  }

  private connection: Connection | undefined
  onChange: EventEmitter = new EventEmitter()

  setConnection (connection: Connection): void {
    this.connection = connection
  }

  buildHandlers (): Disposable[] {
    return this.bitbakeScanHandler()
  }

  private bitbakeScanHandler (): Disposable[] {
    if (this.connection === undefined) {
      throw new Error('BitBakeProjectScannerClient: connection is undefined')
    }
    const subscriptions: Disposable[] = []
    subscriptions.push(this.connection.onNotification('bitbake/scanReady', (scanResults: BitbakeScanResult) => {
      // In case a parsing error was just introduce, we keep the previous results to keep navigation functional
      if (this.bitbakeScanResult._recipes.length === 0 || scanResults._recipes.length > 0) {
        this.bitbakeScanResult = scanResults
      }
      this.onChange.emit('scanReady', scanResults)
      logger.info('Bitbake scan results received from language server')
    }))
    return subscriptions
  }
}

export const bitBakeProjectScannerClient: BitBakeProjectScannerClient = new BitBakeProjectScannerClient()
