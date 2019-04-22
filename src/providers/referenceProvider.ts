'use strict'

import { JediFactory } from '../languageServices/jediProxyFactory'
import * as proxy from './jediProxy'
import { ReferenceProvider, workspace, Uri } from 'coc.nvim'
import { Location, TextDocument, Range, Position, ReferenceContext, CancellationToken } from 'vscode-languageserver-protocol'

export class PythonReferenceProvider implements ReferenceProvider {
  public constructor(private jediFactory: JediFactory) { }
  private static parseData(data: proxy.IReferenceResult): Location[] {
    if (data && data.references.length > 0) {
      // tslint:disable-next-line:no-unnecessary-local-variable
      const references = data.references.filter(ref => {
        if (!ref || typeof ref.columnIndex !== 'number' || typeof ref.lineIndex !== 'number'
          || typeof ref.fileName !== 'string' || ref.columnIndex === -1 || ref.lineIndex === -1 || ref.fileName.length === 0) {
          return false
        }
        return true
      }).map(ref => {
        const definitionResource = Uri.file(ref.fileName)
        const range = Range.create(ref.lineIndex, ref.columnIndex, ref.lineIndex, ref.columnIndex)

        return Location.create(definitionResource.toString(), range)
      })

      return references
    }
    return []
  }

  public async provideReferences(document: TextDocument, position: Position, _context: ReferenceContext, token: CancellationToken): Promise<Location[] | undefined> {
    const doc = workspace.getDocument(document.uri)
    const filename = Uri.parse(doc.uri).fsPath
    if (doc.getline(position.line).match(/^\s*\/\//)) {
      return
    }

    const range = doc.getWordRangeAtPosition(position)
    if (!range) {
      return
    }
    const isEmpty = range.start.line == range.end.line && range.start.character == range.end.character
    const columnIndex = isEmpty ? position.character : range.end.character
    const cmd: proxy.ICommand = {
      command: proxy.CommandType.Usages,
      fileName: filename,
      columnIndex,
      lineIndex: position.line
    }

    if (doc.dirty) {
      cmd.source = doc.getDocumentContent()
    }

    const data = await this.jediFactory.getJediProxyHandler<proxy.IReferenceResult>(Uri.parse(document.uri)).sendCommand(cmd, token)
    return data ? PythonReferenceProvider.parseData(data) : undefined
  }
}
