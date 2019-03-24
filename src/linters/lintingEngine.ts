// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { DiagnosticCollection, Extension, languages, OutputChannel, Uri, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { Minimatch } from 'minimatch'
import path from 'path'
import { CancellationToken, CancellationTokenSource, Diagnostic, DiagnosticSeverity, DocumentFilter, Position, Range, TextDocument } from 'vscode-languageserver-protocol'
import { IDocumentManager } from '../common/application/types'
import { LinterErrors, STANDARD_OUTPUT_CHANNEL } from '../common/constants'
import { IFileSystem } from '../common/platform/types'
import { IConfigurationService, IOutputChannel } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { JupyterProvider } from '../jupyter/provider'
import { ILinterInfo, ILinterManager, ILintingEngine, ILintMessage, LintMessageSeverity } from './types'

const PYTHON: DocumentFilter = { language: 'python' }

const lintSeverityToVSSeverity = new Map<LintMessageSeverity, DiagnosticSeverity>()
lintSeverityToVSSeverity.set(LintMessageSeverity.Error, DiagnosticSeverity.Error)
lintSeverityToVSSeverity.set(LintMessageSeverity.Hint, DiagnosticSeverity.Hint)
lintSeverityToVSSeverity.set(LintMessageSeverity.Information, DiagnosticSeverity.Information)
lintSeverityToVSSeverity.set(LintMessageSeverity.Warning, DiagnosticSeverity.Warning)

// tslint:disable-next-line:interface-name
interface DocumentHasJupyterCodeCells {
  // tslint:disable-next-line:callable-types
  (doc: TextDocument, token: CancellationToken): Promise<Boolean>
}

@injectable()
export class LintingEngine implements ILintingEngine {
  private documentHasJupyterCodeCells: DocumentHasJupyterCodeCells
  private documents: IDocumentManager
  private configurationService: IConfigurationService
  private linterManager: ILinterManager
  private diagnosticCollection: DiagnosticCollection
  private pendingLintings = new Map<string, CancellationTokenSource>()
  private outputChannel: OutputChannel
  private fileSystem: IFileSystem

  constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    this.documentHasJupyterCodeCells = (_a, _b) => Promise.resolve(false)
    this.documents = serviceContainer.get<IDocumentManager>(IDocumentManager)
    this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService)
    this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
    this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager)
    this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem)
    this.diagnosticCollection = languages.createDiagnosticCollection('python')
  }

  public get diagnostics(): DiagnosticCollection {
    return this.diagnosticCollection
  }

  public clearDiagnostics(document: TextDocument): void {
    if (this.diagnosticCollection.has(document.uri)) {
      this.diagnosticCollection.delete(document.uri)
    }
  }

  public async lintOpenPythonFiles(): Promise<DiagnosticCollection> {
    this.diagnosticCollection.clear()
    const promises = this.documents.textDocuments.map(async document => this.lintDocument(document))
    await Promise.all(promises)
    return this.diagnosticCollection
  }

  public async lintDocument(document: TextDocument): Promise<void> {
    this.diagnosticCollection.set(document.uri, [])

    // Check if we need to lint this document
    if (!await this.shouldLintDocument(document)) {
      return
    }

    const fsPath = Uri.parse(document.uri).fsPath
    if (this.pendingLintings.has(fsPath)) {
      this.pendingLintings.get(fsPath)!.cancel()
      this.pendingLintings.delete(fsPath)
    }

    const cancelToken = new CancellationTokenSource()
    cancelToken.token.onCancellationRequested(() => {
      if (this.pendingLintings.has(fsPath)) {
        this.pendingLintings.delete(fsPath)
      }
    })

    this.pendingLintings.set(fsPath, cancelToken)

    const activeLinters = await this.linterManager.getActiveLinters(false, Uri.parse(document.uri))
    const promises: Promise<ILintMessage[]>[] = activeLinters
      .map(async (info: ILinterInfo) => {
        const linter = await this.linterManager.createLinter(
          info.product,
          this.outputChannel,
          this.serviceContainer,
          Uri.parse(document.uri)
        )
        const promise = linter.lint(document, cancelToken.token)
        return promise
      })

    const hasJupyterCodeCells = await this.documentHasJupyterCodeCells(document, cancelToken.token)
    // linters will resolve asynchronously - keep a track of all
    // diagnostics reported as them come in.
    let diagnostics: Diagnostic[] = []
    const settings = this.configurationService.getSettings(Uri.parse(document.uri))

    for (const p of promises) {
      const msgs = await p
      if (cancelToken.token.isCancellationRequested) {
        break
      }

      if (this.isDocumentOpen(document.uri)) {
        let doc = workspace.getDocument(document.uri)
        // Build the message and suffix the message with the name of the linter used.
        for (const m of msgs) {
          // Ignore magic commands from jupyter.
          if (hasJupyterCodeCells && doc.getline(m.line - 1).trim().startsWith('%') &&
            (m.code === LinterErrors.pylint.InvalidSyntax ||
              m.code === LinterErrors.prospector.InvalidSyntax ||
              m.code === LinterErrors.flake8.InvalidSyntax)) {
            continue
          }
          diagnostics.push(this.createDiagnostics(m, document))
        }
        // Limit the number of messages to the max value.
        diagnostics = diagnostics.filter((_value, index) => index <= settings.linting.maxNumberOfProblems)
      }
    }
    // Set all diagnostics found in this pass, as this method always clears existing diagnostics.
    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  // tslint:disable-next-line:no-any
  public async linkJupyterExtension(jupyter: Extension<any> | undefined): Promise<void> {
    if (!jupyter) {
      return
    }
    if (!jupyter.isActive) {
      await jupyter.activate()
    }
    // tslint:disable-next-line:no-unsafe-any
    jupyter.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider())
    // tslint:disable-next-line:no-unsafe-any
    this.documentHasJupyterCodeCells = jupyter.exports.hasCodeCells
  }

  private isDocumentOpen(uri: string): boolean {
    return workspace.getDocument(uri) != null
  }

  private createDiagnostics(message: ILintMessage, _document: TextDocument): Diagnostic {
    const position = Position.create(message.line - 1, message.column)
    const range = Range.create(position, position)

    const severity = lintSeverityToVSSeverity.get(message.severity!)!
    const diagnostic = Diagnostic.create(range, message.message, severity)
    diagnostic.code = message.code
    diagnostic.source = message.provider
    return diagnostic
  }

  private async shouldLintDocument(document: TextDocument): Promise<boolean> {
    if (!await this.linterManager.isLintingEnabled(false, Uri.parse(document.uri))) {
      this.diagnosticCollection.set(document.uri, [])
      return false
    }

    if (document.languageId !== PYTHON.language) {
      return false
    }

    // const workspaceFolder = this.workspace.getWorkspaceFolder(document.uri)
    // const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined
    const relativeFileName = path.relative(workspace.rootPath, Uri.parse(document.uri).fsPath)

    const settings = this.configurationService.getSettings(Uri.parse(document.uri))
    // { dot: true } is important so dirs like `.venv` will be matched by globs
    const ignoreMinmatches = settings.linting.ignorePatterns.map(pattern => new Minimatch(pattern, { dot: true }))
    if (ignoreMinmatches.some(matcher => matcher.match(Uri.parse(document.uri).fsPath) || matcher.match(relativeFileName))) {
      return false
    }
    let u = Uri.parse(document.uri)
    if (u.scheme !== 'file' || !u.fsPath) {
      return false
    }
    return this.fileSystem.fileExists(u.fsPath)
  }
}
