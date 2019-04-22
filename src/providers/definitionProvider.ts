'use strict'

import { JediFactory } from '../languageServices/jediProxyFactory'
import * as proxy from './jediProxy'
import { Uri, DefinitionProvider, workspace } from 'coc.nvim'
import { Range, Definition, Location, Position, CancellationToken, TextDocument } from 'vscode-languageserver-protocol'

export class PythonDefinitionProvider implements DefinitionProvider {
  public constructor(private jediFactory: JediFactory) { }
  private static parseData(data: proxy.IDefinitionResult, possibleWord: string): Definition | undefined {
    if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
      const definitions = data.definitions.filter(d => d.text === possibleWord)
      const definition = definitions.length > 0 ? definitions[0] : data.definitions[data.definitions.length - 1]
      const definitionResource = Uri.file(definition.fileName)
      const range = Range.create(
        definition.range.startLine, definition.range.startColumn,
        definition.range.endLine, definition.range.endColumn)
      return Location.create(definitionResource.toString(), range)
    }
  }

  public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | undefined> {
    const doc = workspace.getDocument(document.uri)
    const filename = Uri.parse(document.uri).fsPath
    if (doc.getline(position.line).match(/^\s*\/\//)) {
      return
    }
    if (position.character < 0) {
      return
    }

    const range = doc.getWordRangeAtPosition(position)
    if (!range) {
      return
    }
    const isEmpty = range.start.line == range.end.line && range.start.character == range.end.character
    const columnIndex = isEmpty ? position.character : range.end.character
    const cmd: proxy.ICommand = {
      command: proxy.CommandType.Definitions,
      fileName: filename,
      columnIndex,
      lineIndex: position.line
    }
    if (doc.dirty) {
      cmd.source = doc.getDocumentContent()
    }
    const possibleWord = document.getText(range)
    const data = await this.jediFactory.getJediProxyHandler<proxy.IDefinitionResult>(Uri.parse(document.uri)).sendCommand(cmd, token)
    return data ? PythonDefinitionProvider.parseData(data, possibleWord) : undefined
  }
}
