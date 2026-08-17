/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import path from 'path'

import { pty } from '../utils/ProcessUtils'

export interface BitbakeSetupTerminalRunResult {
  exitCode: number
  output: string
}

export async function runBitbakeSetupTerminal (
  executablePath: string,
  argv: string[],
  cwd: string,
  terminalName = 'BitBake: Initialize workspace with bitbake-setup'
): Promise<BitbakeSetupTerminalRunResult> {
  let resolveResult: ((result: BitbakeSetupTerminalRunResult) => void) | undefined
  let rejectResult: ((error: unknown) => void) | undefined

  const result = new Promise<BitbakeSetupTerminalRunResult>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  const writeEmitter = new vscode.EventEmitter<string>()
  const closeEmitter = new vscode.EventEmitter<number>()

  let process: ReturnType<typeof pty.spawn> | undefined
  let output = ''

  const pseudoTerminal: vscode.Pseudoterminal = {
    onDidWrite: writeEmitter.event,
    onDidClose: closeEmitter.event,

    open: (dimensions) => {
      try {
        process = pty.spawn(
          executablePath,
          argv,
          {
            cwd,
            env: processEnvToStrings(processEnv()),
            cols: dimensions?.columns ?? 80,
            rows: dimensions?.rows ?? 30,
            name: 'xterm-color'
          }
        )
      } catch (error) {
        rejectResult?.(error)
        closeEmitter.fire(-1)
        return
      }

      process.onData((data) => {
        output += data
        writeEmitter.fire(data)
      })

      process.onExit((event) => {
        resolveResult?.({
          exitCode: event.exitCode,
          output
        })

        closeEmitter.fire(event.exitCode)
      })
    },

    close: () => {
      process?.kill()
    },

    handleInput: (data) => {
      if (data === '\x03') {
        process?.kill()
      }
    },

    setDimensions: (dimensions) => {
      process?.resize(dimensions.columns, dimensions.rows)
    }
  }

  const terminal = vscode.window.createTerminal({
    name: terminalName,
    pty: pseudoTerminal,
    iconPath: {
      light: vscode.Uri.file(
        path.join(__dirname, '/../../images/yocto-light-icon.svg')
      ),
      dark: vscode.Uri.file(
        path.join(__dirname, '/../../images/yocto-view-icon.svg')
      )
    }
  })

  terminal.show()

  return await result
}

function processEnv (): NodeJS.ProcessEnv {
  return {
    ...process.env
  }
}

function processEnvToStrings (
  environment: NodeJS.ProcessEnv
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}
