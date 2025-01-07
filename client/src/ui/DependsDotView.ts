/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import { BitbakeDriver } from '../driver/BitbakeDriver'

export class DependsDotView {
  private readonly provider: DependsDotViewProvider

  constructor (bitbakeDriver: BitbakeDriver, extensionUri: vscode.Uri) {
    this.provider = new DependsDotViewProvider(bitbakeDriver, extensionUri)
  }

  registerView (context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        DependsDotViewProvider.viewType,
        this.provider))
  }
}

class DependsDotViewProvider implements vscode.WebviewViewProvider {
    private readonly bitbakeDriver: BitbakeDriver
    public static readonly viewType = "bitbake.oeDependsDot"
    private view?: vscode.WebviewView;
    private extensionUri: vscode.Uri

    constructor (bitbakeDriver: BitbakeDriver, extensionUri: vscode.Uri) {
        this.bitbakeDriver = bitbakeDriver
        this.extensionUri = extensionUri
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
		this.view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this.extensionUri
			]
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
			}
		});
    }

    private getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = this.getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>

				<button class="add-color-button">Add Color</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
