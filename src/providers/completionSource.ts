// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'

import { IConfigurationService } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { JediFactory } from '../languageServices/jediProxyFactory'
import { IItemInfoSource, LanguageItemInfo } from './itemInfoSource'
import * as proxy from './jediProxy'
import { isPositionInsideStringOrComment } from './providerUtilities'
import { SymbolKind, TextDocument, Position, Range, CancellationToken, CompletionItem, InsertTextFormat } from 'vscode-languageserver-protocol'
import { workspace, Uri } from 'coc.nvim'

class DocumentPosition {
  constructor(public document: TextDocument, public position: Position) { }

  public static fromObject(item: object): DocumentPosition {
    // tslint:disable-next-line:no-any
    return (item as any)._documentPosition as DocumentPosition
  }

  public attachTo(item: object): void {
    // tslint:disable-next-line:no-any
    (item as any)._documentPosition = this
  }
}

export class CompletionSource {
  private jediFactory: JediFactory

  constructor(jediFactory: JediFactory, private serviceContainer: IServiceContainer,
    private itemInfoSource: IItemInfoSource) {
    this.jediFactory = jediFactory
  }

  public async getVsCodeCompletionItems(document: TextDocument, position: Position, token: CancellationToken)
    : Promise<CompletionItem[]> {
    const result = await this.getCompletionResult(document, position, token)
    if (result === undefined) {
      return Promise.resolve([])
    }
    return this.toVsCodeCompletions(new DocumentPosition(document, position), result, Uri.parse(document.uri))
  }

  public async getDocumentation(completionItem: CompletionItem, token: CancellationToken): Promise<LanguageItemInfo[] | undefined> {
    const documentPosition = DocumentPosition.fromObject(completionItem)
    if (documentPosition === undefined) {
      return
    }
    const doc = workspace.getDocument(workspace.bufnr)
    // Supply hover source with simulated document text where item in question was 'already typed'.
    const document = doc.textDocument
    const position = documentPosition.position
    const wordRange = doc.getWordRangeAtPosition(position)

    const leadingRange = wordRange !== undefined
      ? Range.create(Position.create(0, 0), wordRange.start)
      : Range.create(Position.create(0, 0), position)

    const itemString = completionItem.label
    const sourceText = `${document.getText(leadingRange)}${itemString}`
    const range = Range.create(leadingRange.end, { line: leadingRange.end.line, character: leadingRange.end.character + itemString.length })

    return this.itemInfoSource.getItemInfoFromText(Uri.parse(document.uri), Uri.parse(doc.uri).fsPath, range, sourceText, token)
  }

  private async getCompletionResult(document: TextDocument, position: Position, token: CancellationToken)
    : Promise<proxy.ICompletionResult | undefined> {
    if (position.character < 0 ||
      isPositionInsideStringOrComment(document, position)) {
      return undefined
    }

    const type = proxy.CommandType.Completions
    const columnIndex = position.character

    const source = document.getText()
    const cmd: proxy.ICommand = {
      command: type,
      fileName: Uri.parse(document.uri).fsPath,
      columnIndex,
      lineIndex: position.line,
      source
    }

    return this.jediFactory.getJediProxyHandler<proxy.ICompletionResult>(Uri.parse(document.uri)).sendCommand(cmd, token)
  }

  private toVsCodeCompletions(documentPosition: DocumentPosition, data: proxy.ICompletionResult, resource: Uri): CompletionItem[] {
    return data && data.items.length > 0 ? data.items.map(item => this.toVsCodeCompletion(documentPosition, item, resource)) : []
  }

  private toVsCodeCompletion(documentPosition: DocumentPosition, item: proxy.IAutoCompleteItem, resource: Uri): CompletionItem {
    const completionItem = CompletionItem.create(item.text)
    completionItem.kind = item.type
    const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService)
    const pythonSettings = configurationService.getSettings(resource)
    if (pythonSettings.autoComplete.addBrackets === true &&
      (item.kind === SymbolKind.Function || item.kind === SymbolKind.Method)) {
      // tslint:disable-next-line: deprecation
      completionItem.insertText = `${item.text}($0)`
      completionItem.insertTextFormat = InsertTextFormat.Snippet
    }
    // Ensure the built in members are at the bottom.
    completionItem.sortText = (completionItem.label.startsWith('__') ? 'z' : (completionItem.label.startsWith('_') ? 'y' : '__')) + completionItem.label
    documentPosition.attachTo(completionItem)
    return completionItem
  }
}
