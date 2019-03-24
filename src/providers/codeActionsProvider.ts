// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { ProviderResult, CodeActionProvider } from 'coc.nvim'
import { TextDocument, Range, CodeActionContext, CancellationToken, CodeAction, CodeActionKind } from 'vscode-languageserver-protocol'

export class PythonCodeActionProvider implements CodeActionProvider {
  public provideCodeActions(_document: TextDocument, _range: Range, _context: CodeActionContext, _token: CancellationToken): ProviderResult<CodeAction[]> {
    const sortImports = CodeAction.create('Sort imports', {
      title: 'Sort imports',
      command: 'python.sortImports'
    }, CodeActionKind.SourceOrganizeImports)

    return [sortImports]
  }
}
