/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  type BitbakeSetupConfiguration,
  type BitbakeSetupConfigurationManifest,
  type BitbakeSetupFragmentGroup
} from './BitbakeSetupConfiguration'

export interface BitbakeSetupSelectableConfiguration {
  name: string
  description?: string
  fragmentGroups: BitbakeSetupFragmentGroup[]
}

export function getBitbakeSetupSelectableConfigurations (
  manifest: BitbakeSetupConfigurationManifest
): BitbakeSetupSelectableConfiguration[] {
  return manifest.configurations.flatMap(configuration =>
    flattenConfiguration(configuration, [])
  )
}

function flattenConfiguration (
  configuration: BitbakeSetupConfiguration,
  inheritedFragmentGroups: BitbakeSetupFragmentGroup[]
): BitbakeSetupSelectableConfiguration[] {
  const fragmentGroups = mergeFragmentGroups(
    inheritedFragmentGroups,
    configuration.fragmentGroups
  )

  if (configuration.configurations.length > 0) {
    return configuration.configurations.flatMap(child =>
      flattenConfiguration(child, fragmentGroups)
    )
  }

  if (configuration.name === undefined) {
    throw new Error('Selectable bitbake-setup configuration is missing a name')
  }

  return [{
    name: configuration.name,
    description: configuration.description,
    fragmentGroups
  }]
}

function mergeFragmentGroups (
  inherited: BitbakeSetupFragmentGroup[],
  current: BitbakeSetupFragmentGroup[]
): BitbakeSetupFragmentGroup[] {
  const names = new Set<string>()

  for (const group of [...inherited, ...current]) {
    if (names.has(group.name)) {
      throw new Error(
        `Duplicate bitbake-setup fragment group '${group.name}' in nested configuration`
      )
    }

    names.add(group.name)
  }

  return [...inherited, ...current]
}
