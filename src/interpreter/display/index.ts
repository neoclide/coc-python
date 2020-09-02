import { Disposable, workspace, events, StatusBarItem, Uri } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { IApplicationShell, IWorkspaceService } from '../../common/application/types'
import { IDisposableRegistry, Resource } from '../../common/types'
import { IServiceContainer } from '../../ioc/types'
import { IInterpreterAutoSelectionService } from '../autoSelection/types'
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService, PythonInterpreter } from '../contracts'
import { IConfigurationService } from '../../common/types'
import { emptyFn } from '../../common/function'

// tslint:disable-next-line:completed-docs
@injectable()
export class InterpreterDisplay implements IInterpreterDisplay {
  private readonly statusBar: StatusBarItem
  private readonly helper: IInterpreterHelper
  private readonly workspaceService: IWorkspaceService
  private readonly interpreterService: IInterpreterService
  private currentlySelectedInterpreterPath?: string
  private currentlySelectedWorkspaceFolder: Resource
  private readonly configService: IConfigurationService
  private readonly autoSelection: IInterpreterAutoSelectionService

  constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
    this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper)
    this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService)
    this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService)
    this.autoSelection = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService)
    this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService)

    const application = serviceContainer.get<IApplicationShell>(IApplicationShell)
    const disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry)

    this.statusBar = application.createStatusBarItem(100)
    this.statusBar.text = 'python'
    // this.statusBar.command = 'python.setInterpreter'
    disposableRegistry.push(this.statusBar)

    this.interpreterService.onDidChangeInterpreterInformation(this.onDidChangeInterpreterInformation, this, disposableRegistry)
    events.on('BufEnter', this.onBufEnter, this, disposableRegistry)
  }

  private async onBufEnter(bufnr: number): Promise<void> {
    let filetype = await workspace.nvim.call('getbufvar', [bufnr, '&filetype', ''])
    if (filetype == 'python') {
      this.statusBar.show()
    } else {
      this.statusBar.hide()
    }
  }

  public async refresh(resource?: Uri): Promise<void> {
    // Use the workspace Uri if available
    if (resource && this.workspaceService.getWorkspaceFolder(resource)) {
      resource = Uri.parse(this.workspaceService.getWorkspaceFolder(resource)!.uri)
    }
    if (!resource) {
      const wkspc = this.helper.getActiveWorkspaceUri(resource)
      resource = wkspc ? wkspc.folderUri : undefined
    }
    await this.updateDisplay(resource)
  }
  private onDidChangeInterpreterInformation(info: PythonInterpreter): void {
    if (!this.currentlySelectedInterpreterPath || this.currentlySelectedInterpreterPath === info.path) {
      this.updateDisplay(this.currentlySelectedWorkspaceFolder).catch(emptyFn)
    }
  }
  private async updateDisplay(workspaceFolder?: Uri): Promise<void> {
    const hideInterpreterName = this.configService.getSettings().hideInterpreterName
    await this.autoSelection.autoSelectInterpreter(workspaceFolder)
    const interpreter = await this.interpreterService.getActiveInterpreter(workspaceFolder)
    this.currentlySelectedWorkspaceFolder = workspaceFolder
    if (interpreter) {
      if (hideInterpreterName) {
        this.statusBar.text = ''
      } else {
        this.statusBar.text = interpreter.displayName!
      }
      this.currentlySelectedInterpreterPath = interpreter.path
    } else {
      this.statusBar.text = 'No Python Interpreter'
      this.currentlySelectedInterpreterPath = undefined
    }
    this.statusBar.show()
  }
}
