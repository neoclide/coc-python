// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify'
import { Terminal, TerminalOptions, workspace } from 'coc.nvim'
import { Event } from 'vscode-languageserver-protocol'
import { ITerminalManager } from './types'

@injectable()
export class TerminalManager implements ITerminalManager {
  public get onDidCloseTerminal(): Event<Terminal> {
    return workspace.onDidCloseTerminal
  }
  public get onDidOpenTerminal(): Event<Terminal> {
    return workspace.onDidOpenTerminal
  }
  public createTerminal(options: TerminalOptions): Promise<Terminal> {
    return workspace.createTerminal(options)
  }
}
