/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface OutputChannel {
  appendLine: (message: string) => void
  show: () => void
  clear: () => void
  dispose: () => void
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
      const time = new Date().toISOString().substring(11, 23)
      console.log(`${time} [${level[0].toUpperCase() + level.slice(1)}] ${message}`)
    }
  }

  public info (message: string): void {
    this.log(message)
  }

  public debug (message: string): void {
    this.log(message, 'debug')
  }

  public debug_ratelimit (message: string): void {
    if (!this.shouldLog(this.level)) {
      // OPTIM Skip the regex check if the log level is not high enough
      return
    }

    if (OutputLogger.rateLimitPatterns.test(message)) {
      const now = Date.now()
      if (now - this.rateLimitStart < OutputLogger.rateLimit) {
        this.rateLimitCount++
        return
      }
      this.rateLimitStart = now
      if (this.rateLimitCount > 0) {
        this.debug(`Rate limited ${this.rateLimitCount} messages`)
        this.rateLimitCount = 0
      }
    }

    this.debug(message)
  }

  /* Catches messages like:
   *   0: busybox-1.37.0-r0 do_fetch - 6s (pid 280)   7% |#########       | 28.7M/s
   *   Parsing recipes:  10% |################                            | ETA:  0:00:19
   *   No currently running tasks (0 of 3)   0% |                         |
   */
  private static readonly rateLimitPatterns = /% \|/
  private static readonly rateLimit = 1000
  private rateLimitStart = 0
  private rateLimitCount = 0

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
