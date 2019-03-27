// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { ConfigurationChangeEvent, OutputChannel, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { Disposable } from 'vscode-languageserver-protocol'
import { LSNotSupportedDiagnosticServiceId } from '../application/diagnostics/checks/lsNotSupported'
import { IDiagnosticsService } from '../application/diagnostics/types'
import { IWorkspaceService } from '../common/application/types'
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants'
import { IConfigurationService, IDisposableRegistry, IOutputChannel, IPythonSettings, Resource } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { IExtensionActivationService, ILanguageServerActivator, LanguageServerActivator } from './types'
import { emptyFn } from '../common/function'

const jediEnabledSetting: keyof IPythonSettings = 'jediEnabled'
const workspacePathNameForGlobalWorkspaces = ''
interface ActivatorInfo { jedi: boolean; activator: ILanguageServerActivator }

@injectable()
export class LanguageServerExtensionActivationService implements IExtensionActivationService, Disposable {
  private lsActivatedWorkspaces = new Map<string, ILanguageServerActivator>()
  private currentActivator?: ActivatorInfo
  private jediActivatedOnce = false
  private readonly workspaceService: IWorkspaceService
  private readonly output: OutputChannel
  private readonly lsNotSupportedDiagnosticService: IDiagnosticsService
  private resource!: Resource

  constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService)
    this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
    this.lsNotSupportedDiagnosticService = this.serviceContainer.get<IDiagnosticsService>(
      IDiagnosticsService,
      LSNotSupportedDiagnosticServiceId
    )
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)
    disposables.push(this)
    disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)))
    // disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this))
  }

  public async activate(resource: Resource): Promise<void> {
    let jedi = this.useJedi()
    if (!jedi) {
      if (this.lsActivatedWorkspaces.has(this.getWorkspacePathKey(resource))) {
        return
      }
      const diagnostic = await this.lsNotSupportedDiagnosticService.diagnose(undefined)
      this.lsNotSupportedDiagnosticService.handle(diagnostic).catch(emptyFn)
      if (diagnostic.length) {
        jedi = true
      }
    } else {
      if (this.jediActivatedOnce) {
        return
      }
      this.jediActivatedOnce = true
    }

    this.resource = resource
    await this.logStartup(jedi)
    let activatorName = jedi ? LanguageServerActivator.Jedi : LanguageServerActivator.DotNet
    let activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName)
    this.currentActivator = { jedi, activator }

    try {
      await activator.activate(resource)
      if (!jedi) {
        this.lsActivatedWorkspaces.set(this.getWorkspacePathKey(resource), activator)
      }
    } catch (ex) {
      if (jedi) {
        return
      }
      // Language server fails, reverting to jedi
      if (this.jediActivatedOnce) {
        return
      }
      this.jediActivatedOnce = true
      jedi = true
      await this.logStartup(jedi)
      activatorName = LanguageServerActivator.Jedi
      activator = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, activatorName)
      this.currentActivator = { jedi, activator }
      await activator.activate(resource)
    }
  }

  public dispose(): void {
    if (this.currentActivator) {
      this.currentActivator.activator.dispose()
    }
  }

  protected onWorkspaceFoldersChanged(): void {
    // If an activated workspace folder was removed, dispose its activator
    // const workspaceKeys = this.workspaceService.workspaceFolders!.map(workspaceFolder => this.getWorkspacePathKey(workspaceFolder.uri))
    // const activatedWkspcKeys = Array.from(this.lsActivatedWorkspaces.keys())
    // const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0)
    // if (activatedWkspcFoldersRemoved.length > 0) {
    //   for (const folder of activatedWkspcFoldersRemoved) {
    //     this.lsActivatedWorkspaces.get(folder)!.dispose()
    //     this.lsActivatedWorkspaces!.delete(folder)
    //   }
    // }
  }

  private async logStartup(isJedi: boolean): Promise<void> {
    const outputLine = isJedi
      ? 'Starting Jedi Python language engine.'
      : 'Starting Microsoft Python language server.'
    this.output.appendLine(outputLine)
  }

  private async onDidChangeConfiguration(event: ConfigurationChangeEvent): Promise<void> {
    if (!event.affectsConfiguration(`python.${jediEnabledSetting}`)) {
      return
    }
    const jedi = this.useJedi()
    if (this.currentActivator && this.currentActivator.jedi === jedi) {
      return
    }
    const reload = await workspace.showPrompt(`Reload coc server to switching between language engines?`)
    if (reload) {
      workspace.nvim.command(`CocRestart`, true)
    }
  }
  private useJedi(): boolean {
    const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService)
    return configurationService.getSettings(this.resource).jediEnabled
  }
  private getWorkspacePathKey(_resource: Resource): string {
    return workspace.rootPath
  }
}
