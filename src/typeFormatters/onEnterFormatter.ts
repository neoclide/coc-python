// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, FormattingOptions, Range, Position, TextDocument, TextEdit } from 'vscode-languageserver-protocol'
import { OnTypeFormattingEditProvider, workspace } from 'coc.nvim'
import { LineFormatter } from '../formatters/lineFormatter'
import { TokenizerMode, TokenType } from '../language/types'
import { getDocumentTokens } from '../providers/providerUtilities'

export class OnEnterFormatter implements OnTypeFormattingEditProvider {
  private readonly formatter = new LineFormatter()

  public provideOnTypeFormattingEdits(
    document: TextDocument,
    position: Position,
    _ch: string,
    _options: FormattingOptions,
    _cancellationToken: CancellationToken): TextEdit[] {
    if (position.line === 0) {
      return []
    }
    let doc = workspace.getDocument(document.uri)
    // Check case when the entire line belongs to a comment or string
    const prevLine = doc.getline(position.line - 1)
    const range: Range = Range.create(position.line - 1, 0, position.line - 1, prevLine.length)
    const tokens = getDocumentTokens(document, position, TokenizerMode.CommentsAndStrings)
    const lineStartTokenIndex = tokens.getItemContaining(document.offsetAt(range.start))
    const lineEndTokenIndex = tokens.getItemContaining(document.offsetAt(range.end))
    if (lineStartTokenIndex >= 0 && lineStartTokenIndex === lineEndTokenIndex) {
      const token = tokens.getItemAt(lineStartTokenIndex)
      if (token.type === TokenType.Semicolon || token.type === TokenType.String) {
        return []
      }
    }
    const formatted = this.formatter.formatLine(document, position.line - 1)
    if (formatted === prevLine) {
      return []
    }
    return [TextEdit.replace(range, formatted)]
  }
}
