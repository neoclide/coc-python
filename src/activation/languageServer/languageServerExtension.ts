// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable } from 'inversify'
import { Event, Emitter } from 'vscode-languageserver-protocol'
import { ICommandManager } from '../../common/application/types'
import { IDisposable } from '../../common/types'
import { ILanguageServerExtension } from '../types'
import { commands, disposeAll } from 'coc.nvim'

const loadExtensionCommand = 'python._loadLanguageServerExtension'

@injectable()
export class LanguageServerExtension implements ILanguageServerExtension {
  public loadExtensionArgs?: {}
  protected readonly _invoked = new Emitter<void>()
  private disposables?: IDisposable[] = []
  constructor(
    @inject(ICommandManager) private readonly commandManager: ICommandManager
  ) { }
  public dispose(): void {
    disposeAll(this.disposables)
  }
  public async register(): Promise<void> {
    if (this.disposables.length) {
      return
    }
    this.disposables.push(commands.registerCommand(loadExtensionCommand, args => {
      this.loadExtensionArgs = args
      this._invoked.fire()
    }, null, true))

  }
  public get invoked(): Event<void> {
    return this._invoked.event
  }
}
