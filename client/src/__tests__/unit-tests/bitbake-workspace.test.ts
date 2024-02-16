/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { BitbakeWorkspace } from '../../ui/BitbakeWorkspace'

describe('Bitbake Workspace Test Suite', () => {
  const bitbakeWorkspace = new BitbakeWorkspace()

  it('should manage a list of active recipes', async () => {
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
    await bitbakeWorkspace.addActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual(['foo'])

    await bitbakeWorkspace.dropActiveRecipe('foo')
    expect(bitbakeWorkspace.activeRecipes).toEqual([])
  })
})
