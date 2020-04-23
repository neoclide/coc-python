// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'

// tslint:disable:no-var-requires no-any unified-signatures

import { injectable } from 'inversify'
import { Disposable } from 'vscode-languageserver-protocol'
import { workspace, StatusBarItem } from 'coc.nvim'
import { IApplicationShell } from './types'

@injectable()
export class ApplicationShell implements IApplicationShell {
  private statusItem: StatusBarItem
  constructor() {
    this.statusItem = workspace.createStatusBarItem(99)
  }

  public openUrl(url: string): void {
    workspace.openResource(url)
  }

  public setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable
  public setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable
  public setStatusBarMessage(text: string): Disposable
  public setStatusBarMessage(text: string, arg?: any): Disposable {
    this.statusItem.text = text
    if (text) {
      this.statusItem.show()
      if (typeof arg == 'number') {
        setTimeout(() => {
          this.statusItem.hide()
        }, arg)
      }
      if (arg && typeof arg.then == 'function') {
        arg.then(() => {
          this.statusItem.hide()
        }, () => {
          this.statusItem.hide()
        })
      }
    }
    return Disposable.create(() => {
      this.statusItem.hide()
    })
  }

  public createStatusBarItem(priority?: number): StatusBarItem {
    return workspace.createStatusBarItem(priority)
  }
}
