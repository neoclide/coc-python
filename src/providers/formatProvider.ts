// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, ExtensionContext, Uri, workspace } from 'coc.nvim'
import { setTimeout } from 'timers'
import { CancellationToken } from 'vscode-jsonrpc'
import { FormattingOptions, Range, TextDocument, TextEdit } from 'vscode-languageserver-types'
import { ICommandManager, IDocumentManager } from '../common/application/types'
import { IConfigurationService } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { AutoPep8Formatter } from './../formatters/autoPep8Formatter'
import { BaseFormatter } from './../formatters/baseFormatter'
import { BlackFormatter } from './../formatters/blackFormatter'
import { DummyFormatter } from './../formatters/dummyFormatter'
import { YapfFormatter } from './../formatters/yapfFormatter'

export class PythonFormattingEditProvider implements DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, Disposable {
  private readonly config: IConfigurationService
  private readonly documentManager: IDocumentManager
  private readonly commands: ICommandManager
  private formatters = new Map<string, BaseFormatter>()
  private disposables: Disposable[] = []

  // Workaround for https://github.com/Microsoft/vscode/issues/41194
  private documentVersionBeforeFormatting = -1
  private formatterMadeChanges = false
  private saving = false

  public constructor(_context: ExtensionContext, serviceContainer: IServiceContainer) {
    const yapfFormatter = new YapfFormatter(serviceContainer)
    const autoPep8 = new AutoPep8Formatter(serviceContainer)
    const black = new BlackFormatter(serviceContainer)
    const dummy = new DummyFormatter(serviceContainer)
    this.formatters.set(yapfFormatter.Id, yapfFormatter)
    this.formatters.set(black.Id, black)
    this.formatters.set(autoPep8.Id, autoPep8)
    this.formatters.set(dummy.Id, dummy)

    this.commands = serviceContainer.get<ICommandManager>(ICommandManager)
    this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager)
    this.config = serviceContainer.get<IConfigurationService>(IConfigurationService)
    this.disposables.push(this.documentManager.onDidSaveTextDocument(async document => this.onSaveDocument(document)))
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose())
  }

  public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {
    return this.provideDocumentRangeFormattingEdits(document, undefined, options, token)
  }

  public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range | undefined, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {
    // Workaround for https://github.com/Microsoft/vscode/issues/41194
    // VSC rejects 'format on save' promise in 750 ms. Python formatting may take quite a bit longer.
    // Workaround is to resolve promise to nothing here, then execute format document and force new save.
    // However, we need to know if this is 'format document' or formatting on save.

    if (this.saving) {
      // We are saving after formatting (see onSaveDocument below)
      // so we do not want to format again.
      return []
    }

    // Remember content before formatting so we can detect if
    // formatting edits have been really applied
    const editorConfig = workspace.getConfiguration('coc.preferences', document.uri)
    if (editorConfig.get<string[]>('formatOnSaveFiletypes', []).indexOf('python') !== -1) {
      this.documentVersionBeforeFormatting = document.version
    }

    const settings = this.config.getSettings(Uri.parse(document.uri))
    const formatter = this.formatters.get(settings.formatting.provider)!
    const edits = await Promise.resolve(formatter.formatDocument(document, options, token, range))

    this.formatterMadeChanges = edits.length > 0
    return edits
  }

  private async onSaveDocument(document: TextDocument): Promise<void> {
    let doc = workspace.getDocument(document.uri)
    if (!doc) return
    // Promise was rejected = formatting took too long.
    // Don't format inside the event handler, do it on timeout
    setTimeout(() => {
      try {
        if (this.formatterMadeChanges
          && !doc.dirty
          && document.version === this.documentVersionBeforeFormatting) {
          // Formatter changes were not actually applied due to the timeout on save.
          // Force formatting now and then save the document.
          this.commands.executeCommand('editor.action.format')
        }
      } finally {
        this.documentVersionBeforeFormatting = -1
        this.saving = false
        this.formatterMadeChanges = false
      }
    }, 50)
  }
}
