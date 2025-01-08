/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode'
import ejs from 'ejs'
import { BitbakeDriver } from '../driver/BitbakeDriver'
import { logger } from '../lib/src/utils/OutputLogger'
import { BitbakeTaskDefinition } from './BitbakeTaskProvider'
import { runBitbakeTerminal } from './BitbakeTerminal'
import { finishProcessExecution } from '../utils/ProcessUtils'
import { BitBakeProjectScanner } from '../driver/BitBakeProjectScanner'
import { ElementInfo } from '../lib/src/types/BitbakeScanResult'
import path from 'path'

/*
	TODO Beautify the view
	 - make div elements side by side
	 - Add some spacing
	TODO Display a graph rather than text
	TODO Make the graph interactive (click on elements open their .bb file) (bonus: right click brings the commands menu)
	TODO Auto-refresh the dotfile when needed when click dependsDot
	TODO display a checkbox wether the graph is up-to-date, successful or failed
	TODO gray out the results when the graph or package is not up-to-date
	TODO Use the select recipe command to get the image recipe list (not for the packageName though?)
	TODO Add tests for this feature
	TODO Save field values on workspace reload (https://code.visualstudio.com/api/extension-guides/webview#getstate-and-setstate and serializer)
	TODO test styling in white mode and high-contrast mode
	TODO sanitize text input (server side)
	TODO add a gif in the README for this feature
*/

export class DependsDotView {
  private readonly provider: DependsDotViewProvider

  constructor (bitbakeProjectScanner: BitBakeProjectScanner, extensionUri: vscode.Uri) {
    this.provider = new DependsDotViewProvider(bitbakeProjectScanner, extensionUri)
  }

  registerView (context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(
        DependsDotViewProvider.viewType,
        this.provider))
  }
}

class DependsDotViewProvider implements vscode.WebviewViewProvider {
    private readonly bitbakeDriver: BitbakeDriver
	private readonly bitbakeProjectScanner: BitBakeProjectScanner
    public static readonly viewType = "bitbake.oeDependsDot"
    private view?: vscode.WebviewView;
    private extensionUri: vscode.Uri

	private depType: string = "-w";
	private graphRecipe: string = "";
	private packageName: string = "";

    constructor (bitbakeProjectScanner: BitBakeProjectScanner, extensionUri: vscode.Uri) {
        this.bitbakeDriver = bitbakeProjectScanner.bitbakeDriver
        this.bitbakeProjectScanner = bitbakeProjectScanner
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

		webviewView.webview.onDidReceiveMessage(this.onWebviewMessage.bind(this));
    }

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private onWebviewMessage(data: any) : any {
		switch (data.type) {
			case 'depType':
				this.depType = data.value === "depends" ? "-d" : "-w";
				break;
			case 'graphRecipe':
				this.graphRecipe = data.value;
				break;
			case 'packageName':
				this.packageName = data.value;
				break;
			case 'genDotFile':
				this.genDotFile();
				break;
			case 'runOeDepends':
				this.runOeDepends();
				break;
			case 'openRecipe':
				this.openRecipe(data.value);
				break;
		}
	}

    private getHtmlForWebview(webview: vscode.Webview): Promise<string> {
		const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.html'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.js'));
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'client', 'web', 'depends-dot', 'main.css'));

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

	/// The Nonce is a random value used to validate the CSP policy
    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

	private async genDotFile() : Promise<void> {
		if(this.graphRecipe === "") {
			logger.error("genDotFile: No image recipe selected");
			void vscode.window.showErrorMessage(`Please select an image recipe first`);
			return;
		}
		logger.info(`genDotFile: ${this.graphRecipe}`)
		// isTaskexpStarted = true
		// TODO add blocker for runOeDependsDOt to wait for completion.
		// TODO do not bring to foreground
		const process = await runBitbakeTerminal(this.bitbakeDriver,
		  {
			specialCommand: `bitbake -g ${this.graphRecipe}`,
		  } as BitbakeTaskDefinition,
		  `Bitbake: genDotFile: ${this.graphRecipe}`,)
		process.onExit((e) => {
		  // isTaskexpStarted = false
		  if (e.exitCode !== 0) {
			void vscode.window.showErrorMessage(`Failed to generate dependency graph with exit code ${e.exitCode}. See terminal output.`)
		  }
		})
	}

	private async runOeDepends() : Promise<void> {
		if(this.packageName === "") {
			logger.error("genDotFile: No package selected");
			void vscode.window.showErrorMessage(`Please select a package first`);
			return;
		}
		logger.info(`runOeDepends: ${this.packageName}`);
		// TODO do not bring to foreground
		const process = runBitbakeTerminal(this.bitbakeDriver,
		  {
			specialCommand: `oe-depends-dot -k ${this.packageName} ${this.depType} ./task-depends.dot`,
		  } as BitbakeTaskDefinition,
		  `Bitbake: oeDependsDot: ${this.packageName}`,)
		const result = await finishProcessExecution(process)
		if (result.status !== 0) {
		void vscode.window.showErrorMessage(`Failed to run oe-depends-dot with exit code ${result.status}. See terminal output.`)
		}
		const filtered_output = this.filterOeDependsOutput(result.stdout.toString());
		this.view?.webview.postMessage({ type: 'results', value: filtered_output, depType: this.depType });
	}

	/// Remove all lines of output that do not contain the actual results
	private filterOeDependsOutput(output: string): string {
		let filtered_output = ''
		if(this.depType === "-d") {
			filtered_output = output
				.split('\n')
				.filter(line => line.includes('Depends: '))
				.map(line => line.replace('Depends: ', ''))
				.join('\n');
		} else {
			filtered_output = output
				.split('\n')
				.filter(line => line.includes(' -> '))
				.join('\n');
		}
		return filtered_output;
	}

	private openRecipe(recipeName: string) {
		recipeName = recipeName.replace(/\r/g, '');
		let recipeFound = false;
		this.bitbakeProjectScanner.scanResult._recipes.forEach((recipe: ElementInfo) => {
			// TODO fix resolving -native recipes (put that logic in a utility function) (could be shared with BitbakeRecipesView.getChildren)
			// TODO fix resolving some packages like xz or busybox (only when in the bottom row?)
			if (recipe.name === recipeName) {
			    if (recipe.path !== undefined) {
					vscode.window.showTextDocument(vscode.Uri.file(path.format(recipe.path)));
					recipeFound = true;
				}
			}
		})
		if (!recipeFound) {
			vscode.window.showErrorMessage(`Project scan was not able to resolve ${recipeName}`);
		}
	}
}
