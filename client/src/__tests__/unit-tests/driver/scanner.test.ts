/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'
import { BitBakeProjectScanner } from '../../../driver/BitBakeProjectScanner'
import { BitbakeDriver } from '../../../driver/BitbakeDriver'
import { BITBAKE_TIMEOUT } from '../../../utils/ProcessUtils'
import { mockVscodeEvents } from '../../utils/vscodeMock'
import { importRecipe, removeRecipe, integrationBitbakeFolder } from '../../utils/bitbake'
import { logger } from '../../../lib/src/utils/OutputLogger'

let bitBakeProjectScanner: BitBakeProjectScanner

const pathToBuildFolder = path.join(__dirname, '../../../../../integration-tests/project-folder/build')
const pathToEnvScript = path.join(__dirname, '../../../../../integration-tests/project-folder/sources/poky/oe-init-build-env')
const workspaceFolder = path.join(__dirname, '../../../../../integration-tests/project-folder')

logger.level = 'debug'

describe('BitBakeProjectScanner', () => {
  beforeAll((DoneCallback) => {
    const bitbakeDriver: BitbakeDriver = new BitbakeDriver()
    bitbakeDriver.loadSettings(
      {
        pathToBitbakeFolder: integrationBitbakeFolder,
        pathToBuildFolder,
        pathToEnvScript,
        workingDirectory: workspaceFolder,
        commandWrapper: ''
      },
      workspaceFolder
    )
    bitBakeProjectScanner = new BitBakeProjectScanner(bitbakeDriver)
    bitBakeProjectScanner.onChange.on((BitBakeProjectScanner.EventType.SCAN_COMPLETE), () => {
      DoneCallback()
    })
    mockVscodeEvents()
    bitBakeProjectScanner.bitbakeDriver.spawnBitbakeProcess('devtool modify busybox').then((child) => {
      child.onExit(async (event) => {
        expect(event.exitCode).toBe(0)
        const pokyPath = path.resolve(__dirname, '../../../../../integration-tests/project-folder/sources/poky')
        const fixtureVersionPath = path.resolve(__dirname, '../../../../../integration-tests/project-folder/sources/meta-fixtures-versions/recipes-fixtures/fixture-version')
        const recipes = fs.readdirSync(fixtureVersionPath)
        for (const recipe of recipes) {
          await importRecipe(path.join(fixtureVersionPath, recipe), pokyPath)
        }
        const localConfPath = path.join(pathToBuildFolder, 'conf', 'local.conf')
        fs.appendFileSync(localConfPath, 'PREFERRED_VERSION_fixture-version = "0.2.0"\n')
        await bitBakeProjectScanner.rescanProject()
      })
    }, (error) => {
      throw error
    })
  }, BITBAKE_TIMEOUT)

  afterAll((done) => {
    bitBakeProjectScanner.bitbakeDriver.spawnBitbakeProcess('devtool reset busybox').then((child) => {
      const pokyPath = path.resolve(__dirname, '../../../../../integration-tests/project-folder/sources/poky')
      const fixtureVersionPath = path.resolve(__dirname, '../../../../../integration-tests/project-folder/sources/meta-fixtures-versions/recipes-fixtures/fixture-version')
      const recipes = fs.readdirSync(fixtureVersionPath)
      for (const recipe of recipes) {
        void removeRecipe(path.join(fixtureVersionPath, recipe), pokyPath)
      }
      child.onExit(() => {
        done()
      })
    }, (error) => {
      throw error
    })
    jest.clearAllMocks()
  }, BITBAKE_TIMEOUT)

  it('can get the bitbake version', async () => {
    const version = bitBakeProjectScanner.scanResult._bitbakeVersion
    expect(version).toMatch(/^[\d.]+$/);
  })

  it('can get a list of layers', async () => {
    const layers = bitBakeProjectScanner.activeScanResult._layers
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
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
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

  it('can detected skipped recipes', async () => {
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
    // systemd is skipped in the poky distribution, because systemV is used instead
    const systemdRecipe = recipes.find((recipe) => recipe.name === 'systemd')
    expect(systemdRecipe).toEqual(
      expect.objectContaining(
        {
          skipped: expect.stringContaining('skipped:')
        }
      )
    )
  })

  it('can get recipes appends', async () => {
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
    const busyboxRecipe = recipes.find((recipe) => recipe.name === 'busybox')
    expect(busyboxRecipe).toEqual(
      expect.objectContaining(
        {
          appends: expect.arrayContaining([
            expect.objectContaining({
              base: expect.stringContaining('busybox_%.bbappend')
            })
          ])
        }
      )
    )
  })

  it('can get recipes paths', async () => {
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
    const busyboxRecipe = recipes.find((recipe) => recipe.name === 'busybox')
    expect(busyboxRecipe).toEqual(
      expect.objectContaining({
        path: expect.objectContaining({
          base: expect.stringContaining('.bb')
        })
      })
    )
  })

  it('can get tricky recipes paths', async () => {
    // These recipes change their PN and require the recipesWithoutPaths code
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
    const gccSourceRecipe = recipes.find((recipe) => recipe.name.includes('gcc-source-'))
    expect(gccSourceRecipe).toEqual(
      expect.objectContaining({
        path: expect.objectContaining({
          base: expect.stringContaining('.bb')
        })
      })
    )
    const goCrossCanadianRecipe = recipes.find((recipe) => recipe.name.includes('go-cross-canadian'))
    expect(goCrossCanadianRecipe).toEqual(
      expect.objectContaining({
        path: expect.objectContaining({
          base: expect.stringContaining('go-cross-canadian')
        })
      })
    )
    const goCrossRecipe = recipes.find((recipe) => recipe.name.includes('go-cross-core2-64'))
    expect(goCrossRecipe).toEqual(
      expect.objectContaining({
        path: expect.objectContaining({
          base: expect.stringContaining('go-cross_')
        })
      })
    )
  })

  it('respects PREFERRED_VERSION', async () => {
    const recipes = bitBakeProjectScanner.activeScanResult._recipes
    const fixtureVersionRecipe = recipes.find((recipe) => recipe.name === 'fixture-version')
    expect(fixtureVersionRecipe).toEqual(
      expect.objectContaining({
        version: '0.2.0',
        path: expect.objectContaining({
          base: 'fixture-version_0.2.0.bb'
        })
      })
    )
  })

  it('can get a list of classes', async () => {
    const classes = bitBakeProjectScanner.activeScanResult._classes
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
    const overrides = bitBakeProjectScanner.activeScanResult._overrides
    expect(overrides.length).toBeGreaterThan(5)
    expect(overrides).toEqual(
      expect.arrayContaining([
        'class-target'
      ])
    )
  })

  it('can get a list of conf files', async () => {
    const confFiles = bitBakeProjectScanner.activeScanResult._confFiles
    expect(confFiles.length).toBeGreaterThan(0)
    expect(confFiles).toEqual(
      expect.arrayContaining(
        [
          expect.objectContaining(
            {
              path: expect.objectContaining({
                base: 'bitbake.conf'
              })
            }
          )
        ]
      )
    )
  })

  it('can get a list of devtool workspaces', async () => {
    const devtoolWorkspaces = bitBakeProjectScanner.activeScanResult._workspaces
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
