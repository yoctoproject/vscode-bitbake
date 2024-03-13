/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import type { IPty } from 'node-pty'
import { BitbakeTerminal, bitbakeTerminals } from './BitbakeTerminal'
import { BitbakeDriver } from '../driver/BitbakeDriver'
import { pty } from '../utils/ProcessUtils'
import { logger } from '../lib/src/utils/OutputLogger'
import { loadBitbakeSettings } from '../lib/src/BitbakeSettings'

const DEFAULT_TOASTER_PORT = 8000

export class ToasterPanel {
  /**
  * Track the currently panel. Only allow a single panel to exist at a time.
  */
  public static currentPanel: ToasterPanel | undefined
  public static toasterProcess: IPty | undefined
  public static readonly viewType = 'bitbake.toasterView'

  private readonly _panel: vscode.WebviewPanel
  private readonly _disposables: vscode.Disposable[] = []

  public static createOrShow (): void {
    const column = vscode.window.activeTextEditor !== undefined
      ? vscode.window.activeTextEditor.viewColumn
      : undefined

    // If we already have a panel, show it.
    if (ToasterPanel.currentPanel !== undefined) {
      ToasterPanel.currentPanel._panel.reveal(column)
      return
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      ToasterPanel.viewType,
      'Yocto Toaster',
      column ?? vscode.ViewColumn.One,
      getWebviewOptions()
    )

    ToasterPanel.currentPanel = new ToasterPanel(panel)
  }

  // Close the webview and stop the toaster
  public static stop (): void {
    ToasterPanel.currentPanel?.dispose()
  }

  // A custom replicate of runBitbakeCommand() from BitbakeTerminal.ts
  private static async runToasterCommand (command: string, isBackground: boolean = false, terminalName: string = 'Toaster'): Promise<IPty> {
    let terminal: BitbakeTerminal | undefined
    for (const t of bitbakeTerminals) {
      if (!t.pty.isBusy()) {
        terminal = t
        terminal.pty.changeNameEmitter.fire(terminalName)
        break
      }
    }

    if (terminal === undefined) {
      const bitbakeDriver = new BitbakeDriver()
      terminal = new BitbakeTerminal(terminalName, bitbakeDriver)

      await new Promise(resolve => terminal?.pty.onDidOpen.event(resolve))
    }

    if (!isBackground) {
      terminal.terminal.show()
    }
    const process = ToasterPanel.spawnToasterProcess(command)
    await terminal.pty.runProcess(process, command, terminalName)
    return await process
  }

  // A custom replicate of spawnBitbakeProcess() from BitbakeDriver.ts
  private static async spawnToasterProcess (command: string): Promise<IPty> {
    // TODO: check if the env file exists
    const script = 'source oe-init-build-env' + ' && ' + command
    const shell = process.env.SHELL ?? '/bin/sh'

    if (vscode.workspace.workspaceFolders === undefined) {
      logger.error('[spawnToasterProcess] No workspace folder found')
      return pty.spawn(shell, ['-c', 'echo "No workspace folder found"'], {})
    }

    const cwd = loadBitbakeSettings(vscode.workspace.getConfiguration('bitbake'), vscode.workspace.workspaceFolders[0].uri.fsPath).workingDirectory

    // wait for the previous process to finish
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (ToasterPanel.toasterProcess === undefined) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    })

    logger.debug(`Executing Bitbake command with ${shell} in ${cwd}: ${script}`)
    const child = pty.spawn(
      shell,
      ['-c', script],
      {
        cwd
      }
    )

    ToasterPanel.toasterProcess = child

    child.onData(() => {
      logger.debug('Toaster process onData event')
    })
    child.onExit(() => {
      ToasterPanel.toasterProcess = undefined
      logger.debug('Toaster process exited')
    })
    return child
  }

  private constructor (panel: vscode.WebviewPanel) {
    this._panel = panel

    void ToasterPanel.runToasterCommand('source toaster start', true).then(() => {
      // Set the webview's initial html content
      this._setInitialView()
    })

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => { this.dispose() }, null, this._disposables)

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        // handle message
      },
      null,
      this._disposables
    )
  }

  public dispose (): void {
    ToasterPanel.currentPanel = undefined

    void ToasterPanel.runToasterCommand('source toaster stop', true)

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length > 0) {
      const x = this._disposables.pop()
      if (x !== undefined) {
        x.dispose()
      }
    }
  }

  private _setInitialView (): void {
    this._panel.title = 'Yocto Toaster'
    this._panel.webview.html = this._getHtmlForWebview()
  }

  private _getHtmlForWebview (): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Toaster</title>
        </head>
        <body>
            <iframe src="http://localhost:${DEFAULT_TOASTER_PORT}" width="100%" height="800"></iframe>
        </body>
        </html>`
  }
}

function getWebviewOptions (): vscode.WebviewOptions {
  return {
    portMapping: [
      {
        webviewPort: DEFAULT_TOASTER_PORT,
        extensionHostPort: DEFAULT_TOASTER_PORT
      }
    ]

  }
}
