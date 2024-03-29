/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { copyBitbakeSettings, generateCPPProperties, generateTasksDefinitions } from '../../../driver/BitbakeESDK'
import { type BitbakeSettings } from '../../../lib/src/BitbakeSettings'

import * as JSONFile from '../../../utils/JSONFile'
import * as LanguageClient from '../../../language/languageClient'

describe('Bitbake ESDK Test Suite', () => {
  const workspace = {
    path: '/path/to/workspace',
    name: 'recipeName'
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should copy bitbake settings', () => {
    const vscodeSettingsPath = '/path/to/workspace/.vscode/settings.json'
    const originalSettings = {
      'bitbake.pathToBitbakeFolder': 'should be overwritten',
      'bitbake.pathToBuildFolder': 'should be removed',
      'bitbake.sshTarget': 'shouldnt be overwritten'
    }

    const loadJsonMock = jest.spyOn(JSONFile, 'loadJsonFile')
    loadJsonMock.mockReturnValueOnce(originalSettings)
    const saveJsonMock = jest.spyOn(JSONFile, 'saveJsonFile').mockImplementation(() => {})

    const newSettings: BitbakeSettings = {
      pathToBitbakeFolder: 'newPath',
      pathToEnvScript: 'should be created',
      sshTarget: 'shouldnt be overwritten'
    }

    copyBitbakeSettings(workspace.path, newSettings, 'No Bitbake Configuration')

    expect(saveJsonMock).toHaveBeenCalledWith(vscodeSettingsPath, expect.objectContaining({
      'bitbake.pathToBitbakeFolder': 'newPath',
      'bitbake.pathToEnvScript': 'should be created'
    }))
  })

  it('should generate tasks definitions', () => {
    const vscodeTasksPath = '/path/to/workspace/.vscode/tasks.json'
    const originalTasks = {
      version: '1.0.0',
      tasks: [
        {
          label: 'Should not be overwritten',
          type: 'shell',
          command: 'echo Hello World'
        },
        {
          label: 'BitBake Clean recipeName',
          type: 'bitbake',
          specialCommand: 'should be overwritten'
        }
      ]
    }
    const bitbakeSettings: BitbakeSettings = {
      pathToBitbakeFolder: '',
      sshTarget: 'root@192.168.150.3'
    }

    const loadJsonMock = jest.spyOn(JSONFile, 'loadJsonFile')
    loadJsonMock.mockReturnValueOnce(originalTasks)
    const saveJsonMock = jest.spyOn(JSONFile, 'saveJsonFile').mockImplementation(() => {})

    generateTasksDefinitions(workspace, bitbakeSettings)

    expect(saveJsonMock).toHaveBeenCalledWith(vscodeTasksPath, expect.objectContaining({
      version: '2.0.0',
      tasks: expect.arrayContaining([
        expect.objectContaining({ label: 'Should not be overwritten' }),
        expect.objectContaining({ label: 'Devtool Deploy recipeName' }),
        expect.objectContaining({ label: 'Devtool Build recipeName' }),
        expect.objectContaining({
          label: 'Devtool Clean recipeName',
          specialCommand: 'devtool build -c recipeName'
        })
      ])
    }))
  })

  it('should generate c_cpp_properties.json', async () => {
    const originalConfig = {
      configurations: [
        {
          name: 'should not be overwritten',
          browse: {
            // eslint-disable-next-line no-template-curly-in-string
            path: ['${workspaceFolder}/**']
          }
        }
      ]
    }
    const loadJsonMock = jest.spyOn(JSONFile, 'loadJsonFile')
    loadJsonMock.mockReturnValueOnce(originalConfig)
    const saveJsonMock = jest.spyOn(JSONFile, 'saveJsonFile').mockImplementation(() => {})

    const bitBakeProjectScannerMock = { resolveContainerPath: jest.fn().mockImplementation((arg) => arg) } as any
    const clientMock = jest.fn() as any
    const getVariableValueMock = jest.spyOn(LanguageClient, 'getVariableValue')
    getVariableValueMock.mockImplementation(
      async (client, variable, recipe) => {
        if (variable === 'STAGING_BINDIR_TOOLCHAIN') {
          return '/opt'
        }
        if (variable === 'TARGET_SYS') {
          return 'arch-poky'
        }
        if (variable === 'CXX') {
          return 'g++ --sysroot=/opt'
        }
        return ''
      }
    )

    await generateCPPProperties(workspace, bitBakeProjectScannerMock, clientMock)

    expect(saveJsonMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      configurations: expect.arrayContaining([
        expect.objectContaining({
          name: 'arch-poky',
          compilerPath: '/opt/g++',
          compilerArgs: expect.arrayContaining(['--sysroot=/opt'])
        })
      ])
    }))
  })
})
