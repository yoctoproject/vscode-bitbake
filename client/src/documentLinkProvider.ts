/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import vscode from 'vscode'
import { type LanguageClient } from 'vscode-languageclient/node'
import { RequestMethod, type RequestResult } from './lib/src/types/requests'
import path from 'path'
import { extractRecipeName } from './lib/src/utils/files'
import { CancellableFileSearch } from './utils/CancellableFileSearch'
import fg from 'fast-glob'

interface RecipeLocalSearch {
  roots: string[]
}

export class BitbakeDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private readonly client: LanguageClient

  constructor (client: LanguageClient) {
    this.client = client
  }

  public static getRecipeLocalSearch (
    uri: string
  ): RecipeLocalSearch | undefined {
    if (path.extname(uri) === '.conf') {
      return undefined
    }

    const parentDir = path.dirname(uri)

    return {
      roots: [
        path.join(parentDir, extractRecipeName(uri)),
        path.join(parentDir, 'files')
      ]
    }
  }


  public static getRecipeLocalPatterns (
    search: RecipeLocalSearch,
    filenames?: string[]
  ): string[] {
    if (filenames?.length === 0) {
      return []
    }

    return search.roots.flatMap(root => {
      const rootPattern = fg.convertPathToPattern(root)

      if (filenames === undefined) {
        return [`${rootPattern}/**/*`]
      }

      return filenames.map(filename => {
        return `${rootPattern}/**/${fg.escapePath(filename)}`
      })
    })
  }

  private basenameIsEqual (path1: string, path2: string): boolean {
    return path.basename(path1) === path.basename(path2)
  }

  private async resolveUris (
    search: RecipeLocalSearch,
    linksData: Array<{ value: string, range: vscode.Range }>,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const documentLinks: vscode.DocumentLink[] = []

    const linksWithoutTails = linksData.map(link => {
      return {
        ...link,
        value: link.value.split(';')[0]
      }
    })

    const filenames = linksWithoutTails.map(link => link.value)
    const patterns =
      BitbakeDocumentLinkProvider.getRecipeLocalPatterns(
        search,
        filenames
      )

    const { foundFiles, foundDirs } =
      await CancellableFileSearch.findFilesAndDirs(
        patterns,
        filenames.length,
        token
      )

    for (const link of linksWithoutTails) {
      const fileUri = foundFiles.find(file => {
        return this.basenameIsEqual(file.fsPath, link.value)
      })

      if (fileUri !== undefined) {
        documentLinks.push({
          ...new vscode.DocumentLink(link.range, fileUri),
          tooltip: 'Bitbake: Go to file'
        })
        continue
      }

      const foundDir = foundDirs.find(dir => {
        return this.basenameIsEqual(dir, link.value)
      })

      if (foundDir !== undefined) {
        const targetUri = vscode.Uri.parse(
          `command:revealInExplorer?${
            encodeURIComponent(
              JSON.stringify(vscode.Uri.parse(foundDir))
            )
          }`
        )

        documentLinks.push({
          ...new vscode.DocumentLink(link.range, targetUri),
          tooltip: 'Bitbake: Reveal in explorer'
        })
      }
    }

    return documentLinks
  }

  async provideDocumentLinks (
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const search =
      BitbakeDocumentLinkProvider.getRecipeLocalSearch(
        document.uri.fsPath
      )

    if (search === undefined) {
      return []
    }

    const linksData =
      await this.client.sendRequest<
      RequestResult['getLinksInDocument']
      >(
        RequestMethod.getLinksInDocument,
        { documentUri: document.uri.toString() }
      )

    return await this.resolveUris(search, linksData, token)
  }
}
