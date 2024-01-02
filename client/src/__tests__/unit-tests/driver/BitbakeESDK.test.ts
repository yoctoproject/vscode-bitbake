/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { copyBitbakeSettings, generateTasksDefinitions } from '../../../driver/BitbakeESDK'
import { type BitbakeSettings } from '../../../lib/src/BitbakeSettings'

import * as JSONFile from '../../../utils/JSONFile'

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

    copyBitbakeSettings(workspace.path, newSettings)

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
        expect.objectContaining({ label: 'BitBake Build recipeName' }),
        expect.objectContaining({
          label: 'BitBake Clean recipeName',
          specialCommand: 'devtool build -c recipeName'
        })
      ])
    }))
  })
})
