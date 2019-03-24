import { getTextEditsFromPatch } from '../common/editor'
import { IConfigurationService, IInstaller, Product, IPythonSettings } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { RefactorProxy } from '../refactor/proxy'
import { workspace, Document, ExtensionContext, OutputChannel, commands, Uri } from 'coc.nvim'
import { Range, Position } from 'vscode-languageserver-types'

interface RenameResponse {
  results: [{ diff: string }]
}

let installer: IInstaller

export function activateSimplePythonRefactorProvider(context: ExtensionContext, outputChannel: OutputChannel, serviceContainer: IServiceContainer): void {
  installer = serviceContainer.get<IInstaller>(IInstaller)
  let disposable = commands.registerCommand('python.refactorExtractVariable', async () => {
    const doc = await workspace.document
    const mode = await workspace.nvim.call('visualmode')
    const range = await workspace.getSelectedRange(mode, doc.textDocument)
    extractVariable(context.extensionPath,
      doc,
      range,
      // tslint:disable-next-line:no-empty
      outputChannel, serviceContainer).catch(() => { })
  })
  context.subscriptions.push(disposable)

  disposable = commands.registerCommand('python.refactorExtractMethod', async () => {
    const doc = await workspace.document
    const mode = await workspace.nvim.call('visualmode')
    const range = await workspace.getSelectedRange(mode, doc.textDocument)
    extractMethod(context.extensionPath,
      doc,
      range,
      // tslint:disable-next-line:no-empty
      outputChannel, serviceContainer).catch(() => { })
  })
  context.subscriptions.push(disposable)
}

// Exported for unit testing
export function extractVariable(extensionDir: string, textEditor: Document, range: Range,
  // tslint:disable-next-line:no-any
  outputChannel: OutputChannel, serviceContainer: IServiceContainer): Promise<any> {

  // const workspaceRoot = workspace.rootPath
  const config = workspace.getConfiguration('', textEditor.uri)
  const pythonSettings = config.get<IPythonSettings>('python')

  return validateDocumentForRefactor(textEditor).then(() => {
    const newName = `newvariable${new Date().getMilliseconds().toString()}`
    const proxy = new RefactorProxy(extensionDir, pythonSettings, Uri.file(workspace.rootPath).toString(), serviceContainer)
    const rename = proxy.extractVariable<RenameResponse>(textEditor.textDocument, newName, Uri.parse(textEditor.uri).fsPath, range).then(response => {
      return response.results[0].diff
    })

    return extractName(textEditor, newName, rename, outputChannel)
  })
}

// Exported for unit testing
export function extractMethod(extensionDir: string, textEditor: Document, range: Range,
  // tslint:disable-next-line:no-any
  outputChannel: OutputChannel, serviceContainer: IServiceContainer): Promise<any> {

  const workspaceRoot = workspace.rootPath
  const pythonSettings = serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.parse(workspaceRoot))

  return validateDocumentForRefactor(textEditor).then(() => {
    const newName = `newmethod${new Date().getMilliseconds().toString()}`
    const proxy = new RefactorProxy(extensionDir, pythonSettings, workspaceRoot, serviceContainer)
    const rename = proxy.extractMethod<RenameResponse>(textEditor.textDocument, newName, Uri.parse(textEditor.uri).fsPath, range).then(response => {
      return response.results[0].diff
    })

    return extractName(textEditor, newName, rename, outputChannel)
  })
}

// tslint:disable-next-line:no-any
function validateDocumentForRefactor(textEditor: Document): Promise<any> {
  if (!textEditor.dirty) {
    return Promise.resolve()
  }

  // tslint:disable-next-line:no-any
  return new Promise<any>((resolve, reject) => {
    // tslint:disable-next-line: no-floating-promises
    workspace.nvim.command('write').then(() => {
      return resolve()
    }, reject)
  })
}

function extractName(textEditor: Document, newName: string,
  // tslint:disable-next-line:no-any
  renameResponse: Promise<string>, outputChannel: OutputChannel): Promise<any> {
  let changeStartsAtLine = -1
  return renameResponse.then(diff => {
    if (diff.length === 0) {
      return []
    }
    return getTextEditsFromPatch(textEditor.getDocumentContent(), diff)
  }).then(edits => {
    edits.forEach(edit => {
      if (changeStartsAtLine === -1 || changeStartsAtLine > edit.range.start.line) {
        changeStartsAtLine = edit.range.start.line
      }
    })
    return textEditor.applyEdits(workspace.nvim, edits)
  }).then(() => {
    if (changeStartsAtLine >= 0) {
      let newWordPosition: Position | undefined
      for (let lineNumber = changeStartsAtLine; lineNumber < textEditor.lineCount; lineNumber += 1) {
        const line = textEditor.getline(lineNumber)
        const indexOfWord = line.indexOf(newName)
        if (indexOfWord >= 0) {
          newWordPosition = Position.create(lineNumber, indexOfWord)
          break
        }
      }
      return workspace.jumpTo(textEditor.uri, newWordPosition).then(() => {
        return newWordPosition
      })
    }
    return null
  }).then(newWordPosition => {
    if (newWordPosition) {
      return workspace.nvim.command('wa').then(() => {
        // Now that we have selected the new variable, lets invoke the rename command
        return commands.executeCommand('editor.action.rename')
      })
    }
  }).catch(error => {
    if (error === 'Not installed') {
      installer.promptToInstall(Product.rope, Uri.parse(textEditor.uri))
        .catch(ex => console.error('Python Extension: simpleRefactorProvider.promptToInstall', ex))
      return Promise.reject('')
    }
    let errorMessage = `${error}`
    if (typeof error === 'string') {
      errorMessage = error
    }
    if (typeof error === 'object' && error.message) {
      errorMessage = error.message
    }
    outputChannel.appendLine(`${'#'.repeat(10)}Refactor Output${'#'.repeat(10)}`)
    outputChannel.appendLine(`Error in refactoring:\n${errorMessage}`)
    workspace.showMessage(`Cannot perform refactoring using selected element(s). (${errorMessage})`, 'error')
    return Promise.reject(error)
  })
}
