import { Disposable, Uri, workspace } from 'coc.nvim'
import { ICommandManager } from '../common/application/types'
import { Commands } from '../common/constants'
import { IServiceContainer } from '../ioc/types'
import { ICodeExecutionService } from '../terminals/types'

export class ReplProvider implements Disposable {
  private readonly disposables: Disposable[] = []
  constructor(private serviceContainer: IServiceContainer) {
    this.registerCommand()
  }
  public dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
  }
  private registerCommand() {
    const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager)
    const disposable = commandManager.registerCommand(Commands.Start_REPL, this.commandHandler, this)
    this.disposables.push(disposable)
  }
  private async commandHandler() {
    const resource = this.getActiveResourceUri()
    const replProvider = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'repl')
    await replProvider.initializeRepl(resource)
  }
  private getActiveResourceUri(): Uri | undefined {
    let doc = workspace.getDocument(workspace.bufnr)
    if (!doc) return undefined
    return Uri.parse(doc.uri)
  }
}
