// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'

import { DiagnosticCollection, Disposable, Uri, workspace } from 'coc.nvim'
import { ICommandManager } from '../common/application/types'
import { Commands } from '../common/constants'
import { IDisposable } from '../common/types'
import { Linters } from '../common/utils/localize'
import { IServiceContainer } from '../ioc/types'
import { ILinterManager, ILintingEngine } from './types'
import { format } from '../common/string'

export class LinterCommands implements IDisposable {
  private disposables: Disposable[] = []
  private linterManager: ILinterManager

  constructor(private serviceContainer: IServiceContainer) {
    this.linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager)

    const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager)
    commandManager.registerCommand(Commands.Set_Linter, this.setLinterAsync.bind(this))
    commandManager.registerCommand(Commands.Enable_Linter, this.enableLintingAsync.bind(this))
    commandManager.registerCommand(Commands.Run_Linter, this.runLinting.bind(this))
  }
  public dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
  }

  public async setLinterAsync(): Promise<void> {
    const linters = this.linterManager.getAllLinterInfos()
    const suggestions = linters.map(x => x.id).sort()
    const linterList = ['Disable Linting', ...suggestions]
    const activeLinters = await this.linterManager.getActiveLinters(true, this.settingsUri)

    let current: string
    switch (activeLinters.length) {
      case 0:
        current = 'none'
        break
      case 1:
        current = activeLinters[0].id
        break
      default:
        current = 'multiple selected'
        break
    }

    const placeHolder = `current: ${current}`

    const idx = await workspace.showQuickpick(linterList, placeHolder)
    if (idx !== -1) {
      const selection = linterList[idx]
      if (selection === 'Disable Linting') {
        await this.linterManager.enableLintingAsync(false)
        // sendTelemetryEvent(EventName.SELECT_LINTER, undefined, { enabled: false })
      } else {
        const index = linters.findIndex(x => x.id === selection)
        if (activeLinters.length > 1) {
          const response = await workspace.showPrompt(format(Linters.replaceWithSelectedLinter(), selection))
          if (!response) return
        }
        await this.linterManager.setActiveLintersAsync([linters[index].product], this.settingsUri)
      }
    }
  }

  public async enableLintingAsync(): Promise<void> {
    const options = ['on', 'off']
    const current = await this.linterManager.isLintingEnabled(true, this.settingsUri) ? options[0] : options[1]

    const idx = await workspace.showQuickpick(options, `current: ${current}`)
    if (idx != -1) {
      const enable = idx == 0
      await this.linterManager.enableLintingAsync(enable, this.settingsUri)
    }
  }

  public runLinting(): Promise<DiagnosticCollection> {
    const engine = this.serviceContainer.get<ILintingEngine>(ILintingEngine)
    return engine.lintOpenPythonFiles()
  }

  private get settingsUri(): Uri | undefined {
    let doc = workspace.getDocument(workspace.bufnr)
    return doc ? Uri.parse(doc.uri) : undefined
  }
}
