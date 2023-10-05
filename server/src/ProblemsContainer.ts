/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type Diagnostic,
  DiagnosticSeverity,
  type PublishDiagnosticsParams
} from 'vscode-languageserver'

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
    return this.problems.some((problem) => problem.severity === DiagnosticSeverity.Error)
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

    objectAsString += ']}'
    return objectAsString
  }

  static createProblemContainer (severity: DiagnosticSeverity, message: string): ProblemsContainer[] {
    const regex = /(ParseError)(?: at )(\/.*):(\d*): (.*)/g
    const problemContainer: ProblemsContainer[] = []
    for (const match of message.matchAll(regex)) {
      const problem = new ProblemsContainer()
      problem._url = encodeURI('file://' + match[2])
      problem.appendDiagnostic(this.createProblemElement(severity, match[4], Number.parseInt(match[3]) - 1, match[1]))
      problemContainer.push(problem)
    }

    if (problemContainer.length === 0) {
      const problem = new ProblemsContainer()
      problem.appendDiagnostic(this.createProblemElement(severity, message))
      problemContainer.push(problem)
    }

    return problemContainer
  }

  private static createProblemElement (
    severity: DiagnosticSeverity,
    message: string,
    lineNumber: number = 0,
    problemCode: string = 'general'
  ): Diagnostic {
    return {
      range: {
        start: {
          line: lineNumber,
          character: 0
        },
        end: {
          line: lineNumber,
          character: Number.MAX_VALUE // whole line
        }
      },
      severity,
      message,
      code: problemCode
    }
  }
}
