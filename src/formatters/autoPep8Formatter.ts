import { Product } from '../common/installer/productInstaller'
import { IConfigurationService } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { BaseFormatter } from './baseFormatter'
import { TextDocument, TextEdit, FormattingOptions, CancellationToken, Range } from 'vscode-languageserver-protocol'
import { Uri } from 'coc.nvim'

export class AutoPep8Formatter extends BaseFormatter {
  constructor(serviceContainer: IServiceContainer) {
    super('autopep8', Product.autopep8, serviceContainer)
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    // const stopWatch = new StopWatch()
    const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.parse(document.uri))
    const hasCustomArgs = Array.isArray(settings.formatting.autopep8Args) && settings.formatting.autopep8Args.length > 0
    const formatSelection = range ? range : false

    const autoPep8Args = ['--diff']
    if (hasCustomArgs) {
      autoPep8Args.push(...settings.formatting.autopep8Args)
    }
    if (formatSelection) {
      // tslint:disable-next-line:no-non-null-assertion
      autoPep8Args.push(...['--line-range', (range!.start.line + 1).toString(), (range!.end.line + 1).toString()])
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, autoPep8Args)
    return promise
  }
}
