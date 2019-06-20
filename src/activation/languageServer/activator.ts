// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable } from 'inversify'
import * as path from 'path'
import { IWorkspaceService } from '../../common/application/types'
import { traceDecorators } from '../../common/logger'
import { IFileSystem } from '../../common/platform/types'
import { Commands } from '../../common/constants'
import { Uri, commands } from 'coc.nvim'
import { IConfigurationService, Resource, IExtensionContext, IDisposable } from '../../common/types'
import {
  ILanguageServerActivator,
  ILanguageServerDownloader,
  ILanguageServerFolderService,
  ILanguageServerManager
} from '../types'

const languageServerFolder = 'languageServer'
/**
 * Starts the language server managers per workspaces (currently one for first workspace).
 *
 * @export
 * @class LanguageServerExtensionActivator
 * @implements {ILanguageServerActivator}
 */
@injectable()
export class LanguageServerExtensionActivator implements ILanguageServerActivator {
  private disposable: IDisposable
  constructor(
    @inject(ILanguageServerManager) private readonly manager: ILanguageServerManager,
    @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
    @inject(IFileSystem) private readonly fs: IFileSystem,
    @inject(ILanguageServerDownloader) private readonly lsDownloader: ILanguageServerDownloader,
    @inject(ILanguageServerFolderService)
    private readonly languageServerFolderService: ILanguageServerFolderService,
    @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    @inject(IExtensionContext) private readonly context: IExtensionContext
  ) {
    this.disposable = commands.registerCommand(Commands.Upgrade_Languageserver, () => {
      return this.downloadLatestLanguageServer()
    })
  }
  @traceDecorators.error('Failed to activate language server')
  public async activate(resource: Resource): Promise<void> {
    if (!resource) {
      resource = Uri.file(this.workspace.rootPath)
    }
    await this.ensureLanguageServerIsAvailable(resource)
    await this.manager.start(resource)
  }
  public dispose(): void {
    this.manager.dispose()
    if (this.disposable) {
      this.disposable.dispose()
    }
  }
  @traceDecorators.error('Failed to ensure language server is available')
  protected async ensureLanguageServerIsAvailable(resource: Resource) {
    const settings = this.configurationService.getSettings(resource)
    if (!settings.downloadLanguageServer) {
      return
    }
    const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName()
    const languageServerFolderPath = path.join(this.context.storagePath, languageServerFolder)
    const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll')
    if (!(await this.fs.fileExists(mscorlib))) {
      await this.lsDownloader.downloadLanguageServer(languageServerFolderPath)
    }
  }

  @traceDecorators.error('Failed to download latest language server')
  protected async downloadLatestLanguageServer(): Promise<void> {
    const latest = await this.languageServerFolderService.getLatestLanguageServerVersion()
    const languageServerFolderPath = path.join(this.context.storagePath, languageServerFolder + '.' + latest.version.raw)
    const mscorlib = path.join(languageServerFolderPath, 'mscorlib.dll')
    if (!(await this.fs.fileExists(mscorlib))) {
      await this.lsDownloader.downloadLanguageServer(languageServerFolderPath)
    }
  }
}
