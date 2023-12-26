/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { BITBAKE_TIMEOUT } from '../../../lib/src/utils/ProcessUtils'

let bitBakeProjectScanner: BitBakeProjectScanner

const pathToBitbakeFolder = path.join(__dirname, '../../../../../integration-tests/project-folder/sources/poky/bitbake')
const pathToBuildFolder = path.join(__dirname, '../../../../../integration-tests/project-folder/build')
const pathToEnvScript = path.join(__dirname, '../../../../../integration-tests/project-folder/sources/poky/oe-init-build-env')
const workspaceFolder = path.join(__dirname, '../../../../../integration-tests/project-folder')

describe('BitBakeProjectScanner', () => {
  beforeAll((DoneCallback) => {
    const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
    bitbakeDriver.loadSettings(
      {
        pathToBitbakeFolder,
        pathToBuildFolder,
        pathToEnvScript,
        workingDirectory: workspaceFolder,
        commandWrapper: ''
      },
      workspaceFolder
    )
    bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    bitBakeProjectScanner.onChange.on(('scanReady'), () => {
      DoneCallback()
    })
    bitBakeProjectScanner.bitbakeDriver.spawnBitbakeProcess('devtool modify busybox').then((child) => {
      child.on('close', () => {
        void bitBakeProjectScanner.rescanProject()
      })
    }, (error) => {
      throw error
    })
  }, BITBAKE_TIMEOUT)

  afterAll((done) => {
    bitBakeProjectScanner.bitbakeDriver.spawnBitbakeProcess('devtool reset busybox').then((child) => {
      child.on('close', () => {
        done()
      })
    }, (error) => {
      throw error
    })
  }, BITBAKE_TIMEOUT)

  it('can get a list of layers', async () => {
    const layers = bitBakeProjectScanner.scanResult._layers
    // poky provides the "core", "yocto" and "yoctobsp" layers
    expect(layers.length).toBeGreaterThan(2)
    expect(layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            name: 'core'
          }
        )
      ])
    )
  })

  it('can get a list of recipes', async () => {
    const recipes = bitBakeProjectScanner.scanResult._recipes
    expect(recipes.length).toBeGreaterThan(100)
    expect(recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            name: 'core-image-minimal'
          }
        )
      ])
    )
  })

  it('can get a list of classes', async () => {
    const classes = bitBakeProjectScanner.scanResult._classes
    expect(classes.length).toBeGreaterThan(50)
    expect(classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            name: 'image'
          }
        )
      ])
    )
  })

  it('can get a list of overrides', async () => {
    const overrides = bitBakeProjectScanner.scanResult._overrides
    expect(overrides.length).toBeGreaterThan(5)
    expect(overrides).toEqual(
      expect.arrayContaining([
        'class-target'
      ])
    )
  })

  it('can get a list of devtool workspaces', async () => {
    const devtoolWorkspaces = bitBakeProjectScanner.scanResult._workspaces
    expect(devtoolWorkspaces.length).toBeGreaterThan(0)
    expect(devtoolWorkspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            name: 'busybox'
          }
        )
      ])
    )
  })
})
