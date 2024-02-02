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

export class BitbakeDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private readonly client: LanguageClient

  constructor (client: LanguageClient) {
    this.client = client
  }

  private async resolveUris (uri: vscode.Uri, linksData: Array<{ value: string, range: vscode.Range }>, token: vscode.CancellationToken): Promise<{ foundFolders: vscode.Uri[], foundFiles: vscode.Uri[] }> {
    const foundFolders: vscode.Uri[] = []
    const foundFiles: vscode.Uri[] = []

    /* Corresponding file:// URI usually point to files in ${PN}/ or files/. Ex:
      * recipes-core
      * ├── busybox
      * │   └── defconfig
      * ├── busybox_1.36.1.bb
      * ├── busybox.inc
      * └── files
      *     └── syslog-startup.conf
    */
    const filenames = linksData.map(link => link.value.split(';')[0])
    const filenamesRegex = '{' + filenames.join(',') + '}'
    const parentDir = path.dirname(uri.path)
    const pnDir = path.join(parentDir, extractRecipeName(uri.path) as string)
    const filesDir = path.join(parentDir, 'files')

    /**
     * connman/
     * ├── connman-gnome/
     *     └── images/
     * ├── connman-gnome_0.7.bb
     * └── ... (other files and folders)
     */
    for (let i = 0; i < linksData.length; i++) {
      const pathToCheckStat = path.join(pnDir, linksData[i].value.split(';')[0])
      try {
        const fileStat = await vscode.workspace.fs.stat(vscode.Uri.parse(pathToCheckStat))
        if (fileStat.type === vscode.FileType.Directory) {
          foundFolders.push(vscode.Uri.parse(pathToCheckStat))
        }
      } catch (error) {
        logger.debug(`Error when checking stat of ${pathToCheckStat}. ${JSON.stringify(error)}`)
      }
    }

    try {
      foundFiles.push(...[
        ...(await vscode.workspace.findFiles(new vscode.RelativePattern(pnDir, '**/' + filenamesRegex), undefined, filenames.length, token)),
        ...(await vscode.workspace.findFiles(new vscode.RelativePattern(filesDir, '**/' + filenamesRegex), undefined, filenames.length, token))
      ])
    } catch (err) {
      logger.error(`An error occurred when finding files with pattern: ${filenamesRegex}. ${JSON.stringify(err)}`)
    }

    return { foundFolders, foundFiles }
  }

  async provideDocumentLinks (document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
    const linksData = await this.client.sendRequest<RequestResult['getLinksInDocument']>(RequestMethod.getLinksInDocument, { documentUri: document.uri.toString() })
    const documentLinks: vscode.DocumentLink[] = []
    const { foundFiles, foundFolders } = await this.resolveUris(document.uri, linksData, token)

    logger.debug(`Found ${foundFolders.length} folders from the links in file: ${document.uri.toString()}`)
    logger.debug(`Found ${foundFiles.length} files from the links in file: ${document.uri.toString()}`)

    // Assign command uri to folders
    foundFolders.forEach((folder) => {
      const range = linksData.find(link => folder.path.endsWith(link.value))?.range

      if (range === undefined) {
        return
      }

      /*
        commandArguments could be formatted into an array for intermediary command if needed.
        Reference: https://code.visualstudio.com/api/extension-guides/command#command-uris
      */
      const targetUri = vscode.Uri.parse(`command:revealInExplorer?${encodeURIComponent(JSON.stringify(folder))}`)
      documentLinks.push(new vscode.DocumentLink(range, targetUri))
    })

    for (let i = 0; i < linksData.length; i++) {
      const link = linksData[i]
      const range = new vscode.Range(
        link.range.start.line,
        link.range.start.character,
        link.range.end.line,
        link.range.end.character
      )

      const filename = link.value.split(';')[0]

      const file = foundFiles.find(file => file.path.endsWith(filename))
      if (file !== undefined) {
        documentLinks.push(new vscode.DocumentLink(range, vscode.Uri.parse(file.fsPath)))
      }
    }

    return documentLinks
  }
}
