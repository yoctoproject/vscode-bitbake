/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { loadBitbakeSettings } from '../../BitbakeSettings'

describe('BitbakeSettings Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should expand workspaceFolder', () => {
    const settings = loadBitbakeSettings({
      pathToBitbakeFolder: '',
      pathToEnvScript: '',
      // eslint-disable-next-line no-template-curly-in-string
      pathToBuildFolder: '${workspaceFolder}/build',
      workingDirectory: '',
      commandWrapper: ''
    }, '/home/user/workspace')
    expect(settings.pathToBuildFolder).toEqual('/home/user/workspace/build')
  })

  it('should keep relative paths', () => {
    const settings = loadBitbakeSettings({
      pathToBitbakeFolder: '',
      pathToEnvScript: '',
      pathToBuildFolder: './build',
      workingDirectory: '',
      commandWrapper: ''
    }, __dirname)
    expect(settings.pathToBuildFolder).toEqual('./build')
  })

  it('should expand env variables', () => {
    const settings = loadBitbakeSettings({
      pathToBitbakeFolder: '',
      pathToEnvScript: '',
      // eslint-disable-next-line no-template-curly-in-string
      pathToBuildFolder: '${env:HOME}/build',
      workingDirectory: '',
      commandWrapper: ''
    }, '/home/user/workspace')
    expect(settings.pathToBuildFolder).toEqual(`${process.env.HOME}/build`)
  })

  it('should resolve environment variable inside shellEnv', () => {
    /* eslint-disable no-template-curly-in-string */
    const settings = loadBitbakeSettings({
      pathToBitbakeFolder: '',
      pathToEnvScript: '',
      pathToBuildFolder: '',
      workingDirectory: '',
      commandWrapper: '',
      shellEnv: {
        VAR1: '${env:HOME}/path1',
        VAR2: '${env:USER}/path2'
      }
    }, '/home/user/workspace')

    expect(settings.shellEnv).toEqual({
      VAR1: `${process.env.HOME}/path1`,
      VAR2: `${process.env.USER}/path2`
    })
  })
})
