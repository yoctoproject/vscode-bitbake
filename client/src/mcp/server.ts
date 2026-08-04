/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs'
import * as path from 'path'
import fg from 'fast-glob'
import { spawn } from 'child_process'
import { extractRecipeName, extractRecipeVersion } from '../lib/src/utils/files'
import { getBuildSetting, sanitizeForShell, type BitbakeSettings } from '../lib/src/BitbakeSettings'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

type JsonRpcResponse = {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

type Tool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: {
    title?: string
    readOnlyHint?: boolean
  }
}

type ToolResult = {
  content: Array<{ type: 'text', text: string }>
  isError?: boolean
}

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_NAME = 'yocto-bitbake'
const SERVER_VERSION = process.env.BITBAKE_EXTENSION_VERSION ?? '0.0.0'

const WORKSPACE_ROOT = process.env.BITBAKE_WORKSPACE_ROOT ?? process.cwd()
const ACTIVE_BUILD_CONFIGURATION = process.env.BITBAKE_ACTIVE_BUILD_CONFIGURATION ?? 'No BitBake configuration'
const INCLUDE_EXECUTION_TOOLS = process.env.BITBAKE_MCP_INCLUDE_EXECUTION_TOOLS !== 'false'
const DEBUG_LOG_PATH = process.env.BITBAKE_MCP_DEBUG_LOG ?? path.join(process.cwd(), '.bitbake-mcp-debug.log')

const rawSettings = process.env.BITBAKE_SETTINGS_JSON
const BITBAKE_SETTINGS: BitbakeSettings = rawSettings !== undefined
  ? JSON.parse(rawSettings) as BitbakeSettings
  : { pathToBitbakeFolder: WORKSPACE_ROOT, workingDirectory: WORKSPACE_ROOT }

// TODO(MCP): replace the custom stdio framing loop with the official MCP SDK transport once the tool surface stabilizes.
// TODO(MCP) user-facing roadmap:
// TODO(MCP) - Hover inspection: show BitBake variable values, final expanded values, and linked documentation.
// TODO(MCP) - Language intelligence: completions, definitions, references, rename, document links, and symbol navigation.
// TODO(MCP) - Recipe/environment inspection: scan recipes, scan global env, query layers, classes, conf files, and workspace summaries.
// TODO(MCP) - Recipe-local discovery: find local files/dirs, include/require targets, and recipe-specific filesystem links.
// TODO(MCP) - BitBake actions: build, clean, run task, parse, environment scan, and custom controlled commands.
// TODO(MCP) - Devtool workflows: modify, update, reset, build, deploy, clean, open workspace, and configure SDK/fallback flows.
// TODO(MCP) - Runtime helpers: open recipe workdir, open devshell, start/stop toaster, and open an interactive BitBake terminal profile.
const encoder = new TextEncoder()
let inputBuffer = Buffer.alloc(0)
let requestChain: Promise<void> = Promise.resolve()

function logInternalError (message: string): void {
  process.stderr.write(`[bitbake-mcp] ${message}\n`)
  if (DEBUG_LOG_PATH !== undefined && DEBUG_LOG_PATH !== '') {
    try {
      fs.appendFileSync(DEBUG_LOG_PATH, `[error] ${new Date().toISOString()} ${message}\n`)
    } catch {
      // Ignore debug log errors.
    }
  }
}

function logDebug (message: string): void {
  if (DEBUG_LOG_PATH === undefined || DEBUG_LOG_PATH === '') {
    return
  }
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `[debug] ${new Date().toISOString()} ${message}\n`)
  } catch {
    // Ignore debug log errors.
  }
}

function writeResponse (response: JsonRpcResponse): void {
  const payload = JSON.stringify(response)
  const size = Buffer.byteLength(payload, 'utf8')
  process.stdout.write(`Content-Length: ${size}\r\n\r\n${payload}`)
}

function writeNotification (method: string, params: Record<string, unknown>): void {
  const payload = JSON.stringify({ jsonrpc: '2.0', method, params })
  const size = Buffer.byteLength(payload, 'utf8')
  process.stdout.write(`Content-Length: ${size}\r\n\r\n${payload}`)
}

function decodeMessages (chunk: Buffer): JsonRpcRequest[] {
  logDebug(`decodeMessages chunkBytes=${chunk.byteLength}`)
  inputBuffer = Buffer.concat([inputBuffer, chunk])
  const requests: JsonRpcRequest[] = []

  while (true) {
    const crlfHeaderEnd = inputBuffer.indexOf('\r\n\r\n')
    const lfHeaderEnd = inputBuffer.indexOf('\n\n')

    let headerEnd = -1
    let headerSeparatorLength = 0

    if (crlfHeaderEnd !== -1 && (lfHeaderEnd === -1 || crlfHeaderEnd <= lfHeaderEnd)) {
      headerEnd = crlfHeaderEnd
      headerSeparatorLength = 4
    } else if (lfHeaderEnd !== -1) {
      headerEnd = lfHeaderEnd
      headerSeparatorLength = 2
    }

    if (headerEnd === -1) {
      break
    }

    const headerBytes = inputBuffer.subarray(0, headerEnd).toString('utf8')
    const contentLengthMatch = headerBytes.match(/Content-Length:\s*(\d+)/i)
    if (contentLengthMatch === null) {
      inputBuffer = inputBuffer.subarray(headerEnd + headerSeparatorLength)
      continue
    }

    const contentLength = parseInt(contentLengthMatch[1], 10)
    const messageStart = headerEnd + headerSeparatorLength
    const messageEnd = messageStart + contentLength
    if (inputBuffer.length < messageEnd) {
      break
    }

    const body = inputBuffer.subarray(messageStart, messageEnd).toString('utf8')
    inputBuffer = inputBuffer.subarray(messageEnd)

    try {
      const parsed = JSON.parse(body) as JsonRpcRequest | JsonRpcRequest[]
      if (Array.isArray(parsed)) {
        for (const request of parsed) {
          if (typeof request?.method === 'string') {
            logDebug(`decoded batch method=${request.method} id=${String(request.id)}`)
            requests.push(request)
          }
        }
      } else if (typeof parsed?.method === 'string') {
        logDebug(`decoded method=${parsed.method} id=${String(parsed.id)}`)
        requests.push(parsed)
      } else {
        logDebug('decoded unsupported JSON-RPC payload shape')
      }
    } catch (error) {
      logInternalError(`Failed to parse JSON-RPC message: ${String(error)}`)
    }
  }

  return requests
}

function safeRelativePath (absolutePath: string): string {
  return path.relative(WORKSPACE_ROOT, absolutePath).split(path.sep).join('/')
}

function maskSensitiveObject (obj: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...obj }
  for (const key of Object.keys(clone)) {
    if (/token|secret|password|passwd|key/i.test(key)) {
      clone[key] = '***'
    }
  }
  return clone
}

function composeBitbakeScript (command: string): string {
  const commandWrapper = getBuildSetting(BITBAKE_SETTINGS, ACTIVE_BUILD_CONFIGURATION, 'commandWrapper')
  const pathToEnvScript = getBuildSetting(BITBAKE_SETTINGS, ACTIVE_BUILD_CONFIGURATION, 'pathToEnvScript')
  const pathToBuildFolder = getBuildSetting(BITBAKE_SETTINGS, ACTIVE_BUILD_CONFIGURATION, 'pathToBuildFolder')

  let script = ''
  if (typeof commandWrapper === 'string' && commandWrapper !== '') {
    script += `${commandWrapper} '`
  }

  if (typeof pathToEnvScript === 'string' && pathToEnvScript !== '') {
    script += `. ${pathToEnvScript}`
    if (typeof pathToBuildFolder === 'string' && pathToBuildFolder !== '') {
      script += ` ${pathToBuildFolder}`
    }
    script += ' && '
  }

  script += command

  if (typeof commandWrapper === 'string' && commandWrapper !== '') {
    script += "'"
  }

  return script
}

function getShellEnv (): NodeJS.ProcessEnv {
  const configured = getBuildSetting(BITBAKE_SETTINGS, ACTIVE_BUILD_CONFIGURATION, 'shellEnv')
  const shellEnv = typeof configured === 'object' && configured !== null
    ? configured as NodeJS.Dict<string>
    : {}
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(shellEnv)) {
    env[key] = value
  }
  return env
}

async function runShellScript (script: string): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  return await new Promise((resolve) => {
    const shell = process.env.SHELL ?? '/bin/sh'
    const workingDirectory = getBuildSetting(BITBAKE_SETTINGS, ACTIVE_BUILD_CONFIGURATION, 'workingDirectory')
    const cwd = typeof workingDirectory === 'string' && workingDirectory !== '' ? workingDirectory : WORKSPACE_ROOT

    const child = spawn(shell, ['-c', script], {
      cwd,
      env: getShellEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf8')
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf8')
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr
      })
    })
  })
}

function listTools (): Tool[] {
  // TODO(MCP): add read-only workspace intelligence tools backed by the existing BitBake scan state.
  // TODO(MCP): expose hover/documentation, recipe, layer, variable, link, and local file queries as separate tools.
  // TODO(MCP): keep these tools read-only so agents can inspect the workspace without triggering BitBake.
  const tools: Tool[] = [
    {
      name: 'bitbake_get_workspace_summary',
      description: 'Get BitBake workspace file statistics and basic metadata.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { title: 'Get Workspace Summary', readOnlyHint: true }
    },
    {
      name: 'bitbake_list_recipes',
      description: 'List recipe files (.bb) discovered in the workspace.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 5000 },
          nameContains: { type: 'string' }
        }
      },
      annotations: { title: 'List Recipes', readOnlyHint: true }
    },
    {
      name: 'bitbake_get_settings',
      description: 'Return resolved BitBake settings used by the MCP server.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { title: 'Get BitBake Settings', readOnlyHint: true }
    },
    {
      name: 'bitbake_show_layers',
      description: 'Run bitbake-layers show-layers and return parsed layer information.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { title: 'Show Layers', readOnlyHint: true }
    }
  ]

  if (INCLUDE_EXECUTION_TOOLS) {
    // TODO(MCP): split execution actions into smaller tools for build, clean, task, scan, devtool, and toaster flows.
    // TODO(MCP): enforce per-tool risk levels so mutating operations can require explicit user confirmation.
    tools.push({
      name: 'bitbake_run_command',
      description: 'Run a controlled BitBake command (build, clean, task, parse, environment scan, or custom).',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: {
            type: 'string',
            enum: ['build', 'clean', 'task', 'parse', 'scan_recipe_env', 'scan_global_env', 'custom']
          },
          recipe: { type: 'string' },
          task: { type: 'string' },
          customCommand: { type: 'string' }
        },
        required: ['mode']
      },
      annotations: { title: 'Run BitBake Command', readOnlyHint: false }
    })
  }

  return tools
}

function asTextResult (value: unknown): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(value, null, 2)
    }]
  }
}

function asErrorResult (message: string, data?: unknown): ToolResult {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({ message, data }, null, 2)
    }]
  }
}

async function callTool (name: string, args: Record<string, unknown>): Promise<ToolResult> {
  // TODO(MCP): route all tool implementations through a shared BitBake agent service so MCP and UI commands never drift.
  // TODO(MCP): implement hover/documentation and other language-server-backed reads here once the shared service exists.
  if (name === 'bitbake_get_workspace_summary') {
    const files = await fg(['**/*.bb', '**/*.bbappend', '**/*.bbclass', '**/*.inc', '**/*.conf'], {
      cwd: WORKSPACE_ROOT,
      onlyFiles: true,
      absolute: false,
      dot: false,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**', '**/.git/**', '**/build/**']
    })

    const summary = {
      workspaceRoot: WORKSPACE_ROOT,
      activeBuildConfiguration: ACTIVE_BUILD_CONFIGURATION,
      counts: {
        recipes: files.filter(file => file.endsWith('.bb')).length,
        appends: files.filter(file => file.endsWith('.bbappend')).length,
        classes: files.filter(file => file.endsWith('.bbclass')).length,
        includes: files.filter(file => file.endsWith('.inc')).length,
        conf: files.filter(file => file.endsWith('.conf')).length
      }
    }
    return asTextResult(summary)
  }

  if (name === 'bitbake_list_recipes') {
    const limit = typeof args.limit === 'number' ? Math.max(1, Math.min(5000, Math.floor(args.limit))) : 500
    const nameContains = typeof args.nameContains === 'string' ? args.nameContains.toLowerCase() : undefined

    const recipeFiles = await fg(['**/*.bb'], {
      cwd: WORKSPACE_ROOT,
      onlyFiles: true,
      absolute: true,
      dot: false,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**', '**/.git/**', '**/build/**']
    })

    const recipes = recipeFiles
      .map((absolutePath) => ({
        name: extractRecipeName(absolutePath),
        version: extractRecipeVersion(absolutePath),
        path: safeRelativePath(absolutePath)
      }))
      .filter((recipe) => nameContains === undefined || recipe.name.toLowerCase().includes(nameContains))
      .slice(0, limit)

    return asTextResult({
      total: recipes.length,
      recipes
    })
  }

  if (name === 'bitbake_get_settings') {
    const safeSettings = {
      ...BITBAKE_SETTINGS,
      shellEnv: BITBAKE_SETTINGS.shellEnv !== undefined
        ? maskSensitiveObject(BITBAKE_SETTINGS.shellEnv as Record<string, unknown>)
        : undefined,
      buildConfigurations: BITBAKE_SETTINGS.buildConfigurations?.map((buildConfig) => ({
        ...buildConfig,
        shellEnv: buildConfig.shellEnv !== undefined
          ? maskSensitiveObject(buildConfig.shellEnv as Record<string, unknown>)
          : undefined
      }))
    }

    return asTextResult({
      activeBuildConfiguration: ACTIVE_BUILD_CONFIGURATION,
      includeExecutionTools: INCLUDE_EXECUTION_TOOLS,
      settings: safeSettings
    })
  }

  if (name === 'bitbake_show_layers') {
    const script = composeBitbakeScript('bitbake-layers show-layers')
    const result = await runShellScript(script)

    const lines = result.stdout.split(/\r?\n/)
    const layers: Array<{ name: string, path: string, priority: number | null }> = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '' || /^layer\s+path\s+priority$/i.test(trimmed) || /^=+$/.test(trimmed)) {
        continue
      }

      const parts = trimmed.split(/\s+/)
      if (parts.length < 3) {
        continue
      }

      const [layerName, layerPath, priorityRaw] = parts
      const priority = Number.isNaN(Number(priorityRaw)) ? null : Number(priorityRaw)
      layers.push({ name: layerName, path: layerPath, priority })
    }

    return asTextResult({
      exitCode: result.exitCode,
      layers,
      stderr: result.stderr.trim() === '' ? undefined : result.stderr.trim()
    })
  }

  if (name === 'bitbake_run_command') {
    // TODO(MCP): validate recipes/tasks against the active scan result before launching any command.
    // TODO(MCP): stream progress and tail logs back to the MCP client for long-running commands.
    if (!INCLUDE_EXECUTION_TOOLS) {
      return asErrorResult('Execution tools are disabled by configuration.')
    }

    const mode = args.mode
    if (typeof mode !== 'string') {
      return asErrorResult('Missing required argument: mode')
    }

    const recipe = typeof args.recipe === 'string' ? sanitizeForShell(args.recipe) : undefined
    const task = typeof args.task === 'string' ? sanitizeForShell(args.task) : undefined
    const customCommand = typeof args.customCommand === 'string' ? sanitizeForShell(args.customCommand) : undefined

    let bitbakeCommand: string
    switch (mode) {
      case 'build':
        if (recipe === undefined || recipe === '') return asErrorResult('Argument recipe is required for mode build')
        bitbakeCommand = `bitbake ${recipe}`
        break
      case 'clean':
        if (recipe === undefined || recipe === '') return asErrorResult('Argument recipe is required for mode clean')
        bitbakeCommand = `bitbake ${recipe} -c clean`
        break
      case 'task':
        if (recipe === undefined || recipe === '') return asErrorResult('Argument recipe is required for mode task')
        if (task === undefined || task === '') return asErrorResult('Argument task is required for mode task')
        bitbakeCommand = `bitbake ${recipe} -c ${task}`
        break
      case 'parse':
        bitbakeCommand = 'bitbake -p'
        break
      case 'scan_recipe_env':
        if (recipe === undefined || recipe === '') return asErrorResult('Argument recipe is required for mode scan_recipe_env')
        bitbakeCommand = `bitbake ${recipe} -e`
        break
      case 'scan_global_env':
        bitbakeCommand = 'bitbake -e'
        break
      case 'custom':
        if (customCommand === undefined || customCommand === '') {
          return asErrorResult('Argument customCommand is required for mode custom')
        }
        bitbakeCommand = customCommand
        break
      default:
        return asErrorResult(`Unknown mode: ${mode}`)
    }

    const script = composeBitbakeScript(bitbakeCommand)
    const runResult = await runShellScript(script)

    return asTextResult({
      mode,
      command: bitbakeCommand,
      script,
      exitCode: runResult.exitCode,
      stdout: runResult.stdout,
      stderr: runResult.stderr
    })
  }

  return asErrorResult(`Unknown tool: ${name}`)
}

async function handleRequest (request: JsonRpcRequest): Promise<void> {
  logDebug(`handleRequest method=${request.method} id=${String(request.id)}`)
  const id = request.id ?? null

  if (request.method === 'initialize') {
    writeResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      }
    })
    return
  }

  if (request.method === 'notifications/initialized') {
    return
  }

  if (request.method === 'ping') {
    writeResponse({
      jsonrpc: '2.0',
      id,
      result: {}
    })
    return
  }

  if (request.method === 'tools/list') {
    writeResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: listTools()
      }
    })
    return
  }

  if (request.method === 'tools/call') {
    const params = request.params ?? {}
    const name = params.name
    const args = (params.arguments ?? {}) as Record<string, unknown>

    if (typeof name !== 'string') {
      writeResponse({
        jsonrpc: '2.0',
        id,
        result: asErrorResult('Invalid tool call: missing tool name') as unknown as JsonValue
      })
      return
    }

    const result = await callTool(name, args)
    writeResponse({
      jsonrpc: '2.0',
      id,
      result: result as unknown as JsonValue
    })
    return
  }

  writeResponse({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${request.method}`
    }
  })
}

process.stdin.on('data', (chunk: Buffer | string) => {
  // TODO(MCP): add protocol-level tests for chunking, batching, and cancellation once more tools are added.
  requestChain = requestChain.then(async () => {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')
    const messages = decodeMessages(chunkBuffer)
    if (messages.length === 0) {
      logDebug(`no complete JSON-RPC message decoded, bufferedBytes=${inputBuffer.byteLength}`)
    }
    for (const message of messages) {
      await handleRequest(message)
    }
  }).catch((error) => {
    logInternalError(`Request loop error: ${String(error)}`)
  })
})

process.stdin.on('error', (error) => {
  logInternalError(`stdin error: ${String(error)}`)
})

process.on('uncaughtException', (error) => {
  logInternalError(`uncaughtException: ${String(error)}`)
})

// Keep the process alive and consume stdio using the MCP framing protocol.
logDebug(`server started pid=${process.pid} cwd=${process.cwd()} argv=${JSON.stringify(process.argv)}`)
process.stdin.resume()
