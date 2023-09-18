/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import logger from 'winston'

import {
  type Connection
} from 'vscode-languageserver'

import {
  type ProblemType,
  ProblemsContainer
} from './ProblemsContainer'

export class OutputParser {
  _problems: ProblemsContainer[] = []
  _connection: Connection

  constructor (connection: Connection) {
    this._connection = connection
  }

  parse (message: string): void {
    const regex: RegExp = /\s(WARNING:|ERROR:)\s(.*)/g
    let m
    this.clearAllProblemsAndReport()

    while ((m = regex.exec(message)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      let problemType: ProblemType
      if (m[1] === 'ERROR:') {
        problemType = 'error'
      } else if (m[1] === 'WARNING:') {
        problemType = 'warning'
      } else {
        return
      }

      const tempProblemContainer: ProblemsContainer[] = ProblemsContainer.createProblemContainer(problemType, m[2])

      tempProblemContainer.forEach((container: ProblemsContainer) => {
        const element: ProblemsContainer | undefined = this._problems.find((other: ProblemsContainer) => {
          if (other.url === container.url) {
            return true
          } else {
            return false
          }
        })

        if (element !== undefined) {
          element.problems = element.problems.concat(container.problems)
        } else {
          this._problems.push(container)
        }
      })
    }
  }

  errorsFound (): boolean {
    let errorFound: boolean = false
    const BreakException = new Error()

    try {
      this._problems.forEach((container: ProblemsContainer) => {
        if (container.containsErrors()) {
          errorFound = true
          throw BreakException
        }
      })
    } catch (error) {
      if (error !== BreakException) {
        throw error
      }
    }

    return errorFound
  }

  reportProblems (): void {
    logger.debug(`reportProblems: ${this._problems.length}`)
    this._problems.forEach((container: ProblemsContainer) => {
      logger.debug(`send Diagnostic ${container.toString()}`)
      void this._connection.sendDiagnostics(container.getDignosticData())
    })
  }

  clearAllProblemsAndReport (): void {
    logger.debug(`clearAllProblems: ${this._problems.length}`)
    this._problems.forEach((container: ProblemsContainer) => {
      logger.debug(`send Diagnostic ${container.toString()}`)
      void this._connection.sendDiagnostics(container.getClearedDiagnosticData())
    })

    this._problems = []
  }
}
