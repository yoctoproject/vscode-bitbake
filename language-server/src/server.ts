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
	Range
} from 'vscode-languageserver';


import {
	BitBakeProjectScanner
} from "./BitBakeProjectScanner";

import { ContextHandler } from "./ContextHandler";
import {
    BasicKeywordMap
} from './BasicKeywordMap';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let documentAsText: String[];
let bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner();
let contextHandler: ContextHandler = new ContextHandler( bitBakeProjectScanner );

documents.listen(connection);



// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	connection.console.log(`onInitialize ${workspaceRoot}`);
	workspaceRoot = params.rootPath;
	bitBakeProjectScanner.setprojectPath(workspaceRoot);
	bitBakeProjectScanner.rescanProject();

	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true
			},
			definitionProvider: true,
		}
	}
});


// The settings interface describe the server relevant settings part
interface Settings {}

interface LanguageServerBitbakeSettings {}


connection.onDidChangeWatchedFiles((change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	connection.console.log(`onCompletion ${JSON.stringify(textDocumentPosition)}`);

	return contextHandler.getComletionItems(textDocumentPosition, documentAsText);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	connection.console.log(`onCompletionResolve ${JSON.stringify(item)}`);

	item.insertText = contextHandler.getInsertStringForTheElement(item);

	return item;
});

let t: Thenable < string > ;

connection.onDidOpenTextDocument((params) => {
	connection.console.log(`${JSON.stringify(params)} opened.`);
	if (params.textDocument.text.length > 0) {
		documentAsText = params.textDocument.text.split(/\r?\n/g);
	}
});

connection.onDidChangeTextDocument((params) => {
	connection.console.log(`${params.textDocument.uri} changed`);
	if (params.contentChanges.length > 0) {
		documentAsText = params.contentChanges[0].text.split(/\r?\n/g);
	}
});


// connection.onDefinition( (textDocumentPositionParams: TextDocumentPositionParams): Definition => {
// 	connection.console.log(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`);

// 	return Location.create("", Range.create(0,1));
// });



// Listen on the connection
connection.listen();