/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type Diagnostic,
  DiagnosticSeverity,
  type PublishDiagnosticsParams
} from 'vscode-languageserver'

export type ProblemType = 'error' | 'warning'

export class ProblemsContainer {
  _url: string = 'file://'
  _problems: Diagnostic[] = []

  get url (): string {
    return this._url
  }

  get problems (): Diagnostic[] {
    return this._problems
  }

  set problems (problems: Diagnostic[]) {
    this._problems = problems
  }

  appendDiagnostic (diagnostic: Diagnostic): void {
    this._problems.push(diagnostic)
  }

  containsErrors (): boolean {
    let errorFound: boolean = false
    const BreakException = new Error()

    try {
      this._problems.forEach((value: Diagnostic) => {
        if (value.severity === DiagnosticSeverity.Error) {
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

  getDignosticData (): PublishDiagnosticsParams {
    return {
      uri: this._url,
      diagnostics: this._problems
    }
  }

  getClearedDiagnosticData (): PublishDiagnosticsParams {
    return {
      uri: this._url,
      diagnostics: []
    }
  }

  toString (): string {
    let objectAsString: string = `{uri:${this._url} problems:[`

    this._problems.forEach((problem: Diagnostic) => {
      objectAsString += `${problem.message},`
    })

    objectAsString += '}'
    return objectAsString
  }

  static createProblemContainer (type: ProblemType, message: string): ProblemsContainer[] {
    const regex = /(ParseError)(?:\s|\w)*\s(\/.*\..*):(\d):\s(.*)/g
    let m
    const problemContainer: ProblemsContainer[] = []

    while ((m = regex.exec(message)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }

      const problem = new ProblemsContainer()
      problem._url = encodeURI('file://' + m[2])
      problem.appendDiagnostic(this.createProblemElement(type, m[4], Number.parseInt(m[3]), m[1]))
      problemContainer.push(problem)
    }

    if (problemContainer.length === 0) {
      const problem = new ProblemsContainer()
      problem.appendDiagnostic(this.createProblemElement(type, message))
      problemContainer.push(problem)
    }

    return problemContainer
  }

  private static createProblemElement (
    type: ProblemType,
    message: string,
    lineNumber: number = 1,
    problemCode: string = 'general'
  ): Diagnostic {
    let problemSeverity: DiagnosticSeverity

    if (type === 'error') {
      problemSeverity = DiagnosticSeverity.Error
    } else if (type === 'warning') {
      problemSeverity = DiagnosticSeverity.Warning
    } else {
      const _exhaustiveCheck: never = type
      return _exhaustiveCheck
    }

    const problem: Diagnostic = {
      range: {
        start: {
          line: lineNumber,
          character: lineNumber
        },
        end: {
          line: lineNumber,
          character: lineNumber
        }
      },
      severity: problemSeverity,
      message,
      code: problemCode
    }

    return problem
  }
}
