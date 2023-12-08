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

  private async findRelatedFiles (document: vscode.TextDocument, linksData: Array<{ value: string, range: vscode.Range }>, token: vscode.CancellationToken): Promise<vscode.Uri[]> {
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
    const parentDir = document.uri.path.split('/').slice(0, -1).join('/')
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
    const pnDir = path.join(parentDir, extractRecipeName(document.uri.path) as string)
    const pnDirRelative = pnDir.replace(workspaceFolder?.uri.path + '/', '')
    const filesDir = path.join(parentDir, 'files')
    const filesDirRelative = filesDir.replace(workspaceFolder?.uri.path + '/', '')
    return [...(await vscode.workspace.findFiles(pnDirRelative + '/**/' + filenamesRegex, undefined, filenames.length, token)),
      ...(await vscode.workspace.findFiles(filesDirRelative + '/**/' + filenamesRegex, undefined, filenames.length, token))]
  }

  async provideDocumentLinks (document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
    const linksData = await this.client.sendRequest<RequestResult['getLinksInDocument']>(RequestMethod.getLinksInDocument, { documentUri: document.uri.toString() })
    const documentLinks: vscode.DocumentLink[] = []
    const relatedFiles = await this.findRelatedFiles(document, linksData, token)
    logger.debug(`Found ${relatedFiles.length} local SRC_URI files for ${document.uri.toString()}`)

    for (let i = 0; i < linksData.length; i++) {
      const link = linksData[i]
      const range = new vscode.Range(
        link.range.start.line,
        link.range.start.character,
        link.range.end.line,
        link.range.end.character
      )
      try {
        const filename = link.value.split(';')[0]

        const file = relatedFiles.find(file => file.path.endsWith(filename))
        if (file !== undefined) {
          documentLinks.push(new vscode.DocumentLink(range, vscode.Uri.parse(file.fsPath)))
        }
      } catch (err) {
        logger.error(`An error occurred when finding files with pattern: ${link.value}. ${JSON.stringify(err)}`)
      }
    }

    return documentLinks
  }
}
