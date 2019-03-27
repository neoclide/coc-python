import { CancellationToken, TextDocument } from 'vscode-languageserver-protocol'
import { OutputChannel, Uri } from 'coc.nvim'
import { Product } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { BaseLinter } from './baseLinter'
import { ILintMessage } from './types'

const COLUMN_OFF_SET = 1

export class Flake8 extends BaseLinter {
  constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
    super(Product.flake8, outputChannel, serviceContainer, COLUMN_OFF_SET)
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run(['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', Uri.parse(document.uri).fsPath], document, cancellation)
    messages.forEach(msg => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.flake8CategorySeverity)
    })
    return messages
  }
}
