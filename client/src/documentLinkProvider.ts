/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import vscode, { type Uri } from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { RequestMethod, type RequestResult } from './lib/src/types/requests'
import { logger } from './lib/src/utils/OutputLogger'
import path from 'path'
import { extractRecipeName } from './lib/src/utils/files'

export class DocumentLinkProvider implements vscode.DocumentLinkProvider {
  private readonly client: LanguageClient

  constructor (client: LanguageClient) {
    this.client = client
  }

  async provideDocumentLinks (document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
    const linksData = await this.client.sendRequest<RequestResult['getLinksInDocument']>(RequestMethod.getLinksInDocument, { documentUri: document.uri.toString() })
    const documentLinks: vscode.DocumentLink[] = []
    for (let i = 0; i < linksData.length; i++) {
      const link = linksData[i]
      const range = new vscode.Range(
        link.range.start.line,
        link.range.start.character,
        link.range.end.line,
        link.range.end.character
      )
      try {
        /* Corresponding file:// URI usually point to files in ${PN}/ or files/. Ex:
         * recipes-core
         * ├── busybox
         * │   └── defconfig
         * ├── busybox_1.36.1.bb
         * ├── busybox.inc
         * └── files
         *     └── syslog-startup.conf
        */
        const parentDir = document.uri.path.split('/').slice(0, -1).join('/')
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
        const pnDir = path.join(parentDir, extractRecipeName(document.uri.path) as string)
        const pnDirRelative = pnDir.replace(workspaceFolder?.uri.path + '/', '')
        const filesDir = path.join(parentDir, 'files')
        const filesDirRelative = filesDir.replace(workspaceFolder?.uri.path + '/', '')
        const filename = link.value.split(';')[0]

        const file = (await vscode.workspace.findFiles(pnDirRelative + '/**/' + filename, undefined, 1))[0] ??
          (await vscode.workspace.findFiles(filesDirRelative + '/**/' + filename, undefined, 1))[0]
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
