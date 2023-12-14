/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'
import fs from 'fs'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeSettings, loadBitbakeSettings } from '../lib/src/BitbakeSettings'
import { clientNotificationManager } from '../ui/ClientNotificationManager'
import { type BitbakeTaskDefinition } from '../ui/BitbakeTaskProvider'
import { runBitbakeTerminalCustomCommand } from '../ui/BitbakeTerminal'
import { finishProcessExecution } from '../lib/src/utils/ProcessUtils'

/// This class is responsible for wrapping up all bitbake classes and exposing them to the extension
export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = { pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '', workingDirectory: '', commandWrapper: '' }
  bitbakeActive = false

  loadSettings (settings: any, workspaceFolder: string = '.'): void {
    this.bitbakeSettings = loadBitbakeSettings(settings, workspaceFolder)
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }

  private async waitForBitbakeToFinish (): Promise<void> {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!this.bitbakeActive) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    })
  }

  /// Execute a command in the bitbake environment
  async spawnBitbakeProcess (command: string): Promise<childProcess.ChildProcess> {
    const { shell, script } = this.prepareCommand(command)
    await this.waitForBitbakeToFinish()
    logger.debug(`Executing Bitbake command with ${shell}: ${script}`)
    this.bitbakeActive = true
    const child = childProcess.spawn(script, {
      shell,
      cwd: this.bitbakeSettings.workingDirectory,
      env: { ...process.env, ...this.bitbakeSettings.shellEnv }
    })
    child.on('close', () => {
      this.bitbakeActive = false
    })
    return child
  }

  private prepareCommand (command: string): {
    shell: string
    script: string
  } {
    const shell = process.env.SHELL ?? '/bin/sh'
    const script = this.composeBitbakeScript(command)
    return { shell, script }
  }

  composeBitbakeScript (command: string): string {
    // Here are some examples commands that we want to support:
    // . sources/poky/oe-init-build-env build && bitbake busybox
    // cqfd run -c '-- bitbake busybox'
    // kas shell -c 'bitbake busybox'
    // docker run --rm -it -v $PWD:/workdir crops/poky --workdir=/workdir /bin/bash -c '. sources/poky/oe-init-build-env build && bitbake busybox'

    let script = ''

    if (this.bitbakeSettings.commandWrapper !== undefined) {
      script += this.bitbakeSettings.commandWrapper + " '"
    }

    if (this.bitbakeSettings.pathToEnvScript !== undefined) {
      script += `. ${this.bitbakeSettings.pathToEnvScript}`
      if (this.bitbakeSettings.pathToBuildFolder !== undefined) {
        script += ` ${this.bitbakeSettings.pathToBuildFolder}`
      }
      script += ' && '
    }
    script += command

    if (this.bitbakeSettings.commandWrapper !== undefined) {
      script += "'"
    }

    return script
  }

  async checkBitbakeSettingsSanity (): Promise<boolean> {
    const bitbakeFolder = this.bitbakeSettings.pathToBitbakeFolder
    const bitbakeBinPath = bitbakeFolder + '/bin/bitbake'

    if (!fs.existsSync(bitbakeBinPath)) {
      clientNotificationManager.showBitbakeError("Bitbake binary doesn't exist: " + bitbakeBinPath)
      return false
    }

    const pathToEnvScript = this.bitbakeSettings.pathToEnvScript
    if (this.bitbakeSettings.commandWrapper === undefined && pathToEnvScript !== undefined && !fs.existsSync(pathToEnvScript)) {
      clientNotificationManager.showBitbakeError("Bitbake environment script doesn't exist: " + pathToEnvScript)
      return false
    }

    const command = 'which bitbake'
    const process = runBitbakeTerminalCustomCommand(this, command, 'Bitbake: Sanity test', true)
    const ret = await finishProcessExecution(process)
    if (ret.status !== 0) {
      const errorMsg = `Command "${command}" returned ${ret.status}.\n See Bitbake Terminal for command output.`
      // The BitbakeTerminal focuses on it's own on error
      clientNotificationManager.showBitbakeError(errorMsg)
      return false
    }

    return true
  }

  composeBitbakeCommand (bitbakeTaskDefinition: BitbakeTaskDefinition): string {
    function appendCommandParam (command: string, param: string): string {
      return command + ' ' + param
    }

    let command = 'bitbake'

    bitbakeTaskDefinition.recipes?.forEach(recipe => {
      command = appendCommandParam(command, `${recipe}`)
    })
    if (bitbakeTaskDefinition.task !== undefined) {
      command = appendCommandParam(command, `-c ${bitbakeTaskDefinition.task}`)
    }
    if (bitbakeTaskDefinition.options?.continue === true) {
      command = appendCommandParam(command, '-k')
    }
    if (bitbakeTaskDefinition.options?.force === true) {
      command = appendCommandParam(command, '-f')
    }
    if (bitbakeTaskDefinition.options?.parseOnly === true) {
      command = appendCommandParam(command, '-p')
    }

    return command
  }
}
