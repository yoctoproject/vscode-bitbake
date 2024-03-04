/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// Temporary fix for the web extension
// TODO: Remove this when the language server is ready
export function activate (): void {
  console.log('Congratulations, your extension "yocto-project.yocto-bitbake" for web is now active!')
  console.log('Please note that this web extension only provides highlighting. We are working on adding more features in the future.')
}

export function deactivate (): void {
  console.log('Your extension "yocto-project.yocto-bitbake" for web is now deactivated!')
}
