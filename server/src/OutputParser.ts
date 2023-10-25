/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import logger from 'winston'

import {
  DiagnosticSeverity,
  type Connection
} from 'vscode-languageserver'

import {
  ProblemsContainer
} from './ProblemsContainer'

let _connection: Connection | null = null

/**
 * Set the connection. Should be done at startup.
 */
export function setOutputParserConnection (connection: Connection): void {
  _connection = connection
}

export class OutputParser {
  _problems: ProblemsContainer[] = []

  parse (message: string): void {
    this.clearAllProblemsAndReport()
    const severityRegex: RegExp = /\b(WARNING:|ERROR:)/
    let currentSeverity: DiagnosticSeverity = DiagnosticSeverity.Error // dummy initializer which will never be used
    let currentMessageLines: string[] = []
    for (const line of message.split(/\r?\n/g).reverse()) {
      currentMessageLines.push(line)
      const unparsedSeverity = line.match(severityRegex)?.[1]
      if (unparsedSeverity === 'ERROR:') {
        currentSeverity = DiagnosticSeverity.Error
      } else if (unparsedSeverity === 'WARNING:') {
        currentSeverity = DiagnosticSeverity.Warning
      }
      if (unparsedSeverity !== undefined) { // if we reached the first line of a problem
        this.addProblem(currentSeverity, currentMessageLines.reverse().join('\n'))
        currentMessageLines = []
      }
    }
  }

  private addProblem (severity: DiagnosticSeverity, message: string): void {
    const tempProblemContainer: ProblemsContainer[] = ProblemsContainer.createProblemContainer(severity, message)
    tempProblemContainer.forEach((container: ProblemsContainer) => {
      const element = this._problems.find((other) => other.url === container.url)
      if (element !== undefined) {
        element.problems = element.problems.concat(container.problems)
      } else {
        this._problems.push(container)
      }
    })
  }

  errorsFound (): boolean {
    return this._problems.some((container) => container.containsErrors())
  }

  reportProblems (): void {
    if (_connection === null) {
      logger.warn('The LSP Connection is not set. Dropping messages')
      return
    }
    const connection = _connection
    logger.debug(`reportProblems: ${this._problems.length}`)
    this._problems.forEach((container: ProblemsContainer) => {
      logger.debug(`send Diagnostic ${container.toString()}`)
      void connection.sendDiagnostics(container.getDignosticData())
    })
  }

  clearAllProblemsAndReport (): void {
    if (_connection === null) {
      logger.warn('The LSP Connection is not set. Dropping messages')
      return
    }
    const connection = _connection
    logger.debug(`clearAllProblems: ${this._problems.length}`)
    this._problems.forEach((container: ProblemsContainer) => {
      logger.debug(`send Diagnostic ${container.toString()}`)
      void connection.sendDiagnostics(container.getClearedDiagnosticData())
    })

    this._problems = []
  }
}

const outputParser = new OutputParser()
export default outputParser
