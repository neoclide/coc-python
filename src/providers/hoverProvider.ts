'use strict'

import { JediFactory } from '../languageServices/jediProxyFactory'
import { ItemInfoSource } from './itemInfoSource'
import { HoverProvider } from 'coc.nvim'
import { TextDocument, Position, CancellationToken, Hover, MarkedString } from 'vscode-languageserver-protocol'

export class PythonHoverProvider implements HoverProvider {
  private itemInfoSource: ItemInfoSource

  constructor(jediFactory: JediFactory) {
    this.itemInfoSource = new ItemInfoSource(jediFactory)
  }

  public async provideHover(document: TextDocument, position: Position, token: CancellationToken)
    : Promise<Hover | undefined> {
    const itemInfos = await this.itemInfoSource.getItemInfoFromDocument(document, position, token)
    if (itemInfos) { // item.tooltip
      return {
        contents: itemInfos.map(item => {
          // tslint:disable-next-line: deprecation
          return { value: item.tooltip.value, language: item.tooltip.kind == 'markdown' ? 'markdown' : 'txt' } as MarkedString
        })
      } as Hover
    }
  }
}
