/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

import {
  type ElementInfo,
  type LayerInfo
} from './types/BitbakeScanResult'
import { logger } from './utils/OutputLogger'

export function parseRecipesOutput (
  outputRecipeSection: string,
  layers: LayerInfo[]
): ElementInfo[] {
  const recipes: ElementInfo[] = []

  const recipeRegex = /(?<name>.+):\r?\n(?<entries>(?:[^\S\r\n]+\S+[^\S\r\n]+\S+(?:[^\S\r\n]+\(skipped[^\r\n]*\))?(?:\r?\n|$))+)/g
  const recipeEntryRegex = /^[^\S\r\n]+(?<layer>\S+)[^\S\r\n]+(?<version>\S+)(?<skipped>[^\S\r\n]+\(skipped[^\r\n]*\))?$/gm

  for (const match of outputRecipeSection.matchAll(recipeRegex)) {
    const name = match.groups?.name
    const entries = match.groups?.entries

    if (name === undefined || entries === undefined) {
      logger.error('[parseRecipesOutput] recipeName or entries are undefined')
      continue
    }

    const recipeEntries = [...entries.matchAll(recipeEntryRegex)]
    const selectedEntry = recipeEntries.find((entry) => entry.groups?.skipped === undefined) ?? recipeEntries[0]

    if (selectedEntry === undefined) {
      logger.error(`[parseRecipesOutput] no recipe entries found for ${name}`)
      continue
    }

    const orderedRecipeEntries = [
      selectedEntry,
      ...recipeEntries.filter((entry) => entry !== selectedEntry)
    ]

    const skipped = selectedEntry.groups?.skipped

    for (const recipeEntry of orderedRecipeEntries) {
      const layerName = recipeEntry.groups?.layer
      const version = recipeEntry.groups?.version

      const extraInfo = [`layer: ${layerName}`, `version: ${version} `].join('\r\n')

      const layerInfo = layers.find((layer) => {
        return layer.name === layerName || path.parse(layer.path).name === layerName
      })

      recipes.push({
        name,
        extraInfo,
        layerInfo,
        version,
        skipped
      })
    }
  }

  return recipes
}
