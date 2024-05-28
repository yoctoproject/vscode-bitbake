/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as cp from 'child_process'
import * as path from 'path'
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from '@vscode/test-electron'
import { pythonVersion, bashVersion } from './utils/version'

async function main (): Promise<void> {
  try {
    const vscodeVersion = '1.89.1'
    const vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersion)
    const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

    cp.spawnSync(
      cliPath,
      [
        ...args,
        '--install-extension', `mads-hartmann.bash-ide-vscode@${bashVersion}`,
        '--install-extension', `ms-python.python@${pythonVersion}`
      ],
      {
        encoding: 'utf-8',
        stdio: 'inherit'
      }
    )
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index')

    const testWorkspace = path.resolve(__dirname, '../../integration-tests/project-folder')

    const launchArgs = ['--disable-workspace-trust', testWorkspace]
    const extensionTestsEnv = {}

    // Download VS Code, unzip it and run the integration test
    await runTests({
      launchArgs,
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv
    })
  } catch (err) {
    console.error(err)
    console.error('Failed to run tests')
    process.exit(1)
  }
}

void main()
