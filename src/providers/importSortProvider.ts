import { Uri, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { EOL } from 'os'
import * as path from 'path'
import { CancellationToken, Position, TextEdit, WorkspaceEdit } from 'vscode-languageserver-protocol'
import { IApplicationShell, ICommandManager, IDocumentManager } from '../common/application/types'
import { Commands, EXTENSION_ROOT_DIR, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../common/constants'
import { IFileSystem } from '../common/platform/types'
import { IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types'
import { IConfigurationService, IDisposableRegistry, IEditorUtils, ILogger, IOutputChannel } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { ISortImportsEditingProvider } from './types'

@injectable()
export class SortImportsEditingProvider implements ISortImportsEditingProvider {
  private readonly processServiceFactory: IProcessServiceFactory
  private readonly pythonExecutionFactory: IPythonExecutionFactory
  private readonly documentManager: IDocumentManager
  private readonly configurationService: IConfigurationService
  private readonly editorUtils: IEditorUtils
  public constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    this.documentManager = serviceContainer.get<IDocumentManager>(IDocumentManager)
    this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService)
    this.pythonExecutionFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory)
    this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory)
    this.editorUtils = serviceContainer.get<IEditorUtils>(IEditorUtils)
  }

  public async provideDocumentSortImportsEdits(uri: Uri, token?: CancellationToken): Promise<WorkspaceEdit | undefined> {
    let doc = workspace.getDocument(workspace.bufnr)
    if (doc.uri != uri.toString()) {
      await workspace.jumpTo(uri.toString())
    }
    doc = await workspace.document
    if (doc.lineCount <= 1) {
      return
    }
    // isort does have the ability to read from the process input stream and return the formatted code out of the output stream.
    // However they don't support returning the diff of the formatted text when reading data from the input stream.
    // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
    // to be done here in node (extension), i.e. extension cpu, i.e. less responsive solution.
    const importScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py')
    const fsService = this.serviceContainer.get<IFileSystem>(IFileSystem)
    const tmpFile = doc.dirty ? await fsService.createTemporaryFile(path.extname(Uri.parse(doc.uri).fsPath)) : undefined
    if (tmpFile) {
      await fsService.writeFile(tmpFile.filePath, doc.getDocumentContent())
    }
    const settings = this.configurationService.getSettings(uri)
    const isort = settings.sortImports.path
    const filePath = tmpFile ? tmpFile.filePath : Uri.parse(doc.uri).fsPath
    const args = [filePath, '--diff'].concat(settings.sortImports.args)
    let diffPatch: string

    if (token && token.isCancellationRequested) {
      return
    }
    try {
      if (typeof isort === 'string' && isort.length > 0) {
        // Lets just treat this as a standard tool.
        const processService = await this.processServiceFactory.create(Uri.parse(doc.uri))
        diffPatch = (await processService.exec(isort, args, { throwOnStdErr: true, token })).stdout
      } else {
        const processExeService = await this.pythonExecutionFactory.create({ resource: Uri.parse(doc.uri) })
        diffPatch = (await processExeService.exec([importScript].concat(args), { throwOnStdErr: true, token })).stdout
      }

      return this.editorUtils.getWorkspaceEditsFromPatch(doc.getDocumentContent(), diffPatch, Uri.parse(doc.uri))
    } finally {
      if (tmpFile) {
        tmpFile.dispose()
      }
    }
  }

  public registerCommands() {
    const cmdManager = this.serviceContainer.get<ICommandManager>(ICommandManager)
    const disposable = cmdManager.registerCommand(Commands.Sort_Imports, this.sortImports, this)
    this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(disposable)
  }
  public async sortImports(uri?: Uri): Promise<void> {
    if (!uri) {
      const doc = await workspace.document
      if (!doc || doc.filetype !== PYTHON_LANGUAGE) {
        workspace.showMessage('Please open a Python file to sort the imports.', 'error')
        return
      }
      uri = Uri.parse(doc.uri)
    }

    const document = await this.documentManager.openTextDocument(uri)
    if (document.lineCount <= 1) {
      return
    }
    const doc = workspace.getDocument(workspace.bufnr)

    // Hack, if the document doesn't contain an empty line at the end, then add it
    // Else the library strips off the last line
    const lastLine = doc.getline(document.lineCount - 1)
    if (lastLine.trim().length > 0) {
      const edit: WorkspaceEdit = { changes: {} }
      const position = Position.create(document.lineCount - 1, lastLine.length)
      edit.changes[uri.toString()] = [TextEdit.insert(position, EOL)]
      await workspace.applyEdit(edit)
    }

    try {
      const changes = await this.provideDocumentSortImportsEdits(uri)
      if (!changes || Object.keys(changes.changes).length === 0) {
        return
      }
      await workspace.applyEdit(changes)
    } catch (error) {
      const message = typeof error === 'string' ? error : (error.message ? error.message : error)
      const outputChannel = this.serviceContainer.get<IOutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
      outputChannel.appendLine(error)
      const logger = this.serviceContainer.get<ILogger>(ILogger)
      logger.logError(`Failed to format imports for '${uri.fsPath}'.`, error)
      workspace.showMessage(message, 'error')
    }
  }
}
