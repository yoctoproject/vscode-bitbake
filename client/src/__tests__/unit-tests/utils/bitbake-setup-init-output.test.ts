/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  parseBitbakeSetupInitializedDirectory
} from '../../../utils/BitbakeSetupInitOutput'

describe('BitbakeSetupInitOutput', () => {
  it('parses the initialized setup directory', () => {
    expect(parseBitbakeSetupInitializedDirectory(
      [
        'Preparing configuration',
        'Initializing a setup directory in',
        '    /workspaces/yocto/poky-wrynose',
        'Done'
      ].join('\n')
    )).toBe('/workspaces/yocto/poky-wrynose')
  })

  it('parses an already initialized setup directory', () => {
    expect(parseBitbakeSetupInitializedDirectory(
      [
        'Setup already initialized in:',
        '    /workspaces/yocto/poky-wrynose',
        "Use 'bitbake-setup status' to check it."
      ].join('\n')
    )).toBe('/workspaces/yocto/poky-wrynose')
  })

  it('handles CRLF terminal output', () => {
    expect(parseBitbakeSetupInitializedDirectory(
      'Initializing a setup directory in\r\n    /tmp/yocto/poky\r\n'
    )).toBe('/tmp/yocto/poky')
  })

  it('returns undefined when the setup directory is not reported', () => {
    expect(parseBitbakeSetupInitializedDirectory(
      'bitbake-setup completed'
    )).toBeUndefined()
  })
})
