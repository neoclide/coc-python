// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { Disposable, StatusBarItem, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { IApplicationShell } from '../../common/application/types'
import { traceDecorators } from '../../common/logger'
import { IDisposableRegistry } from '../../common/types'
import { IInterpreterLocatorProgressService, InterpreterLocatorProgressHandler } from '../contracts'

@injectable()
export class InterpreterLocatorProgressStatubarHandler implements InterpreterLocatorProgressHandler {
  private item: StatusBarItem
  constructor(@inject(IApplicationShell) private readonly shell: IApplicationShell,
    @inject(IInterpreterLocatorProgressService) private readonly progressService: IInterpreterLocatorProgressService,
    @inject(IDisposableRegistry) private readonly disposables: Disposable[]) { }
  public register() {
    this.progressService.onRefreshing(() => this.showProgress(), this, this.disposables)
    this.progressService.onRefreshed(() => this.hideProgress(), this, this.disposables)
    this.item = workspace.createStatusBarItem(99, { progress: true })
    this.item.text = 'Searching interpreter...'
  }
  @traceDecorators.verbose('Display locator refreshing progress')
  private showProgress(): void {
    this.item.show()
  }
  @traceDecorators.verbose('Hide locator refreshing progress')
  private hideProgress(): void {
    this.item.hide()
  }
}
