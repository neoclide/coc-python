import { Position, SymbolKind } from 'vscode-languageserver-protocol'

export interface ITag {
  fileName: string
  symbolName: string
  symbolKind: SymbolKind
  position: Position
  code: string
}
