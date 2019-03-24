// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

// import { Progress, ProgressLocation, window } from 'coc.nvim'
import { LanguageClient, workspace, StatusBarItem } from 'coc.nvim'
import { Disposable } from 'vscode-languageserver-protocol'
import { createDeferred, Deferred } from '../../common/utils/async'

export class ProgressReporting implements Disposable {
  // private progress: Progress<{ message?: string; increment?: number }> | undefined
  // private progressDeferred: Deferred<void> | undefined
  private statusItem: StatusBarItem

  constructor(private readonly languageClient: LanguageClient) {
    this.statusItem = workspace.createStatusBarItem(0, { progress: true })
    this.languageClient.onNotification('python/setStatusBarMessage', (m: string) => {
      this.statusItem.text = m
      this.statusItem.show()
    })

    this.languageClient.onNotification('python/beginProgress', _ => {
      this.statusItem.show()
    })

    this.languageClient.onNotification('python/reportProgress', (m: string) => {
      this.statusItem.text = m
      this.statusItem.show()
    })

    this.languageClient.onNotification('python/endProgress', _ => {
      this.statusItem.hide()
    })
  }

  public dispose(): void {
    this.statusItem.dispose()
  }
}
