// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { Executable, LanguageClient, LanguageClientOptions } from 'coc.nvim'
import { inject, injectable, named } from 'inversify'
import * as path from 'path'
import { IConfigurationService, IExtensionContext, Resource } from '../../common/types'
import { IEnvironmentVariablesProvider } from '../../common/variables/types'
import { IEnvironmentActivationService } from '../../interpreter/activation/types'
import { ILanguageClientFactory, ILanguageServerFolderService, IPlatformData, LanguageClientFactory } from '../types'

// tslint:disable:no-require-imports no-require-imports no-var-requires max-classes-per-file

const dotNetCommand = 'dotnet'
const languageClientName = 'Python Tools'

@injectable()
export class BaseLanguageClientFactory implements ILanguageClientFactory {
  constructor(@inject(ILanguageClientFactory) @named(LanguageClientFactory.downloaded) private readonly downloadedFactory: ILanguageClientFactory,
    @inject(ILanguageClientFactory) @named(LanguageClientFactory.simple) private readonly simpleFactory: ILanguageClientFactory,
    @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    @inject(IEnvironmentVariablesProvider) private readonly envVarsProvider: IEnvironmentVariablesProvider,
    @inject(IEnvironmentActivationService) private readonly environmentActivationService: IEnvironmentActivationService) { }
  public async createLanguageClient(resource: Resource, clientOptions: LanguageClientOptions): Promise<LanguageClient> {
    const settings = this.configurationService.getSettings(resource)
    const factory = settings.downloadLanguageServer ? this.downloadedFactory : this.simpleFactory
    const env = await this.getEnvVars(resource)
    return factory.createLanguageClient(resource, clientOptions, env)
  }

  private async getEnvVars(resource: Resource): Promise<NodeJS.ProcessEnv> {
    const envVars = await this.environmentActivationService.getActivatedEnvironmentVariables(resource)
    if (envVars && Object.keys(envVars).length > 0) {
      return envVars
    }
    return this.envVarsProvider.getEnvironmentVariables(resource)
  }
}

/**
 * Creates a langauge client for use by users of the extension.
 *
 * @export
 * @class DownloadedLanguageClientFactory
 * @implements {ILanguageClientFactory}
 */
@injectable()
export class DownloadedLanguageClientFactory implements ILanguageClientFactory {
  constructor(@inject(IPlatformData) private readonly platformData: IPlatformData,
    @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService,
    @inject(IExtensionContext) private readonly context: IExtensionContext) { }

  public async createLanguageClient(_resource: Resource, clientOptions: LanguageClientOptions, env?: NodeJS.ProcessEnv): Promise<LanguageClient> {
    const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName()
    const serverModule = path.join(this.context.storagePath, languageServerFolder, this.platformData.engineExecutableName)
    const serverOptions: Executable = {
      command: serverModule,
      args: [],
      options: { stdio: 'pipe', env }
    }
    return new LanguageClient('python', serverOptions, clientOptions, false)
  }
}

/**
 * Creates a language client factory primarily used for LS development purposes.
 *
 * @export
 * @class SimpleLanguageClientFactory
 * @implements {ILanguageClientFactory}
 */
@injectable()
export class SimpleLanguageClientFactory implements ILanguageClientFactory {
  constructor(@inject(IPlatformData) private readonly platformData: IPlatformData,
    @inject(ILanguageServerFolderService) private readonly languageServerFolderService: ILanguageServerFolderService,
    @inject(IExtensionContext) private readonly context: IExtensionContext) { }
  public async createLanguageClient(_resource: Resource, clientOptions: LanguageClientOptions, env?: NodeJS.ProcessEnv): Promise<LanguageClient> {
    const languageServerFolder = await this.languageServerFolderService.getLanguageServerFolderName()
    const serverModule = path.join(this.context.storagePath, languageServerFolder, this.platformData.engineDllName)
    const serverOptions: Executable = {
      command: dotNetCommand,
      args: [serverModule],
      options: { stdio: 'pipe', env }
    }
    return new LanguageClient('python', languageClientName, serverOptions, clientOptions)
  }
}
