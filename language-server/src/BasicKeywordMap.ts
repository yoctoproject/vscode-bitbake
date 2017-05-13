/* --------------------------------------------------------------------------------------------
 * Copyright (c) Eugen Wiens. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
    CompletionItemKind,
    CompletionItem
} from 'vscode-languageserver';

export let BasicKeywordMap: CompletionItem[] = [{
        label: 'require',
        kind: CompletionItemKind.Keyword,
    },
    {
        label: 'export',
        kind: CompletionItemKind.Keyword,
    },
    {
        label: 'inherit',
        kind: CompletionItemKind.Keyword,
    },
    {
        label: 'include',
        kind: CompletionItemKind.Keyword,
    }
];