/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { loadBitbakeSettings } from '../../driver/BitbakeSettings'

jest.mock('vscode')

const mockBitbakeConfiguration = (values: Record<string, string>): void => {
  vscode.workspace.getConfiguration = jest.fn().mockImplementation(() => ({
    get: (key: string): string => {
      if (key === undefined || values[key] === undefined) {
        return ''
      }
      return values[key]
    }
  }))
}

const mockVsCodeWorkspace = (workspacePath: string): void => {
  const workspaceFolder: vscode.WorkspaceFolder = {
    uri: {
      scheme: '',
      authority: '',
      path: '',
      query: '',
      fragment: '',
      fsPath: workspacePath,
      with: function (change: { scheme?: string | undefined, authority?: string | undefined, path?: string | undefined, query?: string | undefined, fragment?: string | undefined }): vscode.Uri {
        throw new Error('Function not implemented.')
      },
      toJSON: function () {
        throw new Error('Function not implemented.')
      }
    },
    name: '',
    index: 0
  }

  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    get: (): vscode.WorkspaceFolder[] | undefined => undefined
  })
  jest.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([workspaceFolder])
}

describe('BitbakeSettings Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should expand workspaceFolder', () => {
    mockBitbakeConfiguration({
      // eslint-disable-next-line no-template-curly-in-string
      pathToBuildFolder: '${workspaceFolder}/build'
    })
    mockVsCodeWorkspace('/home/user/workspace')

    const settings = loadBitbakeSettings()
    expect(settings.pathToBuildFolder).toEqual('/home/user/workspace/build')
  })
})
