import fs from 'fs-extra'
import path from 'path'
import { IWorkspaceService } from '../common/application/types'
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants'
import { isNotInstalledError } from '../common/helpers'
import { IPythonToolExecutionService } from '../common/process/types'
import { IInstaller, IOutputChannel, Product, Resource } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from './../common/editor'
import { IFormatterHelper } from './types'
import { Uri, OutputChannel, workspace } from 'coc.nvim'
import { TextDocument, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-types'
import { CancellationToken } from 'vscode-jsonrpc'
import { emptyFn } from '../common/function'
import { promisify } from 'util'

export abstract class BaseFormatter {
  protected readonly outputChannel: OutputChannel
  protected readonly workspace: IWorkspaceService
  private readonly helper: IFormatterHelper

  constructor(public Id: string, private product: Product, protected serviceContainer: IServiceContainer) {
    this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
    this.helper = serviceContainer.get<IFormatterHelper>(IFormatterHelper)
    this.workspace = serviceContainer.get<IWorkspaceService>(IWorkspaceService)
  }

  public abstract formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]>
  protected getDocumentPath(document: TextDocument, fallbackPath: string): string {
    let filepath = Uri.parse(document.uri).fsPath
    if (path.basename(filepath) === filepath) {
      return fallbackPath
    }
    return path.dirname(filepath)
  }
  protected getWorkspaceUri(document: TextDocument): Resource {
    let { rootPath } = workspace
    let filepath = Uri.parse(document.uri).fsPath
    if (!filepath.startsWith(rootPath)) return null
    return Uri.file(rootPath)
  }
  protected async provideDocumentFormattingEdits(document: TextDocument, _options: FormattingOptions, token: CancellationToken, args: string[], cwd?: string): Promise<TextEdit[]> {
    if (typeof cwd !== 'string' || cwd.length === 0) {
      cwd = this.getWorkspaceUri(document).fsPath
    }

    // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream.
    // However they don't support returning the diff of the formatted text when reading data from the input stream.
    // Yet getting text formatted that way avoids having to create a temporary file, however the diffing will have
    // to be done here in node (extension), i.e. extension CPU, i.e. less responsive solution.
    let filepath = Uri.parse(document.uri).fsPath
    const tempFile = await this.createTempFile(document)
    if (this.checkCancellation(filepath, tempFile, token)) {
      return []
    }

    const executionInfo = this.helper.getExecutionInfo(this.product, args, Uri.parse(document.uri))
    executionInfo.args.push(tempFile)
    const pythonToolsExecutionService = this.serviceContainer.get<IPythonToolExecutionService>(IPythonToolExecutionService)
    const promise = pythonToolsExecutionService.exec(executionInfo, { cwd, throwOnStdErr: false, token }, Uri.parse(document.uri))
      .then(output => output.stdout)
      .then(data => {
        if (this.checkCancellation(filepath, tempFile, token)) {
          return [] as TextEdit[]
        }
        return getTextEditsFromPatch(document.getText(), data)
      })
      .catch(error => {
        if (this.checkCancellation(filepath, tempFile, token)) {
          return [] as TextEdit[]
        }
        // tslint:disable-next-line:no-empty
        this.handleError(this.Id, error, Uri.parse(document.uri)).catch(() => { })
        return [] as TextEdit[]
      })
    // tslint:disable-next-line: no-floating-promises
    promise.then(() => {
      this.deleteTempFile(filepath, tempFile).catch(emptyFn)
      workspace.showMessage(`Formatted with ${this.Id}`)
      let { nvim } = workspace
      setTimeout(async () => {
        let line = await nvim.call('coc#util#echo_line') as string
        if (line && /Formatted/.test(line)) nvim.command('echo ""', true)
      }, 2000)
    }, () => {
      this.deleteTempFile(filepath, tempFile).catch(emptyFn)
    })
    return promise
  }

  protected async handleError(_expectedFileName: string, error: Error, resource?: Uri) {
    let customError = `Formatting with ${this.Id} failed.`

    if (isNotInstalledError(error)) {
      const installer = this.serviceContainer.get<IInstaller>(IInstaller)
      const isInstalled = await installer.isInstalled(this.product, resource)
      if (!isInstalled) {
        customError += `\nYou could either install the '${this.Id}' formatter, turn it off or use another formatter.`
        installer.promptToInstall(this.product, resource).catch(ex => console.error('Python Extension: promptToInstall', ex))
      }
    }

    this.outputChannel.appendLine(`\n${customError}\n${error}`)
  }

  private createTempFile(document: TextDocument): Promise<string> {
    return getTempFileWithDocumentContents(document)
  }

  private deleteTempFile(originalFile: string, tempFile: string): Promise<any> {
    if (originalFile !== tempFile) {
      return promisify(fs.unlink)(tempFile)
    }
    return Promise.resolve()
  }

  private checkCancellation(originalFile: string, tempFile: string, token?: CancellationToken): boolean {
    if (token && token.isCancellationRequested) {
      this.deleteTempFile(originalFile, tempFile).catch(emptyFn)
      return true
    }
    return false
  }
}
