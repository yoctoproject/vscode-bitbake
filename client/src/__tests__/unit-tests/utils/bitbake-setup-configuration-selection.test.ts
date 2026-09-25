/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  parseBitbakeSetupConfigurationManifest
} from '../../../utils/BitbakeSetupConfiguration'
import {
  getBitbakeSetupSelectableConfigurations
} from '../../../utils/BitbakeSetupConfigurationSelection'

describe('BitbakeSetupConfigurationSelection', () => {
  it('returns a top-level leaf configuration', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            name: 'nodistro',
            description: "OpenEmbedded 'nodistro'"
          }
        ]
      }
    })

    expect(getBitbakeSetupSelectableConfigurations(manifest)).toStrictEqual([
      {
        name: 'nodistro',
        description: "OpenEmbedded 'nodistro'",
        fragmentGroups: []
      }
    ])
  })

  it('returns nested leaf configurations', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            configurations: [
              {
                name: 'poky',
                description: 'Poky'
              },
              {
                name: 'poky-with-sstate',
                description: 'Poky with sstate'
              }
            ]
          }
        ]
      }
    })

    expect(getBitbakeSetupSelectableConfigurations(manifest)).toStrictEqual([
      {
        name: 'poky',
        description: 'Poky',
        fragmentGroups: []
      },
      {
        name: 'poky-with-sstate',
        description: 'Poky with sstate',
        fragmentGroups: []
      }
    ])
  })

  it('inherits fragment groups from parent configurations', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: [
                  {
                    name: 'machine/qemux86-64',
                    description: 'x86-64 system on QEMU'
                  }
                ]
              }
            },
            configurations: [
              {
                name: 'poky'
              }
            ]
          }
        ]
      }
    })

    expect(
      getBitbakeSetupSelectableConfigurations(manifest)[0].fragmentGroups
    ).toStrictEqual([
      {
        name: 'machine',
        description: 'Target machines',
        options: [
          {
            name: 'machine/qemux86-64',
            description: 'x86-64 system on QEMU'
          }
        ]
      }
    ])
  })

  it('combines parent and child fragment groups in declaration order', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: ['machine/qemux86-64']
              }
            },
            configurations: [
              {
                name: 'poky',
                'oe-fragments-one-of': {
                  distro: {
                    description: 'Target distributions',
                    options: ['distro/poky']
                  }
                }
              }
            ]
          }
        ]
      }
    })

    const [configuration] =
      getBitbakeSetupSelectableConfigurations(manifest)

    expect(configuration.fragmentGroups.map(group => group.name)).toStrictEqual([
      'machine',
      'distro'
    ])
  })

  it('supports multiple nesting levels', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            configurations: [
              {
                configurations: [
                  {
                    name: 'deep-config',
                    description: 'Deep configuration'
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    expect(getBitbakeSetupSelectableConfigurations(manifest)).toStrictEqual([
      {
        name: 'deep-config',
        description: 'Deep configuration',
        fragmentGroups: []
      }
    ])
  })

  it('keeps fragment groups isolated between sibling configurations', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            configurations: [
              {
                name: 'first',
                'oe-fragments-one-of': {
                  firstGroup: {
                    description: 'First group',
                    options: ['first/value']
                  }
                }
              },
              {
                name: 'second',
                'oe-fragments-one-of': {
                  secondGroup: {
                    description: 'Second group',
                    options: ['second/value']
                  }
                }
              }
            ]
          }
        ]
      }
    })

    const configurations =
      getBitbakeSetupSelectableConfigurations(manifest)

    expect(
      configurations[0].fragmentGroups.map(group => group.name)
    ).toStrictEqual(['firstGroup'])

    expect(
      configurations[1].fragmentGroups.map(group => group.name)
    ).toStrictEqual(['secondGroup'])
  })

  it('rejects duplicate inherited fragment group names', () => {
    const manifest = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            'oe-fragments-one-of': {
              machine: {
                description: 'Parent machines',
                options: ['machine/qemux86-64']
              }
            },
            configurations: [
              {
                name: 'poky',
                'oe-fragments-one-of': {
                  machine: {
                    description: 'Child machines',
                    options: ['machine/qemuarm64']
                  }
                }
              }
            ]
          }
        ]
      }
    })

    expect(() =>
      getBitbakeSetupSelectableConfigurations(manifest)
    ).toThrow(
      "Duplicate bitbake-setup fragment group 'machine' in nested configuration"
    )
  })
})
