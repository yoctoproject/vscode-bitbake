/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  parseBitbakeSetupConfigurations
} from '../../../utils/BitbakeSetupConfiguration'

describe('BitbakeSetupConfiguration', () => {
  it('parses a basic selectable configuration', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            name: 'nodistro'
          }
        ]
      }
    })

    expect(result).toStrictEqual([
      {
        name: 'nodistro',
        fragmentGroups: []
      }
    ])
  })

  it('parses an optional configuration description', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            name: 'nodistro',
            description: "OpenEmbedded 'nodistro'"
          }
        ]
      }
    })

    expect(result).toStrictEqual([
      {
        name: 'nodistro',
        description: "OpenEmbedded 'nodistro'",
        fragmentGroups: []
      }
    ])
  })

  it('parses fragment groups', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            name: 'poky',
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: ['machine/qemux86-64']
              }
            }
          }
        ]
      }
    })

    expect(result[0].fragmentGroups).toStrictEqual([
      {
        name: 'machine',
        description: 'Target machines',
        options: [
          {
            name: 'machine/qemux86-64'
          }
        ]
      }
    ])
  })

  it('parses string fragment options', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            name: 'poky',
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: ['machine/qemux86-64']
              }
            }
          }
        ]
      }
    })

    expect(result[0].fragmentGroups[0].options).toStrictEqual([
      {
        name: 'machine/qemux86-64'
      }
    ])
  })

  it('parses object fragment options with descriptions', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            name: 'poky',
            'oe-fragments-one-of': {
              machine: {
                description: 'Target machines',
                options: [
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

    expect(result[0].fragmentGroups[0].options).toStrictEqual([
      {
        name: 'machine/qemuarm64',
        description: 'ARMv8 system on QEMU'
      }
    ])
  })

  it('flattens nested configurations directly', () => {
    const result = parseBitbakeSetupConfigurations({
      'bitbake-setup': {
        configurations: [
          {
            configurations: [
              {
                name: 'poky',
                description: 'Poky'
              },
              {
                configurations: [
                  {
                    name: 'poky-with-sstate',
                    description: 'Poky with sstate'
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    expect(result).toStrictEqual([
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

  it('inherits parent fragment groups', () => {
    const result = parseBitbakeSetupConfigurations({
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

    expect(result).toStrictEqual([
      {
        name: 'poky',
        fragmentGroups: [
          {
            name: 'machine',
            description: 'Target machines',
            options: [
              {
                name: 'machine/qemux86-64'
              }
            ]
          },
          {
            name: 'distro',
            description: 'Target distributions',
            options: [
              {
                name: 'distro/poky'
              }
            ]
          }
        ]
      }
    ])
  })

  it('rejects duplicate inherited and current fragment group names', () => {
    expect(() => {
      parseBitbakeSetupConfigurations({
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
    }).toThrow(
      "Duplicate bitbake-setup fragment group 'machine' in nested configuration"
    )
  })

  it('requires a name on leaf configurations', () => {
    expect(() => {
      parseBitbakeSetupConfigurations({
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

  it('rejects malformed consumed fields', () => {
    expect(() => {
      parseBitbakeSetupConfigurations({
        'bitbake-setup': {
          configurations: [
            {
              name: 'poky',
              description: 42
            }
          ]
        }
      })
    }).toThrow(
      'configuration manifest bitbake-setup.configurations[0].description must be a string'
    )

    expect(() => {
      parseBitbakeSetupConfigurations({
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

  it('rejects an empty configurations array', () => {
    expect(() => {
      parseBitbakeSetupConfigurations({
        'bitbake-setup': {
          configurations: []
        }
      })
    }).toThrow(
      'configuration manifest bitbake-setup.configurations must not be empty'
    )
  })

  it('ignores unknown unused fields', () => {
    const result = parseBitbakeSetupConfigurations({
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
        ignored: false,
        configurations: [
          {
            name: 'poky',
            'bb-layers': ['openembedded-core/meta'],
            'setup-dir-name': '$distro-wrynose'
          }
        ]
      }
    })

    expect(result).toStrictEqual([
      {
        name: 'poky',
        fragmentGroups: []
      }
    ])
  })
})
