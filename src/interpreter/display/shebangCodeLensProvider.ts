import { Event, Uri } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { CancellationToken, CodeLens, Command, Position, Range, TextDocument } from 'vscode-languageserver-protocol'
import { IWorkspaceService } from '../../common/application/types'
import { IPlatformService } from '../../common/platform/types'
import { IProcessServiceFactory } from '../../common/process/types'
import { IConfigurationService } from '../../common/types'
import { IShebangCodeLensProvider } from '../contracts'

@injectable()
export class ShebangCodeLensProvider implements IShebangCodeLensProvider {
  public readonly onDidChangeCodeLenses: Event<void>
  constructor(@inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
    @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
    @inject(IPlatformService) private readonly platformService: IPlatformService,
    @inject(IWorkspaceService) workspaceService: IWorkspaceService) {
    // tslint:disable-next-line:no-any
    this.onDidChangeCodeLenses = workspaceService.onDidChangeConfiguration as any as Event<void>

  }
  public async detectShebang(document: TextDocument): Promise<string | undefined> {
    const lines = document.getText().split(/\r?\n/)
    const firstLine = lines[0]
    if (firstLine.trim().length == 0) {
      return
    }

    if (!firstLine.startsWith('#!')) {
      return
    }

    const shebang = firstLine.substr(2).trim()
    const pythonPath = await this.getFullyQualifiedPathToInterpreter(shebang, Uri.parse(document.uri))
    return typeof pythonPath === 'string' && pythonPath.length > 0 ? pythonPath : undefined
  }
  public async provideCodeLenses(document: TextDocument, _token?: CancellationToken): Promise<CodeLens[]> {
    return this.createShebangCodeLens(document)
  }
  private async getFullyQualifiedPathToInterpreter(pythonPath: string, resource: Uri) {
    let cmdFile = pythonPath
    let args = ['-c', 'import sys;print(sys.executable)']
    if (pythonPath.indexOf('bin/env ') >= 0 && !this.platformService.isWindows) {
      // In case we have pythonPath as '/usr/bin/env python'.
      const parts = pythonPath.split(' ').map(part => part.trim()).filter(part => part.length > 0)
      cmdFile = parts.shift()!
      args = parts.concat(args)
    }
    const processService = await this.processServiceFactory.create(resource)
    return processService.exec(cmdFile, args)
      .then(output => output.stdout.trim())
      .catch(() => '')
  }
  private async createShebangCodeLens(document: TextDocument) {
    const shebang = await this.detectShebang(document)
    if (!shebang) {
      return []
    }
    const pythonPath = this.configurationService.getSettings(Uri.parse(document.uri)).pythonPath
    const resolvedPythonPath = await this.getFullyQualifiedPathToInterpreter(pythonPath, Uri.parse(document.uri))
    if (shebang === resolvedPythonPath) {
      return []
    }
    const lines = document.getText().split(/\r?\n/)
    const firstLine = lines[0]
    const startOfShebang = Position.create(0, 0)
    const endOfShebang = Position.create(0, firstLine.length - 1)
    const shebangRange = Range.create(startOfShebang, endOfShebang)

    const cmd: Command = {
      command: 'python.setShebangInterpreter',
      title: 'Set as interpreter'
    }
    return [(CodeLens.create(shebangRange, cmd))]
  }
}
