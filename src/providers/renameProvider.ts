import { Uri, OutputChannel, ProviderResult, RenameProvider, workspace } from 'coc.nvim'
import { CancellationToken, Position, TextDocument, WorkspaceEdit } from 'vscode-languageserver-protocol'
import { EXTENSION_ROOT_DIR, STANDARD_OUTPUT_CHANNEL } from '../common/constants'
import { getWorkspaceEditsFromPatch } from '../common/editor'
import { IConfigurationService, IInstaller, IOutputChannel, Product } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { RefactorProxy } from '../refactor/proxy'

interface RenameResponse {
  results: [{ diff: string }]
}

export class PythonRenameProvider implements RenameProvider {
  private readonly outputChannel: OutputChannel
  private readonly configurationService: IConfigurationService
  constructor(private serviceContainer: IServiceContainer) {
    this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
    this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService)
  }

  public provideRenameEdits(document: TextDocument, position: Position, newName: string, _token: CancellationToken): ProviderResult<WorkspaceEdit> {
    return workspace.nvim.command('wa').then(() => {
      return this.doRename(document, position, newName)
    })
  }

  private doRename(document: TextDocument, position: Position, newName: string): ProviderResult<WorkspaceEdit> {
    let doc = workspace.getDocument(document.uri)
    if (doc.getline(position.line).match(/^\s*\/\//)) {
      return
    }

    const range = doc.getWordRangeAtPosition(position)
    const isEmpty = range.start.line == range.end.line && range.start.character == range.end.character
    if (!range || isEmpty) {
      return
    }
    const oldName = document.getText(range)
    if (oldName === newName) {
      return
    }
    const workspaceRoot = workspace.rootPath
    const pythonSettings = this.configurationService.getSettings(Uri.file(workspaceRoot))

    const proxy = new RefactorProxy(EXTENSION_ROOT_DIR, pythonSettings, workspaceRoot, this.serviceContainer)
    return proxy.rename<RenameResponse>(document, newName, Uri.parse(document.uri).fsPath, range).then(response => {
      const fileDiffs = response.results.map(fileChanges => fileChanges.diff)
      return getWorkspaceEditsFromPatch(fileDiffs, workspaceRoot)
    }).catch(reason => {
      if (reason === 'Not installed') {
        const installer = this.serviceContainer.get<IInstaller>(IInstaller)
        installer.promptToInstall(Product.rope, Uri.parse(document.uri))
          .catch(ex => console.error('Python Extension: promptToInstall', ex))
        return Promise.reject('')
      } else {
        workspace.showMessage(reason, 'error')
        this.outputChannel.appendLine(reason)
      }
      return Promise.reject(reason)
    })
  }
}
