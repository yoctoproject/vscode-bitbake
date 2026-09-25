/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  parseBitbakeSetupConfigurationManifest
} from '../../../utils/BitbakeSetupConfiguration'

describe('BitbakeSetupConfiguration', () => {
  it('parses a simple selectable configuration', () => {
    const result = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            name: 'nodistro',
            description: "OpenEmbedded 'nodistro'"
          }
        ]
      }
    })

    expect(result).toStrictEqual({
      configurations: [
        {
          name: 'nodistro',
          description: "OpenEmbedded 'nodistro'",
          fragmentGroups: [],
          configurations: []
        }
      ]
    })
  })

  it('parses recursive configurations without flattening them', () => {
    const result = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            'bb-layers': ['openembedded-core/meta'],
            configurations: [
              {
                name: 'poky',
                description: 'Poky'
              },
              {
                name: 'poky-with-sstate',
                description: 'Poky with sstate',
                'oe-fragments': ['core/yocto/sstate-mirror-cdn']
              }
            ]
          }
        ]
      }
    })

    expect(result.configurations).toHaveLength(1)
    expect(result.configurations[0]).toStrictEqual({
      name: undefined,
      description: undefined,
      fragmentGroups: [],
      configurations: [
        {
          name: 'poky',
          description: 'Poky',
          fragmentGroups: [],
          configurations: []
        },
        {
          name: 'poky-with-sstate',
          description: 'Poky with sstate',
          fragmentGroups: [],
          configurations: []
        }
      ]
    })
  })

  it('normalizes string and described fragment options', () => {
    const result = parseBitbakeSetupConfigurationManifest({
      'bitbake-setup': {
        configurations: [
          {
            name: 'poky',
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: [
                  'machine/qemux86-64',
                  {
                    name: 'machine/qemuarm64',
                    description: 'ARMv8 system on QEMU'
                  }
                ]
              }
            }
          }
        ]
      }
    })

    expect(result.configurations[0].fragmentGroups).toStrictEqual([
      {
        name: 'machine',
        description: 'Target machines',
        options: [
          {
            name: 'machine/qemux86-64'
          },
          {
            name: 'machine/qemuarm64',
            description: 'ARMv8 system on QEMU'
          }
        ]
      }
    ])
  })

  it('accepts unrelated manifest properties without interpreting them', () => {
    const result = parseBitbakeSetupConfigurationManifest({
      description: 'Poky configuration',
      version: '1.0',
      sources: {
        bitbake: {
          'git-remote': {
            uri: 'https://git.openembedded.org/bitbake'
          }
        }
      },
      'bitbake-setup': {
        configurations: [
          {
            name: 'poky',
            'bb-layers': ['openembedded-core/meta'],
            'setup-dir-name': '$distro-wrynose'
          }
        ]
      }
    })

    expect(result.configurations[0]).toStrictEqual({
      name: 'poky',
      description: undefined,
      fragmentGroups: [],
      configurations: []
    })
  })

  it('rejects a manifest without bitbake-setup configurations', () => {
    expect(() => {
      parseBitbakeSetupConfigurationManifest({})
    }).toThrow('configuration manifest bitbake-setup must be an object')
  })

  it('rejects an empty configurations array', () => {
    expect(() => {
      parseBitbakeSetupConfigurationManifest({
        'bitbake-setup': {
          configurations: []
        }
      })
    }).toThrow(
      'configuration manifest bitbake-setup.configurations must not be empty'
    )
  })

  it('requires a name on selectable leaf configurations', () => {
    expect(() => {
      parseBitbakeSetupConfigurationManifest({
        'bitbake-setup': {
          configurations: [
            {
              description: 'Unnamed leaf'
            }
          ]
        }
      })
    }).toThrow(
      'configuration manifest bitbake-setup.configurations[0].name is required for a selectable configuration'
    )
  })

  it('rejects malformed fragment groups', () => {
    expect(() => {
      parseBitbakeSetupConfigurationManifest({
        'bitbake-setup': {
          configurations: [
            {
              name: 'poky',
              'oe-fragments-one-of': {
                machine: {
                  description: 'Target machines',
                  options: [
                    {
                      description: 'Missing name'
                    }
                  ]
                }
              }
            }
          ]
        }
      })
    }).toThrow(
      'configuration manifest bitbake-setup.configurations[0].oe-fragments-one-of.machine.options[0].name must be a string'
    )
  })
})
