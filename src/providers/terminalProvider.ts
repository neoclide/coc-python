// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Uri, workspace } from 'coc.nvim'
import { ICommandManager } from '../common/application/types'
import { Commands } from '../common/constants'
import { ITerminalServiceFactory } from '../common/terminal/types'
import { IServiceContainer } from '../ioc/types'

export class TerminalProvider implements Disposable {
  private disposables: Disposable[] = []
  constructor(private serviceContainer: IServiceContainer) {
    this.registerCommands()
  }
  public dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
  }
  private registerCommands() {
    const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager)
    const disposable = commandManager.registerCommand(Commands.Create_Terminal, this.onCreateTerminal, this)

    this.disposables.push(disposable)
  }
  private async onCreateTerminal() {
    const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory)
    const activeResource = this.getActiveResource()
    await terminalService.createTerminalService(activeResource, 'Python').show(false)
  }

  private getActiveResource(): Uri | undefined {
    let doc = workspace.getDocument(workspace.bufnr)
    if (doc && doc.filetype == 'python') return Uri.parse(doc.uri)
    return Uri.file(workspace.rootPath)
  }
}
