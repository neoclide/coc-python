// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable, multiInject } from 'inversify'
import { TextDocument } from 'vscode-languageserver-protocol'
import { Uri, workspace } from 'coc.nvim'
import { IApplicationDiagnostics } from '../application/types'
import { IDocumentManager, IWorkspaceService } from '../common/application/types'
import { PYTHON_LANGUAGE } from '../common/constants'
import { traceDecorators } from '../common/logger'
import { IDisposable, Resource } from '../common/types'
import { IInterpreterAutoSelectionService } from '../interpreter/autoSelection/types'
import { IInterpreterService } from '../interpreter/contracts'
import { IExtensionActivationManager, IExtensionActivationService } from './types'
import { emptyFn } from '../common/function'

@injectable()
export class ExtensionActivationManager implements IExtensionActivationManager {
  private readonly disposables: IDisposable[] = []
  private docOpenedHandler?: IDisposable
  private readonly activatedWorkspaces = new Set<string>()
  constructor(
    @multiInject(IExtensionActivationService) private readonly activationServices: IExtensionActivationService[],
    @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
    @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
    @inject(IInterpreterAutoSelectionService) private readonly autoSelection: IInterpreterAutoSelectionService,
    @inject(IApplicationDiagnostics) private readonly appDiagnostics: IApplicationDiagnostics,
    @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
  ) { }

  public dispose() {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.shift()!
      disposable.dispose()
    }
    if (this.docOpenedHandler) {
      this.docOpenedHandler.dispose()
      this.docOpenedHandler = undefined
    }
  }
  public async activate(): Promise<void> {
    await this.initialize()
    await this.activateWorkspace(this.getActiveResource())
    await this.autoSelection.autoSelectInterpreter(undefined)
  }
  @traceDecorators.error('Failed to activate a workspace')
  public async activateWorkspace(resource: Resource) {
    const key = this.getWorkspaceKey(resource)
    if (this.activatedWorkspaces.has(key)) {
      return
    }
    this.activatedWorkspaces.add(key)
    // Get latest interpreter list in the background.
    this.interpreterService.getInterpreters(resource).catch(() => { })

    await this.autoSelection.autoSelectInterpreter(resource)
    await Promise.all(this.activationServices.map(item => item.activate(resource)))
    await this.appDiagnostics.performPreStartupHealthCheck(resource)
  }
  protected async initialize() {
    this.addRemoveDocOpenedHandlers()
  }
  protected addRemoveDocOpenedHandlers() {
    if (this.hasMultipleWorkspaces()) {
      if (!this.docOpenedHandler) {
        this.docOpenedHandler = this.documentManager.onDidOpenTextDocument(this.onDocOpened, this)
      }
      return
    }
    if (this.docOpenedHandler) {
      this.docOpenedHandler.dispose()
      this.docOpenedHandler = undefined
    }
  }
  protected hasMultipleWorkspaces() {
    return false
  }
  protected onDocOpened(doc: TextDocument) {
    if (doc.languageId !== PYTHON_LANGUAGE) {
      return
    }
    const key = this.getWorkspaceKey(Uri.parse(doc.uri))
    // If we have opened a doc that does not belong to workspace, then do nothing.
    if (key === '') {
      return
    }
    if (this.activatedWorkspaces.has(key)) {
      return
    }
    const folder = workspace.workspaceFolder
    this.activateWorkspace(folder ? Uri.parse(folder.uri) : undefined).catch(emptyFn)
  }
  protected getWorkspaceKey(resource: Resource) {
    return workspace.rootPath
  }
  private getActiveResource(): Resource {
    let doc = workspace.getDocument(workspace.bufnr)
    if (!doc || doc.filetype !== 'python') return null
    return Uri.parse(doc.uri)
  }
}
