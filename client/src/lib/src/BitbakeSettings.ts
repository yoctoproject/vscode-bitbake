/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

/// Defines the context of a bitbake workspace with all information to call bitbake
export interface BitbakeSettings {
  pathToBitbakeFolder: string
  pathToBuildFolder?: string
  pathToEnvScript?: string
  commandWrapper?: string
  workingDirectory: string
}

export function loadBitbakeSettings (settings: any, workspaceFolder: string): BitbakeSettings {
  /* eslint no-template-curly-in-string: "off" */
  // The default values are defined in package.json
  // Change the working directory to properly handle relative paths in the language client
  try {
    process.chdir(workspaceFolder)
  } catch (err: any) {
    console.error(`chdir: ${err}`)
  }

  return {
    pathToBitbakeFolder: resolveSettingsPath(settings.pathToBitbakeFolder, workspaceFolder),
    pathToBuildFolder: settings.pathToBuildFolder !== '' ? resolveSettingsPath(settings.pathToBuildFolder, workspaceFolder) : undefined,
    pathToEnvScript: settings.pathToEnvScript !== '' ? resolveSettingsPath(settings.pathToEnvScript, workspaceFolder) : undefined,
    commandWrapper: settings.commandWrapper !== '' ? expandWorkspaceFolder(settings.commandWrapper, workspaceFolder) : undefined,
    workingDirectory: settings.workingDirectory !== '' ? resolveSettingsPath(settings.workingDirectory, workspaceFolder) : workspaceFolder
  }
}

function resolveSettingsPath (configurationPath: string, workspaceFolder: string): string {
  return path.resolve(expandWorkspaceFolder(configurationPath, workspaceFolder))
}

function expandWorkspaceFolder (configuration: string, workspaceFolder: string): string {
  return sanitizeForShell(configuration.replace(/\${workspaceFolder}/g, workspaceFolder)) as string
}

/// Santitize a string to be passed in a shell command (remove special characters)
function sanitizeForShell (command: string | undefined): string | undefined {
  if (command === undefined) {
    return undefined
  }
  return command.replace(/[;`&|<>\\$(){}!#*?"']/g, '')
}
