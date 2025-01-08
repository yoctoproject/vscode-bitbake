/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import ejs from 'ejs'
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

	async resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Promise<void> {
		this.view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this.extensionUri
			]
		};

		webviewView.webview.html = await this.getHtmlForWebview(webviewView.webview);

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

    private getHtmlForWebview(webview: vscode.Webview): Promise<string> {
		const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.html'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = this.getNonce();

		const html = ejs.renderFile(htmlUri.fsPath, {
			nonce: nonce,
			scriptUri: scriptUri,
			styleResetUri: styleResetUri,
			styleVSCodeUri: styleVSCodeUri,
			styleMainUri: styleMainUri,
			webview: webview
		});
		return html;
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
