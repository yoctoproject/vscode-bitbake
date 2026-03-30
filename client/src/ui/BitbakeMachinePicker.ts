/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { type BitbakeSettings } from '../lib/src/BitbakeSettings'
import { logger } from '../lib/src/utils/OutputLogger'

export class BitbakeMachinePicker {
  readonly statusBarItem: vscode.StatusBarItem
  private bitbakeSettings: BitbakeSettings
  private readonly memento: vscode.Memento | undefined
  private _activeMachine: string = ''

  public get activeMachine (): string {
    return this._activeMachine
  }

  private set activeMachine (value: string) {
    this._activeMachine = value
    void this.memento?.update('BitbakeMachinePicker.activeMachine', value)
    logger.info(`BitBake MACHINE changed to ${value}`)
  }

  constructor (bitbakeSettings: BitbakeSettings, context: vscode.ExtensionContext) {
    this.bitbakeSettings = bitbakeSettings
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -1)
    this.memento = context.workspaceState

    // Prefer workspaceState (runtime choice) over settings.machine (configured default)
    const storedMachine = this.memento?.get<string>('BitbakeMachinePicker.activeMachine')
    this._activeMachine = storedMachine ?? bitbakeSettings.machine ?? ''

    this.statusBarItem.command = 'bitbake.pick-machine'
    this.statusBarItem.tooltip = 'Select BitBake MACHINE'
    context.subscriptions.push(vscode.commands.registerCommand('bitbake.pick-machine', this.pickMachine, this))
    this.updateStatusBar(bitbakeSettings)
  }

  updateStatusBar (bitbakeSettings: BitbakeSettings): void {
    this.bitbakeSettings = bitbakeSettings
    const hasBuildFolder = bitbakeSettings?.pathToBuildFolder !== undefined && bitbakeSettings.pathToBuildFolder !== ''
    if (hasBuildFolder) {
      const displayMachine = this._activeMachine !== '' ? this._activeMachine : 'No MACHINE'
      this.statusBarItem.text = '$(chip) ' + displayMachine
      this.statusBarItem.show()
    } else {
      this.statusBarItem.hide()
    }
  }

  public async pickMachine (): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter BitBake MACHINE name',
      placeHolder: 'e.g. qemux86-64',
      value: this._activeMachine !== '' ? this._activeMachine : undefined
    })
    if (input !== undefined && input !== '') {
      this.activeMachine = input
      this.updateStatusBar(this.bitbakeSettings)
      await this.writeMachineToLocalConf(input)
    }
  }

  private async writeMachineToLocalConf (machine: string): Promise<void> {
    const buildFolder = this.bitbakeSettings?.pathToBuildFolder
    if (buildFolder === undefined || buildFolder === '') {
      void vscode.window.showWarningMessage('BitBake: pathToBuildFolder is not set. Cannot write MACHINE to conf/local.conf.')
      return
    }

    const confDir = path.join(buildFolder, 'conf')
    // YRA Finding 2: conf/ may not exist if oe-init-build-env has not been run yet
    if (!fs.existsSync(confDir)) {
      void vscode.window.showWarningMessage(
        `BitBake: conf/ directory not found at "${confDir}". Run oe-init-build-env to initialize the build directory first.`
      )
      return
    }

    const localConfPath = path.join(confDir, 'local.conf')
    try {
      let content = ''
      if (fs.existsSync(localConfPath)) {
        content = fs.readFileSync(localConfPath, 'utf8')
      }

      // YRA Finding 1: match all Yocto assignment operators (??=, ?=, =) so a
      // pre-existing 'MACHINE ??= "qemux86-64"' weak-default line is replaced
      // rather than leaving a stale line alongside the new one.
      const machineRegex = /^MACHINE\s*(?:\?\?=|\?=|=)\s*".*".*$/m
      const newLine = `MACHINE = "${machine}"`
      if (machineRegex.test(content)) {
        content = content.replace(machineRegex, newLine)
      } else {
        content = content + (content.length > 0 && !content.endsWith('\n') ? '\n' : '') + newLine + '\n'
      }

      fs.writeFileSync(localConfPath, content, 'utf8')
      logger.info(`BitBake: MACHINE set to "${machine}" in ${localConfPath}`)
    } catch (err) {
      void vscode.window.showErrorMessage(`BitBake: Failed to write MACHINE to conf/local.conf: ${String(err)}`)
    }
  }
}
