const path = require('path');

import * as vscode from 'vscode';

/// Defines the context of a bitbake workspace with all information to call bitbake
export interface BitbakeSettings {
  pathToBitbakeFolder : string
  pathToBuildFolder : string
  pathToEnvScript : string
}

export function loadBitbakeSettings() : BitbakeSettings {
  const settings = vscode.workspace.getConfiguration('bitbake')

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  let workspacePath = ''
  if(workspaceFolder) {
    workspacePath = workspaceFolder.uri.fsPath
  }

  // The default values are defined in package.json
  let pathToBitbakeFolder : string = settings.get<string>('pathToBitbakeFolder', '')
  pathToBitbakeFolder = pathToBitbakeFolder.replace('${workspaceFolder}', workspacePath)
  pathToBitbakeFolder = path.resolve(pathToBitbakeFolder)
  let pathToBuildFolder : string = settings.get<string>('pathToBuildFolder', '')
  pathToBuildFolder = pathToBuildFolder.replace('${workspaceFolder}', workspacePath)
  pathToBuildFolder = path.resolve(pathToBuildFolder)
  let pathToEnvScript : string = settings.get<string>('pathToEnvScript', '')
  pathToEnvScript = pathToEnvScript.replace('${workspaceFolder}', workspacePath)
  pathToEnvScript = path.resolve(pathToEnvScript)

  return {
    pathToBitbakeFolder: pathToBitbakeFolder,
    pathToBuildFolder: pathToBuildFolder,
    pathToEnvScript: pathToEnvScript
  }
}
