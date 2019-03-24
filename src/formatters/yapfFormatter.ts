import { workspace } from 'coc.nvim'
import { CancellationToken } from 'vscode-jsonrpc'
import { FormattingOptions, Range, TextDocument, TextEdit } from 'vscode-languageserver-types'
import { Product } from '../common/types'
import { StopWatch } from '../common/utils/stopWatch'
import { IServiceContainer } from '../ioc/types'
import { BaseFormatter } from './baseFormatter'

export class YapfFormatter extends BaseFormatter {
  constructor(serviceContainer: IServiceContainer) {
    super('yapf', Product.yapf, serviceContainer)
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const stopWatch = new StopWatch()
    const settings = workspace.getConfiguration('python', document.uri)
    const hasCustomArgs = Array.isArray(settings.formatting.yapfArgs) && settings.formatting.yapfArgs.length > 0
    const formatSelection = range ? range : false

    const yapfArgs = ['--diff']
    if (hasCustomArgs) {
      yapfArgs.push(...settings.formatting.yapfArgs)
    }
    if (formatSelection) {
      // tslint:disable-next-line:no-non-null-assertion
      yapfArgs.push(...['--lines', `${range!.start.line + 1}-${range!.end.line + 1}`])
    }
    // Yapf starts looking for config file starting from the file path.
    const fallbarFolder = this.getWorkspaceUri(document).fsPath
    const cwd = this.getDocumentPath(document, fallbarFolder)
    const promise = super.provideDocumentFormattingEdits(document, options, token, yapfArgs, cwd)
    return promise
  }
}
