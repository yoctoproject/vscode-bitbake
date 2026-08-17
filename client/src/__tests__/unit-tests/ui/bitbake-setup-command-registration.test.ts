/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'

import { registerBitbakeSetupCommand } from '../../../ui/BitbakeSetupCommand'
import { initializeWorkspaceWithBitbakeSetup } from '../../../ui/BitbakeSetupInitialization'
import { mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode')
jest.mock('../../../ui/BitbakeSetupInitialization', () => ({
  initializeWorkspaceWithBitbakeSetup: jest.fn()
}))

describe('bitbake-setup command registration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('registers the Command Palette command and invokes the orchestrator', async () => {
    let callback: (() => Promise<void>) | undefined

    const disposable = {
      dispose: jest.fn()
    }

    jest.spyOn(vscode.commands, 'registerCommand').mockImplementation(
      (command: string, handler: (...args: unknown[]) => unknown) => {
        expect(command).toBe(
          'bitbake.initialize-workspace-with-bitbake-setup'
        )

        callback = handler as () => Promise<void>
        return disposable
      }
    )

    const context = mockVscodeExtensionContext()

    const result = registerBitbakeSetupCommand(context)

    expect(result).toBe(disposable)
    expect(callback).toBeDefined()

    await callback?.()

    expect(
      initializeWorkspaceWithBitbakeSetup
    ).toHaveBeenCalledTimes(1)

    expect(
      initializeWorkspaceWithBitbakeSetup
    ).toHaveBeenCalledWith(context)
  })
})
