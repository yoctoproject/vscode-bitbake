/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert'
import * as vscode from 'vscode'
import path from 'path'
import { afterEach } from 'mocha'
import { BITBAKE_TIMEOUT } from '../utils/bitbake'
import { assertWillComeTrue } from '../utils/async'

suite('Bitbake Diagnostics Test Suite', () => {
  const filePath = path.resolve(__dirname, '../../project-folder/sources/meta-fixtures/diagnostics.bb')
  const docUri = vscode.Uri.parse(`file://${filePath}`)

  let disposables: vscode.Disposable[] = []

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(100000)
    const vscodeBitbake = vscode.extensions.getExtension('yocto-project.yocto-bitbake')
    if (vscodeBitbake === undefined) {
      assert.fail('Bitbake extension is not available')
    }
    await vscodeBitbake.activate()
  })

  afterEach(function () {
    for (const disposable of disposables) {
      disposable.dispose()
    }
    disposables = []
  })

  test('Diagnostics', async () => {
    void vscode.workspace.openTextDocument(docUri)
    await assertWillComeTrue(async () => {
      const diagnosticsResult = vscode.languages.getDiagnostics()
      // generateTestCases(diagnosticsResult)
      const diagnostics = diagnosticsResult.find(
        ([uri]) => uri.toString() === docUri.toString()
      )?.at(1)

      if (
        !Array.isArray(diagnostics) || // For unknown reasons, Typescript thinks "diagnostics" could be an Uri
        diagnostics.length !== expectedDiagnostics.length
      ) {
        return false
      }

      const hasAllExpectedDiagnostics = diagnostics.every((diagnostic) => {
        return expectedDiagnostics.some((expectedDiagnostic) => {
          return (
            diagnostic.range.isEqual(expectedDiagnostic.range) &&
            diagnostic.message === expectedDiagnostic.message &&
            getCode(diagnostic) === expectedDiagnostic.code &&
            diagnostic.source === expectedDiagnostic.source
          )
        })
      })

      // Make sure our test case has generated all the diagnostics that should be ignored
      /* const hasGeneratedDiagnosticsToIgnore = diagnosticsResult.some(
        // There is one file...
        ([, diagnostics]) =>
          // for which all ignored codes...
          ignoredCodes.every(
            // have at least one corresponding diagnostic
            ([source, code]) => diagnostics.some(
              (diagnostic) => hasSourceWithCode(diagnostic, source, code)
            )
          )
      ) */

      return hasAllExpectedDiagnostics // && hasGeneratedDiagnosticsToIgnore
    })
  }).timeout(BITBAKE_TIMEOUT)
})

const getCode = (diagnostic: vscode.Diagnostic): string | number | undefined => {
  if (typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number') {
    return diagnostic.code
  }
  return diagnostic.code?.value
}

/* const hasSourceWithCode = (diagnostic: vscode.Diagnostic, source: string, code: string): boolean => {
  if (diagnostic.source?.includes(source) !== true) {
    return false
  }
  if (diagnostic.code === code) {
    return true
  }
  if (typeof diagnostic.code === 'object' && diagnostic.code?.value === code) {
    return true
  }
  return false
}

const ignoredCodes = [
  ['Flake8', 'E203'],
  ['Flake8', 'E211'],
  ['Flake8', 'E302'],
  ['Flake8', 'E303'],
  ['Flake8', 'E501'],
  ['Flake8', 'W391'],
  ['Pylint', 'C0114:missing-module-docstring'],
  ['Pylint', 'C0116:missing-function-docstring'],
  ['Pylint', 'C0305:trailing-newlines'],
  ['Pylint', 'C0415:import-outside-toplevel'],
  ['Pylint', 'W0104:pointless-statement'],
  ['Pylint', 'W0106:expression-not-assigned']
] */

const expectedDiagnostics = [
  {
    range: new vscode.Range(1, 19, 1, 23),
    message: 'Using a conditional statement with a constant value',
    code: 'W0125:using-constant-test',
    source: 'Pylint, bitbake-python'
  },
  {
    range: new vscode.Range(9, 4, 9, 13),
    message: 'Redefining name \'os\' (imported by BitBake)',
    code: 'W0621:redefined-outer-name',
    source: 'Pylint, bitbake-python'
  },
  {
    range: new vscode.Range(9, 4, 9, 13),
    message: 'Reimport \'os\' (imported by BitBake)',
    code: 'W0404:reimported',
    source: 'Pylint, bitbake-python'
  },
  {
    range: new vscode.Range(9, 4, 9, 13),
    message: 'Unused import os',
    code: 'W0611:unused-import',
    source: 'Pylint, bitbake-python'
  },
  {
    range: new vscode.Range(9, 4, 9, 4),
    message: '\'os\' imported but unused',
    code: 'F401',
    source: 'Flake8, bitbake-python'
  },
  {
    range: new vscode.Range(9, 4, 9, 4),
    message: 'redefinition of unused \'os\' (imported by BitBake)',
    code: 'F811',
    source: 'Flake8, bitbake-python'
  },
  {
    range: new vscode.Range(9, 11, 9, 13),
    message: '"os" is not accessed',
    code: undefined,
    source: 'Pylance, bitbake-python'
  },
  {
    range: new vscode.Range(6, 4, 6, 9),
    message: 'Undefined variable \'error\'',
    code: 'E0602:undefined-variable',
    source: 'Pylint, bitbake-python'
  },
  {
    range: new vscode.Range(6, 4, 6, 4),
    message: 'undefined name \'error\'',
    code: 'F821',
    source: 'Flake8, bitbake-python'
  },
  {
    range: new vscode.Range(6, 4, 6, 9),
    message: '"error" is not defined',
    code: 'reportUndefinedVariable',
    source: 'Pylance, bitbake-python'
  }
]

// Minimal effort helper to generate the code for the test cases when they need to be updated.
// The output is intented to be copy-pasted into this file.
export const generateTestCases = (diagnosticsResult: ReturnType<typeof vscode.languages.getDiagnostics>): void => {
  for (const [uri, diagnostics] of diagnosticsResult) {
    console.log(uri)
    for (const diagnostic of diagnostics) {
      const range = diagnostic.range
      const rangeString = `${range.start.line}, ${range.start.character}, ${range.end.line}, ${range.end.character}`
      const message = diagnostic.message.replace(/'/g, '\\\'')
      const code = getCode(diagnostic)
      console.log('  {')
      console.log(`    range: new vscode.Range(${rangeString}),`)
      console.log(`    message: '${message}',`)
      console.log(`    code: ${typeof code === 'string' ? `'${code}'` : code},`)
      console.log(`    source: '${diagnostic.source}'`)
      console.log('  },')
    }
    console.log(']')
  }
}
