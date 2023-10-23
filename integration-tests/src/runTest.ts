/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path'

import { runTests } from '@vscode/test-electron'

async function main (): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../client/')

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index')

    const testWorkspace = path.resolve(__dirname, '../../integration-tests/project-folder')

    const launchArgs = ['--disable-extensions', '--disable-workspace-trust', testWorkspace]
    const extensionTestsEnv = {}

    // Download VS Code, unzip it and run the integration test
    await runTests({ launchArgs, extensionDevelopmentPath, extensionTestsPath, extensionTestsEnv })
  } catch (err) {
    console.error(err)
    console.error('Failed to run tests')
    process.exit(1)
  }
}

void main()
