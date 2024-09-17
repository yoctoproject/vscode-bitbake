/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface BitbakeBuildConfigSettings {
  pathToBuildFolder?: string
  pathToEnvScript?: string
  commandWrapper?: string
  workingDirectory?: string
  shellEnv?: NodeJS.Dict<string>
  sshTarget?: string
  sdkImage?: string
  name?: string
}

/// Defines the context of a bitbake workspace with all information to call bitbake
export interface BitbakeSettings extends BitbakeBuildConfigSettings {
  pathToBitbakeFolder: string
  buildConfigurations?: BitbakeBuildConfigSettings[]
}

export function loadBitbakeSettings (settings: Record<string, unknown>, workspaceFolder: string): BitbakeSettings {
  // The default values are defined in package.json
  // Change the working directory to properly handle relative paths in the language client
  try {
    process.chdir(workspaceFolder)
  } catch (err) {
    console.error(`chdir: $settings.${err}`)
  }

  const variables = {
    workspaceFolder,
    ...Object.fromEntries(Object.entries(process.env).map(([key, value]) => [`env:${key}`, value]))
  }

  const expandedSettings: BitbakeSettings = {
    ...expandBuildConfig(settings, variables),
    pathToBitbakeFolder: expandSettingPath(settings.pathToBitbakeFolder, variables) ?? workspaceFolder,
    buildConfigurations: expandBuildConfigsSettings(settings.buildConfigurations, variables)
  }
  expandedSettings.workingDirectory = expandedSettings.workingDirectory ?? workspaceFolder

  return expandedSettings
}

export function expandSettingPath (configurationPath: unknown, variables: NodeJS.Dict<string>): string | undefined {
  if (typeof configurationPath !== 'string' || configurationPath === '' || configurationPath === undefined) {
    return undefined
  }
  return expandSettingString(configurationPath, variables) as string
}

function expandSettingString (configurationPath: unknown, variables: NodeJS.Dict<string>): string | undefined {
  if (typeof configurationPath !== 'string' || configurationPath === '' || configurationPath === undefined) {
    return undefined
  }
  return sanitizeForShell(substituteVariables(configurationPath, variables)) as string
}

/// Substitute ${variables} in a string
function substituteVariables (configuration: string, variables: NodeJS.Dict<string>): string {
  // Reproduces the behavior of https://code.visualstudio.com/docs/editor/variables-reference
  // VSCode should be doing this for us, has been requested for years: https://github.com/microsoft/vscode/issues/2809
  return configuration.replace(/\${(.*?)}/g, (_, name) => {
    return variables[name] ?? ''
  })
}

function expandStringDict (dict: unknown, variables: NodeJS.Dict<string>): NodeJS.Dict<string> | undefined {
  return (dict != null) ? Object.fromEntries(Object.entries(dict).map(([key, value]) => [key, expandSettingString(value, variables) as string])) : undefined
}

/// Santitize a string to be passed in a shell command (remove special characters)
export function sanitizeForShell (command: string | undefined): string | undefined {
  if (command === undefined) {
    return undefined
  }
  return command.replace(/[;`&|<>\\$(){}!#*?"']/g, '')
}

function toStringDict (dict: unknown | undefined): NodeJS.Dict<string> | undefined {
  return dict as NodeJS.Dict<string> | undefined
}

function expandBuildConfigsSettings (buildConfigurations: unknown, variables: NodeJS.Dict<string>): BitbakeBuildConfigSettings[] | undefined {
  if (buildConfigurations === undefined || !Array.isArray(buildConfigurations)) {
    return undefined
  }
  return buildConfigurations.map((settings) => expandBuildConfig(settings, variables))
}

function expandBuildConfig (settings: Record<string, unknown>, variables: NodeJS.Dict<string>): BitbakeBuildConfigSettings {
  return {
    pathToBuildFolder: expandSettingPath(settings.pathToBuildFolder, variables),
    pathToEnvScript: expandSettingPath(settings.pathToEnvScript, variables),
    commandWrapper: expandSettingString(settings.commandWrapper, variables),
    workingDirectory: expandSettingPath(settings.workingDirectory, variables),
    shellEnv: expandStringDict(toStringDict(settings.shellEnv), variables),
    sdkImage: expandSettingString(settings.sdkImage, variables),
    sshTarget: expandSettingString(settings.sshTarget, variables),
    name: expandSettingString(settings.name, variables)
  }
}

export function getBuildSetting (settings: BitbakeSettings, buildConfiguration: string, property: keyof BitbakeBuildConfigSettings): string | NodeJS.Dict<string> | undefined {
  if (settings.buildConfigurations !== undefined) {
    const buildConfig = settings.buildConfigurations.find(config => config.name === buildConfiguration)
    if (buildConfig !== undefined) {
      return buildConfig[property] ?? settings[property]
    } else {
      // This mimics the BitbakeConfigPicker which always selects the first configuration if the active one is not found
      const firstConfig = settings.buildConfigurations[0]
      if (firstConfig !== undefined) {
        return firstConfig[property] ?? settings[property]
      }
    }
  }
  return settings[property]
}
