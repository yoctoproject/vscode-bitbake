/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  buildBitbakeSetupInitArguments
} from '../../../utils/BitbakeSetupInitArguments'

describe('BitbakeSetupInitArguments', () => {
  const targetDirectory = '/workspaces/poky'

  const targetPrefixArguments = [
    '--setting',
    'default',
    'top-dir-prefix',
    '/workspaces',
    '--setting',
    'default',
    'top-dir-name',
    'poky'
  ]

  const initArguments = [
    'init',
    '--non-interactive'
  ]

  it('builds a non-interactive init command for the builtin registry', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: []
    })).toStrictEqual([
      ...targetPrefixArguments,
      ...initArguments,
      'poky-wrynose',
      'poky'
    ])
  })

  it('adds fragment selections in the supplied order', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: [
        'machine/qemuarm64',
        'distro/poky'
      ]
    })).toStrictEqual([
      ...targetPrefixArguments,
      ...initArguments,
      'poky-wrynose',
      'poky',
      'machine/qemuarm64',
      'distro/poky'
    ])
  })

  it('adds a custom registry as an invocation-only setting', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registry: 'git://example/registry;protocol=https;branch=main;rev=main',
      registryConfiguration: 'custom-config',
      configuration: 'custom',
      fragments: []
    })).toStrictEqual([
      ...targetPrefixArguments,
      '--setting',
      'default',
      'registry',
      'git://example/registry;protocol=https;branch=main;rev=main',
      ...initArguments,
      'custom-config',
      'custom'
    ])
  })

  it('ignores an empty registry override', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registry: '',
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: []
    })).toStrictEqual([
      ...targetPrefixArguments,
      ...initArguments,
      'poky-wrynose',
      'poky'
    ])
  })

  it('can explicitly request VS Code workspace initialization', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: [],
      initializeVsCode: true
    })).toStrictEqual([
      ...targetPrefixArguments,
      ...initArguments,
      '--init-vscode',
      'poky-wrynose',
      'poky'
    ])
  })

  it('can explicitly disable VS Code workspace initialization', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: [],
      initializeVsCode: false
    })).toStrictEqual([
      ...targetPrefixArguments,
      ...initArguments,
      '--no-init-vscode',
      'poky-wrynose',
      'poky'
    ])
  })

  it('maps the selected directory to the bitbake-setup top directory', () => {
    expect(buildBitbakeSetupInitArguments({
      directory: '/home/user/projects/my-yocto',
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: []
    })).toStrictEqual([
      '--setting',
      'default',
      'top-dir-prefix',
      '/home/user/projects',
      '--setting',
      'default',
      'top-dir-name',
      'my-yocto',
      'init',
      '--non-interactive',
      'poky-wrynose',
      'poky'
    ])
  })

  it('rejects a filesystem root as the setup directory', () => {
    expect(() => buildBitbakeSetupInitArguments({
      directory: '/',
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments: []
    })).toThrow(
      'The bitbake-setup initialization directory must not be a filesystem root.'
    )
  })

  it('does not mutate the supplied fragment array', () => {
    const fragments = [
      'machine/qemuarm64',
      'distro/poky'
    ]

    const before = [...fragments]

    buildBitbakeSetupInitArguments({
      directory: targetDirectory,
      registryConfiguration: 'poky-wrynose',
      configuration: 'poky',
      fragments
    })

    expect(fragments).toStrictEqual(before)
  })
})
