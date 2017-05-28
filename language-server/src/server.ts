/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	IPCMessageReader,
	IPCMessageWriter,
	createConnection,
	IConnection,
	TextDocumentSyncKind,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	InitializeParams,
	InitializeResult,
	TextDocumentPositionParams,
	CompletionItem,
	CompletionItemKind,
	SignatureHelpOptions,
	RequestHandler,
	SignatureHelp,
	SignatureInformation,
	Definition,
	Location,
	Range,
	FileEvent
} from 'vscode-languageserver';


import {
	BitBakeProjectScanner,
	PathInfo
} from "./BitBakeProjectScanner";

import {
	BasicKeywordMap
} from './BasicKeywordMap';

import {
	ContextHandler
} from "./ContextHandler";

const path = require('path');

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let documentMap: Map < string, string[] > = new Map();
let bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner();
let contextHandler: ContextHandler = new ContextHandler(bitBakeProjectScanner);
let workspaceRoot: string;

documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	bitBakeProjectScanner.setprojectPath(workspaceRoot);
	bitBakeProjectScanner.rescanProject();

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			completionProvider: {
				resolveProvider: true
			},
			definitionProvider: true,
			executeCommandProvider: {
				commands: [
					'bitbake.rescan-project'
				]
			}
		}
	}
});


// The settings interface describe the server relevant settings part
interface Settings {}
interface LanguageServerBitbakeSettings {}

connection.onDidChangeWatchedFiles((change) => {
	connection.console.log('onDidChangeWatchedFiles');
	bitBakeProjectScanner.rescanProject();
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	connection.console.log('onCompletion');
	let documentAsStringArray: string[] = documentMap.get(textDocumentPosition.textDocument.uri);
	return contextHandler.getComletionItems(textDocumentPosition, documentAsStringArray);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	connection.console.log(`onCompletionResolve ${JSON.stringify(item)}`);

	item.insertText = contextHandler.getInsertStringForTheElement(item);

	return item;
});

connection.onDidOpenTextDocument((params) => {
	if (params.textDocument.text.length > 0) {
		documentMap.set(params.textDocument.uri, params.textDocument.text.split(/\r?\n/g));
	}
});

connection.onDidChangeTextDocument((params) => {
	if (params.contentChanges.length > 0) {
		documentMap.set(params.textDocument.uri, params.contentChanges[0].text.split(/\r?\n/g));
	}
});

connection.onDidCloseTextDocument((params) => {
	documentMap.delete(params.textDocument.uri);
});

connection.onExecuteCommand((params) => {
	connection.console.log(`onExecuteCommand ${JSON.stringify(params)}`);

	if (params.command === 'bitbake.rescan-project') {
		bitBakeProjectScanner.rescanProject();
	}
});

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Definition => {
	connection.console.log(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`);
	let documentAsText = documentMap.get(textDocumentPositionParams.textDocument.uri);

	return contextHandler.getDefinition(textDocumentPositionParams, documentAsText);;
});



// Listen on the connection
connection.listen();