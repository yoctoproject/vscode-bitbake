/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'

import { logger } from './utils/OutputLogger'
import { type BitbakeSettings, loadBitbakeSettings } from './BitbakeSettings'

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
    logger.debug(`Executing Bitbake command: ${shell} -c ${script}`)
    this.bitbakeActive = true
    const child = childProcess.spawn(script, {
      shell,
      cwd: this.bitbakeSettings.workingDirectory
    })
    child.on('close', () => {
      this.bitbakeActive = false
    })
    return child
  }

  /// Execute a command in the bitbake environment and wait for completion
  async spawnBitbakeProcessSync (command: string): Promise<childProcess.SpawnSyncReturns<Buffer>> {
    const { shell, script } = this.prepareCommand(command)
    await this.waitForBitbakeToFinish()
    logger.debug(`Executing Bitbake command (sync): ${shell} -c ${command}`)
    this.bitbakeActive = true
    const ret = childProcess.spawnSync(script, {
      shell,
      cwd: this.bitbakeSettings.workingDirectory
    })
    this.bitbakeActive = false
    return ret
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
}
