/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import childProcess from 'child_process'
import EventEmitter from 'events'

import { logger } from '../lib/src/utils/OutputLogger'
import { type BitbakeSettings, loadBitbakeSettings, sanitizeForShell } from '../lib/src/BitbakeSettings'
import { clientNotificationManager } from '../ui/ClientNotificationManager'
import { type BitbakeTaskDefinition } from '../ui/BitbakeTaskProvider'
import { runBitbakeTerminalCustomCommand } from '../ui/BitbakeTerminal'
import { BITBAKE_EXIT_TIMEOUT, finishProcessExecution } from '../lib/src/utils/ProcessUtils'
import { bitbakeESDKMode, setBitbakeESDKMode } from './BitbakeESDK'

/// This class is responsible for wrapping up all bitbake classes and exposing them to the extension
export class BitbakeDriver {
  bitbakeSettings: BitbakeSettings = { pathToBitbakeFolder: '', pathToBuildFolder: '', pathToEnvScript: '', workingDirectory: '', commandWrapper: '' }
  bitbakeProcess: childProcess.ChildProcess | undefined
  bitbakeProcessCommand: string | undefined
  onBitbakeProcessChange: EventEmitter = new EventEmitter()

  loadSettings (settings: any, workspaceFolder: string = '.'): void {
    this.bitbakeSettings = loadBitbakeSettings(settings, workspaceFolder)
    logger.debug('BitbakeDriver settings updated: ' + JSON.stringify(this.bitbakeSettings))
  }

  private async waitForBitbakeToFinish (): Promise<void> {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.bitbakeProcess === undefined) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    })
  }

  /// Execute a command in the bitbake environment
  async spawnBitbakeProcess (command: string): Promise<childProcess.ChildProcess> {
    const { shell, script } = this.prepareCommand(command)
    const cwd = this.bitbakeSettings.workingDirectory
    await this.waitForBitbakeToFinish()
    logger.debug(`Executing Bitbake command with ${shell} in ${cwd}: ${script}`)
    const child = childProcess.spawn(script, {
      shell,
      cwd,
      env: { ...process.env, ...this.bitbakeSettings.shellEnv }
    })
    this.bitbakeProcess = child
    this.bitbakeProcessCommand = command
    child.on('spawn', () => {
      this.onBitbakeProcessChange.emit('spawn', command)
    })
    child.on('close', () => {
      this.bitbakeProcess = undefined
      this.bitbakeProcessCommand = undefined
      this.onBitbakeProcessChange.emit('close')
    })
    return child
  }

  prepareCommand (command: string): {
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
    // We could test for devtool and bitbake to know if we are in an eSDK or not
    const command = 'which devtool bitbake || true'
    const process = runBitbakeTerminalCustomCommand(this, command, 'Bitbake: Sanity test', true)
    const ret = await finishProcessExecution(process, async () => { await this.killBitbake() })
    const outLines = ret.stdout.toString().split('\n')

    if (outLines.filter((line) => /devtool$/.test(line)).length === 0) {
      clientNotificationManager.showBitbakeSettingsError('devtool not found in $PATH\nSee Bitbake Terminal for command output.')
      return false
    }

    if (outLines.filter((line) => /bitbake$/.test(line)).length === 0) {
      setBitbakeESDKMode(true)
    } else {
      setBitbakeESDKMode(false)
    }
    logger.info(`Bitbake settings are sane, eSDK mode: ${bitbakeESDKMode}`)

    return true
  }

  composeBitbakeCommand (bitbakeTaskDefinition: BitbakeTaskDefinition): string {
    if (bitbakeTaskDefinition.specialCommand !== undefined) {
      return sanitizeForShell(bitbakeTaskDefinition.specialCommand) as string
    }

    const OPTIONS_MAP: Record<keyof BitbakeTaskDefinition['options'], string> = {
      continue: '-k',
      force: '-f',
      parseOnly: '-p',
      env: '-e'
    }

    let command = 'bitbake'

    bitbakeTaskDefinition.recipes?.forEach(recipe => {
      command = appendCommandParam(command, `${sanitizeForShell(recipe)}`)
    })
    if (bitbakeTaskDefinition.task !== undefined) {
      command = appendCommandParam(command, `-c ${sanitizeForShell(bitbakeTaskDefinition.task)}`)
    }
    const options = bitbakeTaskDefinition.options
    if (options !== undefined) {
      Object.keys(options).forEach(key => {
        if (options[key as keyof BitbakeTaskDefinition['options']] === true) {
          command = appendCommandParam(command, OPTIONS_MAP[key as keyof BitbakeTaskDefinition['options']])
        }
      })
    }

    return command
  }

  composeInteractiveCommand (): string {
    return 'bash'
  }

  composeDevtoolIDECommand (recipe: string): string {
    const sdkImage = this.bitbakeSettings.sdkImage
    const sshTarget = this.bitbakeSettings.sshTarget
    let command = `devtool ide-sdk -i code ${recipe} ${sdkImage}`
    if (sshTarget !== undefined && sshTarget !== '') {
      command = appendCommandParam(command, `-t ${sshTarget}`)
    }
    return command
  }

  /// Try to stop bitbake or terminate it after a timeout
  async killBitbake (timeout: number = BITBAKE_EXIT_TIMEOUT): Promise<void> {
    if (this.bitbakeProcess === undefined) {
      logger.warn('Tried to stop bitbake but no process was running')
      return
    }
    const processToStop = this.bitbakeProcess
    const commandToStop = this.bitbakeProcessCommand
    if (commandToStop === undefined) {
      throw Error('Bitbake process command is undefined')
    }
    let processStopped = false
    processToStop.on('close', () => {
      processStopped = true
      logger.debug('Bitbake process successfully terminated')
    })

    // The first SIGINT will wait for current build tasks to complete
    if (!await this.killDockerContainer(commandToStop)) {
      processToStop?.kill('SIGINT')
    }

    // The second SIGINT will interrupt build tasks after a timeout
    setTimeout(() => {
      if (!processStopped) {
        void this.killDockerContainer(commandToStop).then((result) => {
          if (!result) {
            processToStop.kill('SIGINT')
          }
        })
      }
    }, timeout)

    // The third SIGINT will exit no matter what, but may require cleanup of bitbake.lock
    setTimeout(() => {
      if (!processStopped) {
        void this.killDockerContainer(commandToStop).then((result) => {
          if (!result) {
            processToStop.kill('SIGINT')
          }
        })
      }
    }, timeout * 2)
  }

  private async killDockerContainer (command: string): Promise<boolean> {
    // If the process is started through a docker commandWrapper
    // then signals won't be propagated to the running process
    // We instead find and kill the process directly

    // Our process will look something like this in `ps`:
    // deribau+  405680  405597 21 17:13 ?        00:00:00 python3 /home/deribaucourt/Workspace/yocto-vscode/yocto/yocto-build/sources/poky/bitbake/bin/bitbake linux-yocto
    const ps = childProcess.spawn('ps', ['-ef'])
    const ret = await finishProcessExecution(Promise.resolve(ps))

    const stdout = ret.stdout.toString()
    const lines = stdout.split('\n').slice(1, -1)
    let bitbakeProcesses = lines.filter((line) => line.split(/\s+/)[7] === 'python3')
    bitbakeProcesses = bitbakeProcesses.filter((line) => line.includes(command))
    logger.debug('Bitbake process: ' + JSON.stringify(bitbakeProcesses))

    if (bitbakeProcesses.length > 1) {
      logger.warn('Multiple bitbake process found. Could not determine which one to stop.')
      return false
    }

    if (bitbakeProcesses.length === 1) {
      const pid = bitbakeProcesses[0].split(/\s+/)[1]
      logger.info('Stopping bitbake process with PID: ' + pid)
      childProcess.spawn('kill', ['-s', 'SIGINT', pid])
      return true
    }

    return false
  }
}

function appendCommandParam (command: string, param: string): string {
  return command + ' ' + param
}
