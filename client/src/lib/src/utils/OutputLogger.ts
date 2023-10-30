/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface OutputChannel {
  appendLine: (message: string) => void
  show: () => void
  clear: () => void
}

export class OutputLogger {
  private static instance: OutputLogger

  // default value in package.json
  level: string = ''
  outputChannel: OutputChannel | undefined

  private constructor () { }

  public static getInstance (): OutputLogger {
    if (OutputLogger.instance === undefined) {
      OutputLogger.instance = new OutputLogger()
    }
    return OutputLogger.instance
  }

  public log (message: string, level: string = 'info'): void {
    if (this.shouldLog(level)) {
      this.outputChannel?.appendLine(message)
      console.log(message)
    }
  }

  public info (message: string): void {
    this.log(message)
  }

  public debug (message: string): void {
    this.log(message, 'debug')
  }

  public warn (message: string): void {
    this.log(message, 'warning')
  }

  public error (message: string): void {
    this.log(message, 'error')
  }

  public clear (): void {
    console.clear()
    this.outputChannel?.clear()
  }

  private shouldLog (level: string): boolean {
    // Determine if the log level should be printed
    const logLevels = ['none', 'error', 'warning', 'info', 'debug']
    const currentLevelIndex = logLevels.indexOf(this.level)
    const messageLevelIndex = logLevels.indexOf(level)

    return currentLevelIndex >= messageLevelIndex
  }
}

// Create and export the singleton logger instance
export const logger: OutputLogger = OutputLogger.getInstance()
