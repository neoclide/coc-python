// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { CancellationToken, FoldingRange, FoldingRangeKind, Range, TextDocument, Position } from 'vscode-languageserver-protocol'
import { FoldingRangeProvider, ProviderResult, FoldingContext, workspace } from 'coc.nvim'
import { IterableTextRange } from '../language/iterableTextRange'
import { IToken, TokenizerMode, TokenType } from '../language/types'
import { getDocumentTokens } from './providerUtilities'

export class DocStringFoldingProvider implements FoldingRangeProvider {
  public provideFoldingRanges(document: TextDocument, _context: FoldingContext, _token: CancellationToken): ProviderResult<FoldingRange[]> {
    return this.getFoldingRanges(document)
  }

  private getFoldingRanges(document: TextDocument) {
    let doc = workspace.getDocument(document.uri)
    let position = Position.create(doc.lineCount - 1, doc.getline(doc.lineCount - 1).length)
    const tokenCollection = getDocumentTokens(document, position, TokenizerMode.CommentsAndStrings)
    const tokens = new IterableTextRange(tokenCollection)

    const docStringRanges: FoldingRange[] = []
    const commentRanges: FoldingRange[] = []

    for (const token of tokens) {
      const docstringRange = this.getDocStringFoldingRange(document, token)
      if (docstringRange) {
        docStringRanges.push(docstringRange)
        continue
      }

      const commentRange = this.getSingleLineCommentRange(document, token)
      if (commentRange) {
        this.buildMultiLineCommentRange(commentRange, commentRanges)
      }
    }

    this.removeLastSingleLineComment(commentRanges)
    return docStringRanges.concat(commentRanges)
  }
  private buildMultiLineCommentRange(commentRange: FoldingRange, commentRanges: FoldingRange[]) {
    if (commentRanges.length === 0) {
      commentRanges.push(commentRange)
      return
    }
    const previousComment = commentRanges[commentRanges.length - 1]
    if (previousComment.endLine + 1 === commentRange.startLine) {
      previousComment.endLine = commentRange.endLine
      return
    }
    if (previousComment.startLine === previousComment.endLine) {
      commentRanges[commentRanges.length - 1] = commentRange
      return
    }
    commentRanges.push(commentRange)
  }
  private removeLastSingleLineComment(commentRanges: FoldingRange[]) {
    // Remove last comment folding range if its a single line entry.
    if (commentRanges.length === 0) {
      return
    }
    const lastComment = commentRanges[commentRanges.length - 1]
    if (lastComment.startLine === lastComment.endLine) {
      commentRanges.pop()
    }
  }
  private getDocStringFoldingRange(document: TextDocument, token: IToken) {
    if (token.type !== TokenType.String) {
      return
    }

    const doc = workspace.getDocument(document.uri)
    const startPosition = document.positionAt(token.start)
    const endPosition = document.positionAt(token.end)
    if (startPosition.line === endPosition.line) {
      return
    }

    const startLine = doc.getline(startPosition.line)
    if (startLine.match(/^\s*/)[0].length !== startPosition.character) {
      return
    }
    const startIndex1 = startLine.indexOf('\'\'\'')
    const startIndex2 = startLine.indexOf('"""')
    if (startIndex1 !== startPosition.character && startIndex2 !== startPosition.character) {
      return
    }

    const range = Range.create(startPosition, endPosition)

    return FoldingRange.create(range.start.line, range.end.line)
  }
  private getSingleLineCommentRange(document: TextDocument, token: IToken) {
    if (token.type !== TokenType.Comment) {
      return
    }
    const doc = workspace.getDocument(document.uri)

    const startPosition = document.positionAt(token.start)
    const endPosition = document.positionAt(token.end)
    if (startPosition.line !== endPosition.line) {
      return
    }
    let idx = doc.getline(startPosition.line).match(/^\s*/)[0].length
    if (idx !== startPosition.character) {
      return
    }

    const range = Range.create(startPosition, endPosition)
    return FoldingRange.create(range.start.line, range.end.line, 0, 0, FoldingRangeKind.Comment)
  }
}
