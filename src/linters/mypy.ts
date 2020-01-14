import { CancellationToken, TextDocument } from 'vscode-languageserver-protocol'
import { OutputChannel, Uri } from 'coc.nvim'
import { Product } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { BaseLinter } from './baseLinter'
import { ILintMessage } from './types'

const COLUMN_OFF_SET = 1

export const REGEX = '(?<file>[^:]+):(?<line>\\d+)(:(?<column>\\d+))?: (?<type>\\w+): (?<message>.*)\\r?(\\n|$)'

export class MyPy extends BaseLinter {
  constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
    super(Product.mypy, outputChannel, serviceContainer, COLUMN_OFF_SET)
  }

  protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
    const messages = await this.run([Uri.parse(document.uri).fsPath], document, cancellation, REGEX)
    messages.forEach(msg => {
      msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity)
      msg.code = msg.type
    })
    return messages
  }
}
