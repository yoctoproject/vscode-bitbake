/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { type BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import * as fs from 'fs'

export class BitbakeTerminalLinkProvider implements vscode.TerminalLinkProvider {
  bitBakeProjectScanner: BitBakeProjectScanner

  constructor (bitBakeProjectScanner: BitBakeProjectScanner) {
    this.bitBakeProjectScanner = bitBakeProjectScanner
  }

  async provideTerminalLinks (context: vscode.TerminalLinkContext): Promise<vscode.TerminalLink[]> {
    const links: vscode.TerminalLink[] = []
    // We only have additional links to provide if we need to resolve container paths
    if (!this.bitBakeProjectScanner.needsContainerPathsResolution()) { return links }

    // Match any string that starts with a slash enclosed in spaces or special characters
    const regex = /(^|[^a-zA-Z0-9_/.-])(\/[a-zA-Z0-9_/.-]+)(?=$|[^a-zA-Z0-9_/.-])/g
    const matches = context.line.matchAll(regex)
    for (const match of matches) {
      if (match.index === undefined) continue
      const link = new vscode.TerminalLink(
        match.index + match[1].length,
        match[2].length,
        // We pass the link's URI in the tooltip. There's no other way to pass data to the handleTerminalLink method.
        // It's easier than storing and managing a map of links to URIs.
        await this.bitBakeProjectScanner.resolveContainerPath(match[2], true) ?? match[2]
      )
      links.push(link)
    }
    return links
  }

  handleTerminalLink (link: vscode.TerminalLink): vscode.ProviderResult<void> {
    const path = link.tooltip as string
    const uri = vscode.Uri.file(path)
    if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) { // TODO test folder
      void vscode.commands.executeCommand('revealInExplorer', uri)
    } else {
      void vscode.commands.executeCommand('vscode.open', uri)
    }
  }
}
