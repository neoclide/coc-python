// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable } from 'inversify'
import { ConfigurationTarget, workspace } from 'coc.nvim'
import { IApplicationShell, ICommandManager } from '../../common/application/types'
import { Commands } from '../../common/constants'
import { IConfigurationService, IDisposableRegistry } from '../../common/types'
import { Diagnostics } from '../../common/utils/localize'
import { ISourceMapSupportService } from './types'

@injectable()
export class SourceMapSupportService implements ISourceMapSupportService {
  constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager,
    @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
    @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    @inject(IApplicationShell) private readonly shell: IApplicationShell) {

  }
  public register(): void {
    this.disposables.push(this.commandManager.registerCommand(Commands.Enable_SourceMap_Support, this.onEnable, this))
  }
  public async enable(): Promise<void> {
    await this.configurationService.updateSetting('diagnostics.sourceMapsEnabled', true, undefined, ConfigurationTarget.Global)
    workspace.nvim.command('CocRestart', true)
  }
  protected async onEnable(): Promise<void> {
    const enableSourceMapsAndReloadVSC = Diagnostics.enableSourceMapsAndReloadVSC()
    workspace.showMessage(Diagnostics.warnBeforeEnablingSourceMaps(), 'warning')
    let res = await workspace.showPrompt(enableSourceMapsAndReloadVSC)
    if (res) {
      await this.enable()
    }
  }
}
