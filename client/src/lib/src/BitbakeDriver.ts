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

  loadSettings (settings: any, workspaceFolder: string = '.'): void {
    this.bitbakeSettings = loadBitbakeSettings(settings, workspaceFolder)
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }

  /// Execute a command in the bitbake environment
  spawnBitbakeProcess (command: string): childProcess.ChildProcess {
    const { shell, script } = this.prepareCommand(command)
    logger.debug(`Executing Bitbake command: ${shell} -c ${script}`)
    return childProcess.spawn(script, {
      shell,
      cwd: this.bitbakeSettings.workingDirectory
    })
  }

  /// Execute a command in the bitbake environment and wait for completion
  spawnBitbakeProcessSync (command: string): childProcess.SpawnSyncReturns<Buffer> {
    const { shell, script } = this.prepareCommand(command)
    logger.debug(`Executing Bitbake command (sync): ${shell} -c ${command}`)
    return childProcess.spawnSync(script, {
      shell,
      cwd: this.bitbakeSettings.workingDirectory
    })
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
