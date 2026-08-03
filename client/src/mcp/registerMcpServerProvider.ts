/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'
import * as fs from 'fs'
import * as vscode from 'vscode'
import { type BitbakeDriver } from '../driver/BitbakeDriver'
import { logger } from '../lib/src/utils/OutputLogger'

const MCP_PROVIDER_ID = 'bitbake.mcp'
const MCP_SERVER_LABEL = 'BitBake MCP Server'

function getWorkspaceRoot (): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
}

function shouldEnableMcp (): boolean {
  const config = vscode.workspace.getConfiguration('bitbake')
  return config.get<boolean>('mcp.enabled') !== false
}

function shouldIncludeExecutionTools (): boolean {
  const config = vscode.workspace.getConfiguration('bitbake')
  return config.get<boolean>('mcp.includeExecutionTools') !== false
}

function buildMcpServerDefinition (
  context: vscode.ExtensionContext,
  bitbakeDriver: BitbakeDriver
): vscode.McpStdioServerDefinition | undefined {
  const serverPath = context.asAbsolutePath(path.join('client', 'out', 'mcp', 'server.js'))
  if (!fs.existsSync(serverPath)) {
    logger.warn(`MCP server script not found at ${serverPath}`)
    return undefined
  }

  const extensionVersion = String(context.extension.packageJSON.version ?? '0.0.0')
  const workspaceRoot = getWorkspaceRoot() ?? path.dirname(serverPath)

  const server = new vscode.McpStdioServerDefinition(
    MCP_SERVER_LABEL,
    process.execPath,
    [serverPath],
    {
      BITBAKE_WORKSPACE_ROOT: workspaceRoot,
      BITBAKE_SETTINGS_JSON: JSON.stringify(bitbakeDriver.bitbakeSettings),
      BITBAKE_ACTIVE_BUILD_CONFIGURATION: bitbakeDriver.activeBuildConfiguration,
      BITBAKE_MCP_INCLUDE_EXECUTION_TOOLS: shouldIncludeExecutionTools() ? 'true' : 'false',
      BITBAKE_EXTENSION_VERSION: extensionVersion,
      BITBAKE_MCP_DEBUG_LOG: path.join(workspaceRoot, '.bitbake-mcp-debug.log')
    },
    extensionVersion
  )

  server.cwd = vscode.Uri.file(workspaceRoot)
  return server
}

export function registerMcpServerProvider (context: vscode.ExtensionContext, bitbakeDriver: BitbakeDriver): void {
  const registerFn = vscode.lm?.registerMcpServerDefinitionProvider
  if (typeof registerFn !== 'function') {
    logger.info('MCP registration API is not available in this VS Code version')
    return
  }

  const changeEmitter = new vscode.EventEmitter<void>()

  context.subscriptions.push(
    changeEmitter,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('bitbake.mcp') ||
        event.affectsConfiguration('bitbake.buildConfigurations') ||
        event.affectsConfiguration('bitbake.pathToEnvScript') ||
        event.affectsConfiguration('bitbake.pathToBuildFolder') ||
        event.affectsConfiguration('bitbake.pathToBitbakeFolder') ||
        event.affectsConfiguration('bitbake.commandWrapper') ||
        event.affectsConfiguration('bitbake.workingDirectory') ||
        event.affectsConfiguration('bitbake.shellEnv')
      ) {
        changeEmitter.fire()
      }
    })
  )

  const provider: vscode.McpServerDefinitionProvider = {
    onDidChangeMcpServerDefinitions: changeEmitter.event,
    provideMcpServerDefinitions: async () => {
      if (!shouldEnableMcp()) {
        return []
      }
      const server = buildMcpServerDefinition(context, bitbakeDriver)
      return server === undefined ? [] : [server]
    },
    resolveMcpServerDefinition: async (server) => {
      if (server instanceof vscode.McpStdioServerDefinition) {
        const resolved = buildMcpServerDefinition(context, bitbakeDriver)
        return resolved ?? server
      }
      return server
    }
  }

  context.subscriptions.push(registerFn(MCP_PROVIDER_ID, provider))
  logger.info(`Registered MCP server definition provider: ${MCP_PROVIDER_ID}`)
}
