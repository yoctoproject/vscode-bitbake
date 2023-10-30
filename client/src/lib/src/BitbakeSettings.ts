/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from 'path'

/// Defines the context of a bitbake workspace with all information to call bitbake
export interface BitbakeSettings {
  pathToBitbakeFolder: string
  pathToBuildFolder: string
  pathToEnvScript: string
}

export function loadBitbakeSettings (settings: any, workspaceFolder: string = ''): BitbakeSettings {
  /* eslint no-template-curly-in-string: "off" */
  // The default values are defined in package.json
  let pathToBitbakeFolder: string = settings.pathToBitbakeFolder
  pathToBitbakeFolder = pathToBitbakeFolder.replace('${workspaceFolder}', workspaceFolder)
  pathToBitbakeFolder = path.resolve(pathToBitbakeFolder)
  let pathToBuildFolder: string = settings.pathToBuildFolder
  pathToBuildFolder = pathToBuildFolder.replace('${workspaceFolder}', workspaceFolder)
  pathToBuildFolder = path.resolve(pathToBuildFolder)
  let pathToEnvScript: string = settings.pathToEnvScript
  pathToEnvScript = pathToEnvScript.replace('${workspaceFolder}', workspaceFolder)
  pathToEnvScript = path.resolve(pathToEnvScript)

  return {
    pathToBitbakeFolder,
    pathToBuildFolder,
    pathToEnvScript
  }
}
