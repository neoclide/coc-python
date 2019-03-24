'use strict'

import { IConfigurationService } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { JediFactory } from '../languageServices/jediProxyFactory'
import { CompletionSource } from './completionSource'
import { ItemInfoSource } from './itemInfoSource'
import { CompletionItemProvider } from 'coc.nvim'
import { TextDocument, Position, CancellationToken, CompletionItem } from 'vscode-languageserver-protocol'

export class PythonCompletionItemProvider implements CompletionItemProvider {
  private completionSource: CompletionSource
  private configService: IConfigurationService

  constructor(jediFactory: JediFactory, serviceContainer: IServiceContainer) {
    this.completionSource = new CompletionSource(jediFactory, serviceContainer, new ItemInfoSource(jediFactory))
    this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService)
  }

  public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken):
    Promise<CompletionItem[]> {
    const items = await this.completionSource.getVsCodeCompletionItems(document, position, token)
    if (this.configService.isTestExecution()) {
      for (let i = 0; i < Math.min(3, items.length); i += 1) {
        items[i] = await this.resolveCompletionItem(items[i], token)
      }
    }
    return items
  }

  public async resolveCompletionItem(item: CompletionItem, token: CancellationToken): Promise<CompletionItem> {
    if (!item.documentation) {
      const itemInfos = await this.completionSource.getDocumentation(item, token)
      if (itemInfos && itemInfos.length > 0) {
        let tip = itemInfos[0].tooltip
        item.documentation = { kind: tip.kind, value: tip.value.trim() }
      }
    }
    return item
  }
}
