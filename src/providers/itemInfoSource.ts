// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'

import { Uri, workspace } from 'coc.nvim'
import { EOL } from 'os'
import { CancellationToken, MarkupContent, Position, Range, SymbolKind, TextDocument } from 'vscode-languageserver-protocol'
import { RestTextConverter } from '../common/markdown/restTextConverter'
import { JediFactory } from '../languageServices/jediProxyFactory'
import * as proxy from './jediProxy'

export class LanguageItemInfo {
  constructor(
    public tooltip: MarkupContent,
    public detail: string,
    public signature: string) { }
}

export interface IItemInfoSource {
  getItemInfoFromText(documentUri: Uri, fileName: string,
    range: Range, sourceText: string,
    token: CancellationToken): Promise<LanguageItemInfo[] | undefined>
  getItemInfoFromDocument(document: TextDocument, position: Position,
    token: CancellationToken): Promise<LanguageItemInfo[] | undefined>
}

export class ItemInfoSource implements IItemInfoSource {
  private textConverter = new RestTextConverter()
  constructor(private jediFactory: JediFactory) { }

  public async getItemInfoFromText(documentUri: Uri, fileName: string, range: Range, sourceText: string, token: CancellationToken)
    : Promise<LanguageItemInfo[] | undefined> {
    const result = await this.getHoverResultFromTextRange(documentUri, fileName, range, sourceText, token)
    if (!result || !result.items.length) {
      return
    }
    return this.getItemInfoFromHoverResult(result, '')
  }

  public async getItemInfoFromDocument(document: TextDocument, position: Position, token: CancellationToken)
    : Promise<LanguageItemInfo[] | undefined> {
    const doc = workspace.getDocument(document.uri)
    const range = doc.getWordRangeAtPosition(position)
    if (!range || (range.start.line == range.end.line && range.start.character == range.end.character)) {
      return
    }
    const result = await this.getHoverResultFromDocument(document, position, token)
    if (!result || !result.items.length) {
      return
    }
    const word = document.getText(range)
    return this.getItemInfoFromHoverResult(result, word)
  }

  private async getHoverResultFromDocument(document: TextDocument, position: Position, token: CancellationToken)
    : Promise<proxy.IHoverResult | undefined> {
    const doc = workspace.getDocument(document.uri)
    if (doc.getline(position.line).match(/^\s*\/\//)) {
      return
    }
    const range = doc.getWordRangeAtPosition(position)
    if (!range || (range.start.line == range.end.line && range.start.character == range.end.character)) {
      return
    }
    return this.getHoverResultFromDocumentRange(document, range, token)
  }

  private async getHoverResultFromDocumentRange(document: TextDocument, range: Range, token: CancellationToken)
    : Promise<proxy.IHoverResult | undefined> {
    const doc = workspace.getDocument(document.uri)
    const cmd: proxy.ICommand = {
      command: proxy.CommandType.Hover,
      fileName: Uri.parse(document.uri).fsPath,
      columnIndex: range.end.character,
      lineIndex: range.end.line
    }
    if (doc.dirty) {
      cmd.source = document.getText()
    }
    return this.jediFactory.getJediProxyHandler<proxy.IHoverResult>(Uri.parse(document.uri)).sendCommand(cmd, token)
  }

  private async getHoverResultFromTextRange(documentUri: Uri, fileName: string, range: Range, sourceText: string, token: CancellationToken)
    : Promise<proxy.IHoverResult | undefined> {
    const cmd: proxy.ICommand = {
      command: proxy.CommandType.Hover,
      fileName,
      columnIndex: range.end.character,
      lineIndex: range.end.line,
      source: sourceText
    }
    return this.jediFactory.getJediProxyHandler<proxy.IHoverResult>(documentUri).sendCommand(cmd, token)
  }

  private getItemInfoFromHoverResult(data: proxy.IHoverResult, currentWord: string): LanguageItemInfo[] {
    const infos: LanguageItemInfo[] = []

    data.items.forEach(item => {
      const signature = this.getSignature(item, currentWord)
      let tooltip: MarkupContent = { kind: 'markdown', value: '' }
      if (item.docstring) {
        let lines = item.docstring.split(/\r?\n/)

        // If the docstring starts with the signature, then remove those lines from the docstring.
        if (lines.length > 0 && item.signature.indexOf(lines[0]) === 0) {
          lines.shift()
          const endIndex = lines.findIndex(line => item.signature.endsWith(line))
          if (endIndex >= 0) {
            lines = lines.filter((_line, index) => index > endIndex)
          }
        }
        if (lines.length > 0 && currentWord.length > 0 && item.signature.startsWith(currentWord) && lines[0].startsWith(currentWord) && lines[0].endsWith(')')) {
          lines.shift()
        }

        if (signature.length > 0) {
          tooltip.value = tooltip.value + '\n' + (['```python', signature, '```', ''].join(EOL))
        }

        const description = this.textConverter.toMarkdown(lines.join(EOL))
        const invalid = description.indexOf('\n') == -1 && description.startsWith('\\')
        if (!invalid) tooltip.value = tooltip.value + description

        infos.push(new LanguageItemInfo(tooltip, item.description, signature))
        return
      }

      if (item.description) {
        if (signature.length > 0) {
          tooltip.value = tooltip.value + '\n' + (['```python', signature, '```', ''].join(EOL))
        }
        const description = this.textConverter.toMarkdown(item.description)
        tooltip.value = tooltip.value + '\n' + description
        infos.push(new LanguageItemInfo(tooltip, item.description, signature))
        return
      }

      if (item.text) { // Most probably variable type
        const code = currentWord && currentWord.length > 0
          ? `${currentWord}: ${item.text}`
          : item.text
        tooltip.value = tooltip.value + '\n' + (['```python', code, '```', ''].join(EOL))
        infos.push(new LanguageItemInfo(tooltip, '', ''))
      }
    })
    return infos
  }

  private getSignature(item: proxy.IHoverItem, currentWord: string): string {
    let { signature } = item
    switch (item.kind) {
      case SymbolKind.Constructor:
      case SymbolKind.Function:
      case SymbolKind.Method: {
        signature = `def ${signature}`
        break
      }
      case SymbolKind.Class: {
        signature = `class ${signature}`
        break
      }
      case SymbolKind.Module: {
        if (signature.length > 0) {
          signature = `module ${signature}`
        }
        break
      }
      default: {
        signature = typeof item.text === 'string' && item.text.length > 0 ? item.text : currentWord
      }
    }
    return signature
  }
}
