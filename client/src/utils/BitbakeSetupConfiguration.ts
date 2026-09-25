/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface BitbakeSetupFragmentOption {
  name: string
  description?: string
}

export interface BitbakeSetupFragmentGroup {
  name: string
  description: string
  options: BitbakeSetupFragmentOption[]
}

export interface BitbakeSetupConfiguration {
  name?: string
  description?: string
  fragmentGroups: BitbakeSetupFragmentGroup[]
  configurations: BitbakeSetupConfiguration[]
}

export interface BitbakeSetupConfigurationManifest {
  configurations: BitbakeSetupConfiguration[]
}

export function parseBitbakeSetupConfigurationManifest (
  payload: unknown
): BitbakeSetupConfigurationManifest {
  const root = requireObject(payload, 'configuration manifest')
  const bitbakeSetup = requireObject(
    root['bitbake-setup'],
    'configuration manifest bitbake-setup'
  )
  const configurations = requireArray(
    bitbakeSetup.configurations,
    'configuration manifest bitbake-setup.configurations'
  )

  if (configurations.length === 0) {
    throw new Error(
      'configuration manifest bitbake-setup.configurations must not be empty'
    )
  }

  return {
    configurations: configurations.map((configuration, index) =>
      parseConfiguration(
        configuration,
        `configuration manifest bitbake-setup.configurations[${index}]`
      )
    )
  }
}

function parseConfiguration (
  payload: unknown,
  location: string
): BitbakeSetupConfiguration {
  const configuration = requireObject(payload, location)

  const name = optionalString(configuration.name, `${location}.name`)
  const description = optionalString(
    configuration.description,
    `${location}.description`
  )

  const fragmentGroups = parseFragmentGroups(
    configuration['oe-fragments-one-of'],
    `${location}.oe-fragments-one-of`
  )

  const childPayload = configuration.configurations
  let configurations: BitbakeSetupConfiguration[] = []

  if (childPayload !== undefined) {
    const children = requireArray(childPayload, `${location}.configurations`)

    if (children.length === 0) {
      throw new Error(`${location}.configurations must not be empty`)
    }

    configurations = children.map((child, index) =>
      parseConfiguration(child, `${location}.configurations[${index}]`)
    )
  }

  if (configurations.length === 0 && name === undefined) {
    throw new Error(`${location}.name is required for a selectable configuration`)
  }

  return {
    name,
    description,
    fragmentGroups,
    configurations
  }
}

function parseFragmentGroups (
  payload: unknown,
  location: string
): BitbakeSetupFragmentGroup[] {
  if (payload === undefined) {
    return []
  }

  const groups = requireObject(payload, location)

  return Object.entries(groups).map(([name, groupPayload]) => {
    const group = requireObject(groupPayload, `${location}.${name}`)
    const description = requireString(
      group.description,
      `${location}.${name}.description`
    )
    const options = requireArray(
      group.options,
      `${location}.${name}.options`
    )

    return {
      name,
      description,
      options: options.map((option, index) =>
        parseFragmentOption(
          option,
          `${location}.${name}.options[${index}]`
        )
      )
    }
  })
}

function parseFragmentOption (
  payload: unknown,
  location: string
): BitbakeSetupFragmentOption {
  if (typeof payload === 'string') {
    return { name: payload }
  }

  const option = requireObject(payload, location)

  return {
    name: requireString(option.name, `${location}.name`),
    description: optionalString(
      option.description,
      `${location}.description`
    )
  }
}

function requireObject (
  value: unknown,
  location: string
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${location} must be an object`)
  }

  return value as Record<string, unknown>
}

function requireArray (
  value: unknown,
  location: string
): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array`)
  }

  return value
}

function requireString (
  value: unknown,
  location: string
): string {
  if (typeof value !== 'string') {
    throw new Error(`${location} must be a string`)
  }

  return value
}

function optionalString (
  value: unknown,
  location: string
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return requireString(value, location)
}
