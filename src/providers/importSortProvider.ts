import { Uri, workspace, Document } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { EOL } from 'os'
import * as path from 'path'
import { CancellationToken, Position, TextEdit, WorkspaceEdit } from 'vscode-languageserver-protocol'
import { ICommandManager, IDocumentManager } from '../common/application/types'
import { Commands, EXTENSION_ROOT_DIR, PYTHON_LANGUAGE, STANDARD_OUTPUT_CHANNEL } from '../common/constants'
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

  private async generateIsortFixDiff(doc: Document, token?: CancellationToken): Promise<string> {
    // Since version 5.5.2 isort supports reading from stdin AND generating a diff patch.
    // For reference see: https://github.com/PyCQA/isort/issues/1469
    const docUri = Uri.parse(doc.uri)
    const docContent = doc.getDocumentContent()
    const settings = this.configurationService.getSettings(docUri)
    const { path: isortPath, args: userArgs } = settings.sortImports
    const args = ['-', '--diff'].concat(userArgs)
    const options = { throwOnStdErr: true, token }

    if (token && token.isCancellationRequested) {
      return
    }

    if (typeof isortPath === 'string' && isortPath.length > 0) {
      const processService = await this.processServiceFactory.create(docUri)
      return (await processService.exec(isortPath, args, options, docContent)).stdout
    } else {
      const importScript = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'sortImports.py')
      const commandString = [importScript].concat(args)
      const processExeService = await this.pythonExecutionFactory.create({ resource: docUri })
      return (await processExeService.exec(commandString, options, docContent)).stdout
    }
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

    const diffPatch = await this.generateIsortFixDiff(doc, token)
    return this.editorUtils.getWorkspaceEditsFromPatch(doc.getDocumentContent(), diffPatch, Uri.parse(doc.uri))
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
