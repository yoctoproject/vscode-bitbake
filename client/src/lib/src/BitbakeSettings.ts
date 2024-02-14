/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// Defines the context of a bitbake workspace with all information to call bitbake
export interface BitbakeSettings {
  pathToBitbakeFolder: string
  pathToBuildFolder?: string
  pathToEnvScript?: string
  commandWrapper?: string
  workingDirectory?: string
  shellEnv?: NodeJS.Dict<string>
  sshTarget?: string
  sdkImage?: string
}

export function loadBitbakeSettings (settings: any, workspaceFolder: string): BitbakeSettings {
  // The default values are defined in package.json
  // Change the working directory to properly handle relative paths in the language client
  try {
    process.chdir(workspaceFolder)
  } catch (err: any) {
    console.error(`chdir: ${err}`)
  }

  const variables = {
    workspaceFolder,
    ...Object.fromEntries(Object.entries(process.env).map(([key, value]) => [`env:${key}`, value]))
  }

  const expandedSettings = {
    pathToBitbakeFolder: expandSettingPath(settings.pathToBitbakeFolder, variables) ?? workspaceFolder,
    pathToBuildFolder: expandSettingPath(settings.pathToBuildFolder, variables),
    pathToEnvScript: expandSettingPath(settings.pathToEnvScript, variables),
    commandWrapper: expandSettingString(settings.commandWrapper, variables),
    workingDirectory: expandSettingPath(settings.workingDirectory, variables) ?? workspaceFolder,
    shellEnv: expandStringDict(toStringDict(settings.shellEnv), variables),
    sdkImage: expandSettingString(settings.sdkImage, variables),
    sshTarget: expandSettingString(settings.sshTarget, variables)
  }
  return expandedSettings
}

export function expandSettingPath (configurationPath: string | undefined, variables: NodeJS.Dict<string>): string | undefined {
  if (configurationPath === '' || configurationPath === undefined) {
    return undefined
  }
  return expandSettingString(configurationPath, variables) as string
}

function expandSettingString (configurationPath: string | undefined, variables: NodeJS.Dict<string>): string | undefined {
  if (configurationPath === '' || configurationPath === undefined) {
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

function expandStringDict (dict: NodeJS.Dict<string> | undefined, variables: NodeJS.Dict<string>): NodeJS.Dict<string> | undefined {
  return (dict != null) ? Object.fromEntries(Object.entries(dict).map(([key, value]) => [key, expandSettingString(value, variables) as string])) : undefined
}

/// Santitize a string to be passed in a shell command (remove special characters)
export function sanitizeForShell (command: string | undefined): string | undefined {
  if (command === undefined) {
    return undefined
  }
  return command.replace(/[;`&|<>\\$(){}!#*?"']/g, '')
}

function toStringDict (dict: object | undefined): NodeJS.Dict<string> | undefined {
  return dict as NodeJS.Dict<string> | undefined
}
