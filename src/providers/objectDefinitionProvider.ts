'use strict'

import { commands, Disposable, workspace } from 'coc.nvim'
import { CancellationTokenSource, Position, Range, TextDocument } from 'vscode-languageserver-protocol'
import { JediFactory } from '../languageServices/jediProxyFactory'
import * as defProvider from './definitionProvider'

export class PythonObjectDefinitionProvider {
  private readonly _defProvider: defProvider.PythonDefinitionProvider
  public constructor(jediFactory: JediFactory) {
    this._defProvider = new defProvider.PythonDefinitionProvider(jediFactory)
  }

  public async goToObjectDefinition(): Promise<void> {
    const pathDef = await this.getObjectDefinition()
    if (typeof pathDef !== 'string' || pathDef.length === 0) {
      return
    }

    const parts = pathDef.split('.')
    let source = ''
    let startColumn = 0
    if (parts.length === 1) {
      source = `import ${parts[0]}`
      startColumn = 'import '.length
    } else {
      const mod = parts.shift()
      source = `from ${mod} import ${parts.join('.')}`
      startColumn = `from ${mod} import `.length
    }
    const range = Range.create(0, startColumn, 0, source.length - 1)
    // tslint:disable-next-line:no-any
    const doc = {
      fileName: 'test.py',
      lineAt: (_line: number) => {
        return { text: source }
      },
      getWordRangeAtPosition: (_position: Position) => range,
      isDirty: true,
      getText: () => source
    } as any as TextDocument

    const tokenSource = new CancellationTokenSource()
    const defs = await this._defProvider.provideDefinition(doc, range.start, tokenSource.token)

    if (defs === null) {
      workspace.showMessage(`Definition not found for '${pathDef}'`, 'warning')
      return
    }

    let uri: string | undefined
    let lineNumber: number
    if (Array.isArray(defs) && defs.length > 0) {
      uri = defs[0].uri
      lineNumber = defs[0].range.start.line
    }
    if (defs && !Array.isArray(defs) && defs.uri) {
      uri = defs.uri
      lineNumber = defs.range.start.line
    }

    if (uri) {
      await workspace.jumpTo(uri, Position.create(lineNumber, 0))
    } else {
      workspace.showMessage(`Definition not found for '${pathDef}'`, 'warning')
    }
  }

  private intputValidation(value: string): string | undefined | null {
    if (typeof value !== 'string') {
      return ''
    }
    value = value.trim()
    if (value.length === 0) {
      return ''
    }

    return value
  }
  private async getObjectDefinition(): Promise<string | undefined> {
    return workspace.requestInput('Enter Object path').then(res => {
      return this.intputValidation(res)
    })
  }
}

export function activateGoToObjectDefinitionProvider(jediFactory: JediFactory): Disposable[] {
  const def = new PythonObjectDefinitionProvider(jediFactory)
  const commandRegistration = commands.registerCommand('python.goToPythonObject', () => def.goToObjectDefinition())
  return [def, commandRegistration] as Disposable[]
}
