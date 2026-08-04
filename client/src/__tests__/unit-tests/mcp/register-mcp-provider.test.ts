/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { registerMcpServerProvider } from '../../../mcp/registerMcpServerProvider'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { mockVscodeExtensionContext } from '../../utils/vscodeMock'

jest.mock('vscode')
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn()
}))

describe('registerMcpServerProvider', () => {
  const registerMcpSpy = vscode.lm.registerMcpServerDefinitionProvider as unknown as jest.Mock
  const configurationGet = jest.fn()
  const existsSyncMock = fs.existsSync as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    registerMcpSpy.mockReset()

    ;(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: configurationGet
    })

    ;(vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReturnValue({ dispose: jest.fn() })
    ;(vscode.EventEmitter as unknown as jest.Mock).mockImplementation(() => ({
      event: jest.fn(),
      fire: jest.fn(),
      dispose: jest.fn()
    }))

    configurationGet.mockImplementation((key: string) => {
      if (key === 'mcp.enabled') return true
      if (key === 'mcp.includeExecutionTools') return true
      return undefined
    })

    existsSyncMock.mockReturnValue(true)
  })

  it('registers MCP provider when API is available', () => {
    const context = mockVscodeExtensionContext()
    const extensionPath = '/tmp/fake-extension'
    const asAbsolutePath = jest.fn().mockImplementation((relative: string) => path.join(extensionPath, relative))

    const extensionContext = {
      ...context,
      asAbsolutePath,
      extension: {
        packageJSON: { version: '2.9.0' }
      }
    } as unknown as vscode.ExtensionContext

    const driver = new BitbakeDriver()
    driver.bitbakeSettings = { pathToBitbakeFolder: '/tmp/poky/bitbake' }

    registerMcpServerProvider(extensionContext, driver)

    expect(registerMcpSpy).toHaveBeenCalledTimes(1)
    expect(registerMcpSpy).toHaveBeenCalledWith('bitbake.mcp', expect.objectContaining({
      provideMcpServerDefinitions: expect.any(Function)
    }))
  })

  it('provides no server definitions when mcp is disabled', async () => {
    configurationGet.mockImplementation((key: string) => {
      if (key === 'mcp.enabled') return false
      if (key === 'mcp.includeExecutionTools') return true
      return undefined
    })

    const context = mockVscodeExtensionContext()
    const extensionContext = {
      ...context,
      asAbsolutePath: jest.fn().mockReturnValue('/tmp/fake-extension/client/out/mcp/server.js'),
      extension: {
        packageJSON: { version: '2.9.0' }
      }
    } as unknown as vscode.ExtensionContext

    const driver = new BitbakeDriver()
    driver.bitbakeSettings = { pathToBitbakeFolder: '/tmp/poky/bitbake' }

    registerMcpServerProvider(extensionContext, driver)

    const provider = registerMcpSpy.mock.calls[0][1] as vscode.McpServerDefinitionProvider
    const servers = await provider.provideMcpServerDefinitions({} as vscode.CancellationToken)

    expect(servers).toEqual([])
  })

  it('returns stdio server definition when enabled and entrypoint exists', async () => {
    const context = mockVscodeExtensionContext()
    const extensionContext = {
      ...context,
      asAbsolutePath: jest.fn().mockReturnValue('/tmp/fake-extension/client/out/mcp/server.js'),
      extension: {
        packageJSON: { version: '2.9.0' }
      }
    } as unknown as vscode.ExtensionContext

    const driver = new BitbakeDriver()
    driver.bitbakeSettings = {
      pathToBitbakeFolder: '/tmp/poky/bitbake',
      workingDirectory: '/tmp/workspace'
    }

    registerMcpServerProvider(extensionContext, driver)

    const provider = registerMcpSpy.mock.calls[0][1] as vscode.McpServerDefinitionProvider
    const servers = await provider.provideMcpServerDefinitions({} as vscode.CancellationToken)

    expect(Array.isArray(servers)).toBe(true)
    expect(servers?.length).toBe(1)
    const server = servers?.[0] as vscode.McpStdioServerDefinition
    expect(server.label).toBe('BitBake MCP Server')
    expect(server.command).toBe(process.execPath)
    expect(server.args).toContain('/tmp/fake-extension/client/out/mcp/server.js')
  })
})
