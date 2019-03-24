import { Product } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { BaseFormatter } from './baseFormatter'
import { TextDocument, FormattingOptions, Range, TextEdit } from 'vscode-languageserver-types'
import { CancellationToken } from 'vscode-jsonrpc'

export class DummyFormatter extends BaseFormatter {
  constructor(serviceContainer: IServiceContainer) {
    super('none', Product.yapf, serviceContainer)
  }

  public formatDocument(_document: TextDocument, _options: FormattingOptions, _token: CancellationToken, _range?: Range): Thenable<TextEdit[]> {
    return Promise.resolve([])
  }
}
