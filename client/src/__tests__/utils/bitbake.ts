/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'
import fs from 'fs'

/// Copy a recipe into poky
export async function importRecipe (recipePath: string, pokyPath: string): Promise<void> {
  const pokyDestinationPath = path.resolve(pokyPath, 'meta/recipes-core/base-files', path.basename(recipePath))
  await fs.promises.copyFile(recipePath, pokyDestinationPath)
}

export async function removeRecipe (recipePath: string, pokyPath: string): Promise<void> {
  const pokyDestinationPath = path.resolve(pokyPath, 'meta/recipes-core/base-files', path.basename(recipePath))
  await fs.promises.unlink(pokyDestinationPath)
}
