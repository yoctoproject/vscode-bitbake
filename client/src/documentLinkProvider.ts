/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { RequestMethod, type RequestResult } from './lib/src/types/requests'
import { logger } from './lib/src/utils/OutputLogger'

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
        const [file] = await vscode.workspace.findFiles(link.value, undefined, 1)
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
