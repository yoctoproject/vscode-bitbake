/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

/// Class representing active bitbake recipes for a bitbake project
export interface BitbakeWorkspace {
  activeRecipes: string[]
}
