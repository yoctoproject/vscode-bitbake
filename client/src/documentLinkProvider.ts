/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { RequestMethod, type RequestResult } from './lib/src/types/requests'
import { logger } from './lib/src/utils/OutputLogger'
import path from 'path'
import { extractRecipeName } from './lib/src/utils/files'
import find from 'find'
import fs from 'fs'

export class BitbakeDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private readonly client: LanguageClient

  constructor (client: LanguageClient) {
    this.client = client
  }

  private basenameIsEqual (path1: string, path2: string): boolean {
    return path.basename(path1) === path.basename(path2)
  }

  private async resolveUris (uri: vscode.Uri, linksData: Array<{ value: string, range: vscode.Range }>, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
    const documentLinks: vscode.DocumentLink[] = []

    /* Corresponding file:// URI usually point to files in ${PN}/ or files/. Ex:
      * recipes-core
      * ├── busybox
      * │   └── defconfig
      * ├── busybox_1.36.1.bb
      * ├── busybox.inc
      * └── files
      *     └── syslog-startup.conf
    */
    const LinksWithoutTails = linksData.map(link => {
      return {
        ...link,
        value: link.value.split(';')[0]
      }
    })
    const filenames = LinksWithoutTails.map(link => link.value)
    const filenamesRegex = '{' + filenames.join(',') + '}'
    const parentDir = path.dirname(uri.path)
    const pnDir = path.join(parentDir, extractRecipeName(uri.fsPath) as string)
    const filesDir = path.join(parentDir, 'files')

    const foundFiles: vscode.Uri[] = []
    try {
      foundFiles.push(...[
        ...(await vscode.workspace.findFiles(new vscode.RelativePattern(pnDir, '**/' + filenamesRegex), undefined, filenames.length, token)),
        ...(await vscode.workspace.findFiles(new vscode.RelativePattern(filesDir, '**/' + filenamesRegex), undefined, filenames.length, token))
      ])
    } catch (err) {
      logger.error(`An error occurred when finding files with pattern: ${filenamesRegex}. ${JSON.stringify(err)}`)
    }
    let foundDirs: string[] = []
    try {
      if (fs.existsSync(pnDir)) foundDirs = foundDirs.concat(find.dirSync(pnDir))
      if (fs.existsSync(filesDir)) foundDirs = foundDirs.concat(find.dirSync(filesDir))
    } catch (error) {
      logger.error(`An error occurred when finding directories within: ${pnDir}. ${JSON.stringify(error)}`)
    }

    /**
     * Important:
     * This is building the vscode.documentLink array the same order as they appear in the document to prevent
     * the results from the default provider from showing up as long as the links extracted from the document are in order.
     * So the shortcut (e.g. ctrl+click) can always work on the link this provider returned.
     * Reference: https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/links/browser/getLinks.ts#L140
     */
    for (let i = 0; i < LinksWithoutTails.length; i++) {
      const link = LinksWithoutTails[i]

      // Handle files: provide a direct link to the file
      const fileUri = foundFiles.find(file => this.basenameIsEqual(file.fsPath, link.value))
      if (fileUri !== undefined) {
        documentLinks.push({ ...new vscode.DocumentLink(link.range, fileUri), tooltip: 'Bitbake: Go to file' })
        continue
      }

      // Handle directories: provide a "Reveal in explorer" command
      const foundDir = foundDirs.find(dir => this.basenameIsEqual(dir, link.value))
      if (foundDir !== undefined) {
        /*
          commandArguments could be formatted into an array for intermediary command if needed.
          Reference: https://code.visualstudio.com/api/extension-guides/command#command-uris
        */
        const targetUri = vscode.Uri.parse(`command:revealInExplorer?${encodeURIComponent(JSON.stringify(vscode.Uri.parse(foundDir)))}`)
        // targetUri = vscode.Uri.parse('file://' + foundDir)
        documentLinks.push({ ...new vscode.DocumentLink(link.range, targetUri), tooltip: 'Bitbake: Reveal in explorer' })
      }
    }

    return documentLinks
  }

  async provideDocumentLinks (document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
    const linksData = await this.client.sendRequest<RequestResult['getLinksInDocument']>(RequestMethod.getLinksInDocument, { documentUri: document.uri.toString() })
    return await this.resolveUris(document.uri, linksData, token)
  }
}
