// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { Disposable, Emitter, Event, Uri, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { ICommandManager, IDocumentManager } from '../../common/application/types'
import { Commands } from '../../common/constants'
import { IFileSystem } from '../../common/platform/types'
import { IDisposableRegistry } from '../../common/types'
import { noop } from '../../common/utils/misc'
import { IServiceContainer } from '../../ioc/types'
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from '../../terminals/types'

@injectable()
export class CodeExecutionManager implements ICodeExecutionManager {
  private eventEmitter: Emitter<string> = new Emitter<string>()
  constructor(@inject(ICommandManager) private commandManager: ICommandManager,
    @inject(IDocumentManager) private documentManager: IDocumentManager,
    @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
    @inject(IFileSystem) private fileSystem: IFileSystem,
    // @inject(IPythonExtensionBanner) @named(BANNER_NAME_INTERACTIVE_SHIFTENTER) private readonly shiftEnterBanner: IPythonExtensionBanner,
    @inject(IServiceContainer) private serviceContainer: IServiceContainer) {

  }

  public get onExecutedCode(): Event<string> {
    return this.eventEmitter.event
  }

  public registerCommands(): void {
    this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_In_Terminal, this.executeFileInTerminal.bind(this)))
    this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_Selection_In_Terminal, this.executeSelectionInTerminal.bind(this)))
    this.disposableRegistry.push(this.commandManager.registerCommand(Commands.Exec_Selection_In_Django_Shell, this.executeSelectionInDjangoShell.bind(this)))
  }

  private async executeFileInTerminal(file?: Uri): Promise<void> {
    const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper)
    file = file instanceof Uri ? file : undefined
    const fileToExecute = file ? file : await codeExecutionHelper.getFileToExecute()
    if (!fileToExecute) {
      return
    }
    await workspace.nvim.command('noa wa')

    // try {
    //   const contents = await this.fileSystem.readFile(fileToExecute.fsPath)
    //   this.eventEmitter.fire(contents)
    // } catch {
    //   // Ignore any errors that occur for firing this event. It's only used
    //   // for telemetry
    //   noop()
    // }

    const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard')
    await executionService.executeFile(fileToExecute)
  }

  private async executeSelectionInTerminal(): Promise<void> {
    const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard')

    await this.executeSelection(executionService)
    // Prompt one time to ask if they want to send shift-enter to the Interactive Window
    // this.shiftEnterBanner.showBanner().catch(emptyFn)
  }

  private async executeSelectionInDjangoShell(): Promise<void> {
    const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'djangoShell')
    await this.executeSelection(executionService)
  }

  private async executeSelection(executionService: ICodeExecutionService): Promise<void> {
    const { nvim } = workspace
    const mode = await nvim.call('visualmode')
    if (!mode) return
    const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper)
    const codeToExecute = await codeExecutionHelper.getSelectedTextToExecute(mode)
    const normalizedCode = await codeExecutionHelper.normalizeLines(codeToExecute!)
    if (!normalizedCode || normalizedCode.trim().length === 0) {
      return
    }

    try {
      this.eventEmitter.fire(normalizedCode)
    } catch {
      // Ignore any errors that occur for firing this event. It's only used
      // for telemetry
      noop()
    }
    const doc = workspace.getDocument(workspace.bufnr)

    await executionService.execute(normalizedCode, Uri.parse(doc.uri))
  }
}
