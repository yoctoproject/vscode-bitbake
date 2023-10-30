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
      pathToBuildFolder: '${workspaceFolder}/build'
    }, '/home/user/workspace')
    expect(settings.pathToBuildFolder).toEqual('/home/user/workspace/build')
  })
})
