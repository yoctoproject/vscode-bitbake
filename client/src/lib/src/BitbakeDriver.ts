/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'

import { logger } from './utils/OutputLogger'
import { type BitbakeSettings, loadBitbakeSettings } from './BitbakeSettings'

/// This class is responsible for wrapping up all bitbake classes and exposing them to the extension
export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = { pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '' }

  loadSettings (settings: any, workspaceFolder: string = ''): void {
    this.bitbakeSettings = loadBitbakeSettings(settings, workspaceFolder)
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }

  /// Execute a command in the bitbake environment
  spawnBitbakeProcess (command: string): childProcess.ChildProcess {
    const { shell, script } = this.prepareCommand(command)
    logger.debug(`Executing Bitbake command: ${shell} -c ${script}`)
    return childProcess.spawn(script, {
      shell
    })
  }

  /// Execute a command in the bitbake environment and wait for completion
  spawnBitbakeProcessSync (command: string): childProcess.SpawnSyncReturns<Buffer> {
    const { shell, script } = this.prepareCommand(command)
    logger.debug(`Executing Bitbake command (sync): ${shell} -c ${command}`)
    return childProcess.spawnSync(script, {
      shell
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

  private composeBitbakeScript (command: string): string {
    let script = ''
    command = sanitizeForShell(command)

    script += 'set -e && '
    script += `. ${sanitizeForShell(this.bitbakeSettings.pathToEnvScript)} ${sanitizeForShell(this.bitbakeSettings.pathToBuildFolder)} && `
    script += command

    script = `echo 'Executing script: ${script}' && ${script}`
    return script
  }
}

/// Santitize a string to be passed in a shell command (remove special characters)
function sanitizeForShell (command: string): string {
  return command.replace(/[;`&|<>\\$(){}!#*?"']/g, '')
}
