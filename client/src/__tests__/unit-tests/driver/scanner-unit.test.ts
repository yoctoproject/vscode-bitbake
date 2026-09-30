/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'

jest.mock('vscode')

describe('BitBakeProjectScanner unit tests', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows a non-modal error when path mapping fails', async () => {
    const scanner = new BitBakeProjectScanner(new BitbakeDriver())

    const scannerInternals = scanner as unknown as {
      containerToHostMap: Map<string, string>
      hostToContainerMap: Map<string, string>
      existsInContainer: (containerPath: string) => Promise<boolean>
    }

    scannerInternals.containerToHostMap = new Map([['/container', '/host']])
    scannerInternals.hostToContainerMap = new Map([['/host', '/container']])

    jest.spyOn(scannerInternals, 'existsInContainer').mockResolvedValue(false)

    const errorSpy = jest.spyOn(vscode.window, 'showErrorMessage')
      .mockResolvedValue(undefined)

    await scanner.resolveHostPath('/host/test.bb')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bitbake extension couldn\'t locate a file')
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('bitbake.commandWrapper')
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/host/test.bb')
    )
    expect(errorSpy.mock.calls[0]).toHaveLength(1)
  })

})
