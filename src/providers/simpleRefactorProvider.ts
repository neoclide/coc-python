import { getTextEditsFromPatch } from '../common/editor'
import { IConfigurationService, IInstaller, Product, IPythonSettings } from '../common/types'
import { Commands } from '../common/constants'
import { IServiceContainer } from '../ioc/types'
import { RefactorProxy } from '../refactor/proxy'
import { workspace, languages, CodeActionProvider, Document, ExtensionContext, OutputChannel, commands, Uri } from 'coc.nvim'
import { Range, Position, TextDocument, CodeActionContext, Command, CodeActionKind } from 'vscode-languageserver-types'
import { CancellationToken } from 'vscode-languageserver-protocol'

interface RenameResponse {
  results: [{ diff: string }]
}

let installer: IInstaller

async function checkDocument(uri: string): Promise<boolean> {
  let doc = workspace.getDocument(uri)
  if (!doc) return false
  let modified = await doc.buffer.getOption('modified')
  if (modified != 0) {
    workspace.showMessage('Buffer not saved, please save the buffer first!', 'warning')
    return false
  }
  return true
}

export function activateSimplePythonRefactorProvider(context: ExtensionContext, outputChannel: OutputChannel, serviceContainer: IServiceContainer): void {
  installer = serviceContainer.get<IInstaller>(IInstaller)
  let disposable = commands.registerCommand(Commands.Refactor_Extract_Variable, async (document: TextDocument, range: Range) => {
    let valid = await checkDocument(document.uri)
    if (!valid) return
    extractVariable(context.extensionPath,
      workspace.getDocument(document.uri),
      range,
      // tslint:disable-next-line:no-empty
      outputChannel, serviceContainer).catch(() => { })
  }, null, true)
  context.subscriptions.push(disposable)

  disposable = commands.registerCommand(Commands.Refactor_Extract_Method, async (document: TextDocument, range: Range) => {
    let valid = await checkDocument(document.uri)
    if (!valid) return
    extractMethod(context.extensionPath,
      workspace.getDocument(document.uri),
      range,
      // tslint:disable-next-line:no-empty
      outputChannel, serviceContainer).catch(() => { })
  }, null, true)
  context.subscriptions.push(disposable)

  let provider: CodeActionProvider = {
    provideCodeActions: (document: TextDocument, range: Range, actionContext: CodeActionContext, _token: CancellationToken): Command[] => {
      let commands: Command[] = []
      if (actionContext.only && !actionContext.only.includes(CodeActionKind.Refactor)) return []
      commands.push({
        command: Commands.Refactor_Extract_Variable,
        title: 'Extract Variable',
        arguments: [document, range]
      })
      commands.push({
        command: Commands.Refactor_Extract_Method,
        title: 'Extract Method',
        arguments: [document, range]
      })
      return commands
    }
  }
  languages.registerCodeActionProvider(['python'], provider, 'python.simpleRefactor', [CodeActionKind.Refactor])
}

// Exported for unit testing
export function extractVariable(extensionDir: string, textEditor: Document, range: Range,
  // tslint:disable-next-line:no-any
  outputChannel: OutputChannel, serviceContainer: IServiceContainer): Promise<any> {
  let workspaceFolder = workspace.getWorkspaceFolder(textEditor.uri)
  let workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd

  const pythonSettings = serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.file(workspaceRoot))

  return validateDocumentForRefactor(textEditor).then(() => {
    const newName = `newvariable${new Date().getMilliseconds().toString()}`
    const proxy = new RefactorProxy(extensionDir, pythonSettings, workspaceRoot, serviceContainer)
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
  let workspaceFolder = workspace.getWorkspaceFolder(textEditor.uri)
  let workspaceRoot = workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : workspace.cwd

  const pythonSettings = serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(Uri.file(workspaceRoot))

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
        return commands.executeCommand('editor.action.rename', textEditor.uri, newWordPosition)
      })
    }
  }).catch(error => {
    if (error === 'Not installed') {
      installer.promptToInstall(Product.rope, Uri.parse(textEditor.uri))
        // tslint:disable-next-line: no-console
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
