import { inject, injectable } from 'inversify'
import { ConfigurationTarget, Disposable, Uri, workspace } from 'coc.nvim'
import { IApplicationShell, ICommandManager, IDocumentManager, IWorkspaceService } from '../../common/application/types'
import { Commands } from '../../common/constants'
import { IConfigurationService, IPathUtils } from '../../common/types'
import { IInterpreterService, IShebangCodeLensProvider, PythonInterpreter, WorkspacePythonPath } from '../contracts'
import { IInterpreterComparer, IInterpreterSelector, IPythonPathUpdaterServiceManager } from './types'

export interface IInterpreterQuickPickItem {
  path: string
}

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
  private disposables: Disposable[] = []

  constructor(@inject(IInterpreterService) private readonly interpreterManager: IInterpreterService,
    @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
    @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
    @inject(IPathUtils) private readonly pathUtils: IPathUtils,
    @inject(IInterpreterComparer) private readonly interpreterComparer: IInterpreterComparer,
    @inject(IPythonPathUpdaterServiceManager) private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
    @inject(IShebangCodeLensProvider) private readonly shebangCodeLensProvider: IShebangCodeLensProvider,
    @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    @inject(ICommandManager) private readonly commandManager: ICommandManager) {
  }
  public dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
  }

  public initialize() {
    this.disposables.push(this.commandManager.registerCommand(Commands.Set_Interpreter, this.setInterpreter.bind(this)))
    this.disposables.push(this.commandManager.registerCommand(Commands.Set_ShebangInterpreter, this.setShebangInterpreter.bind(this)))
  }

  public async getSuggestions(resourceUri?: Uri) {
    const interpreters = await this.interpreterManager.getInterpreters(resourceUri)
    interpreters.sort(this.interpreterComparer.compare.bind(this.interpreterComparer))
    return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)))
  }
  protected async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<IInterpreterQuickPickItem> {
    // const detail = this.pathUtils.getDisplayName(suggestion.path, workspaceUri ? workspaceUri.fsPath : undefined)
    // const cachedPrefix = suggestion.cachedEntry ? '(cached) ' : ''
    return {
      // tslint:disable-next-line:no-non-null-assertion
      path: suggestion.path
    }
  }

  protected async setInterpreter() {
    const { workspaceFolders } = this.workspaceService
    const setInterpreterGlobally = !Array.isArray(workspaceFolders) || workspaceFolders.length == 0
    let configTarget = ConfigurationTarget.Global
    let wkspace: Uri | undefined
    if (!setInterpreterGlobally) {
      wkspace = Uri.parse(workspace.workspaceFolder.uri)
      configTarget = ConfigurationTarget.Workspace
    }
    const suggestions = await this.getSuggestions(wkspace)
    const settings = this.configurationService.getSettings(wkspace)
    const currentPythonPath = settings.pythonPath
    const idx = await workspace.showQuickpick(suggestions.map(s => s.path), `Select pythonPath, current: ${currentPythonPath}`)
    if (idx !== -1) {
      let selection = suggestions[idx]
      await this.pythonPathUpdaterService.updatePythonPath(selection.path, configTarget, 'ui', wkspace)
      workspace.nvim.command('CocRestart', true)
    }
    // settings.
  }

  protected async setShebangInterpreter(): Promise<void> {
    const shebang = await this.shebangCodeLensProvider.detectShebang(workspace.getDocument(workspace.bufnr).textDocument)
    if (!shebang) {
      return
    }
    const doc = workspace.getDocument(workspace.bufnr)
    const isGlobalChange = !Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0
    const workspaceFolder = this.workspaceService.getWorkspaceFolder(Uri.parse(doc.uri))
    const isWorkspaceChange = Array.isArray(this.workspaceService.workspaceFolders) && this.workspaceService.workspaceFolders.length === 1

    if (isGlobalChange) {
      await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Global, 'shebang')
      return
    }

    if (isWorkspaceChange || !workspaceFolder) {
      await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Workspace, 'shebang')
      return
    }

    await this.pythonPathUpdaterService.updatePythonPath(shebang, ConfigurationTarget.Workspace, 'shebang', Uri.parse(workspaceFolder.uri))
  }
  private async getWorkspaceToSetPythonPath(): Promise<WorkspacePythonPath | undefined> {
    if (!Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0) {
      return undefined
    }

    // Ok we have multiple workspaces, get the user to pick a folder.
    // const workspaceFolder = await this.applicationShell.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' })
    // return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined
    return { folderUri: Uri.parse(this.workspaceService.workspaceFolders[0].uri), configTarget: ConfigurationTarget.Workspace }
  }
}
