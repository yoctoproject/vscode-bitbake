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
    ElementInfo,
    LayerInfo,
    PathInfo
} from "./ElementInfo";

import {
	BitBakeProjectScanner
} from "./BitBakeProjectScanner";

import {
	BasicKeywordMap
} from './BasicKeywordMap';

import {
	ContextHandler
} from "./ContextHandler";

import {
	SymbolScanner
} from "./SymbolScanner";


var logger = require('winston');
const path = require('path');

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let documentMap: Map < string, string[] > = new Map();
let bitBakeProjectScanner: BitBakeProjectScanner = new BitBakeProjectScanner(connection);
let contextHandler: ContextHandler = new ContextHandler(bitBakeProjectScanner);
let workspaceRoot: string;
let symbolScanner: SymbolScanner = null;

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
interface Settings {
	languageServerBitbake: LanguageServerBitbakeSettings;
}

interface LanguageServerBitbakeSettings {
	loggingLevel: string;
	deepExamine: boolean;
}

function setSymbolScanner( newSymbolScanner: SymbolScanner ) {
	symbolScanner = newSymbolScanner;
	contextHandler.symbolScanner = symbolScanner;
}


connection.onDidChangeConfiguration((change) => {
	let settings = < Settings > change.settings;
	bitBakeProjectScanner.deepExamine = settings.languageServerBitbake.deepExamine;
	logger.level = settings.languageServerBitbake.loggingLevel;
});

connection.onDidChangeWatchedFiles((change) => {
	logger.debug('onDidChangeWatchedFiles');
	bitBakeProjectScanner.rescanProject();
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	logger.debug('onCompletion');
	let documentAsStringArray: string[] = documentMap.get(textDocumentPosition.textDocument.uri);
	return contextHandler.getComletionItems(textDocumentPosition, documentAsStringArray);
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	logger.debug(`onCompletionResolve ${JSON.stringify(item)}`);

	item.insertText = contextHandler.getInsertStringForTheElement(item);

	return item;
});

connection.onDidOpenTextDocument((params) => {
	if (params.textDocument.text.length > 0) {
		documentMap.set(params.textDocument.uri, params.textDocument.text.split(/\r?\n/g));
	}

	setSymbolScanner( new SymbolScanner(params.textDocument.uri, contextHandler.definitionProvider) );
});

connection.onDidChangeTextDocument((params) => {
	if (params.contentChanges.length > 0) {
		documentMap.set(params.textDocument.uri, params.contentChanges[0].text.split(/\r?\n/g));
	}
	
	setSymbolScanner( new SymbolScanner(params.textDocument.uri, contextHandler.definitionProvider) );
});

connection.onDidCloseTextDocument((params) => {
	documentMap.delete(params.textDocument.uri);
	setSymbolScanner( null );
});

connection.onExecuteCommand((params) => {
	logger.info(`executeCommand ${JSON.stringify(params)}`);

	if (params.command === 'bitbake.rescan-project') {
		bitBakeProjectScanner.rescanProject();
	}
});

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Definition => {
	logger.debug(`onDefinition ${JSON.stringify(textDocumentPositionParams)}`);
	let documentAsText: string[] = documentMap.get(textDocumentPositionParams.textDocument.uri);

	let definition: Definition = contextHandler.getDefinition(textDocumentPositionParams, documentAsText);;

	logger.debug(`definition ${JSON.stringify(definition)}`);

	return definition;
});



// Listen on the connection
connection.listen();