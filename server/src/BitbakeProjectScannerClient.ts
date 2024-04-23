/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { scanContainsRecipes, type BitbakeScanResult } from './lib/src/types/BitbakeScanResult'
import { logger } from './lib/src/utils/OutputLogger'

/// Keeps track of the bitbake scan results from the language server
export class BitBakeProjectScannerClient {
  bitbakeScanResult: BitbakeScanResult = {
    _layers: [],
    _classes: [],
    _includes: [],
    _recipes: [],
    _overrides: [],
    _confFiles: [],
    _workspaces: []
  }

  public setScanResults (scanResults: BitbakeScanResult): void {
    logger.info('Project scan results received')
    // In case a parsing error occurred, we keep the previous results such that the relevant language features can still work
    if (!scanContainsRecipes(this.bitbakeScanResult) || scanContainsRecipes(scanResults)) {
      this.bitbakeScanResult = scanResults
    }
  }
}

export const bitBakeProjectScannerClient: BitBakeProjectScannerClient = new BitBakeProjectScannerClient()
