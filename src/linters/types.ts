// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'

import { ExecutionInfo, Product } from '../common/types'
import { IServiceContainer } from '../ioc/types'
import { Uri, OutputChannel, DiagnosticCollection, Extension } from 'coc.nvim'
import { TextDocument, CancellationToken } from 'vscode-languageserver-protocol'

export interface IErrorHandler {
  handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: Use an enum for LinterID instead of a union of string literals.
export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint' | 'bandit'

export interface ILinterInfo {
  readonly id: LinterId
  readonly product: Product
  readonly pathSettingName: string
  readonly argsSettingName: string
  readonly enabledSettingName: string
  readonly configFileNames: string[]
  enableAsync(enabled: boolean, resource?: Uri): Promise<void>
  isEnabled(resource?: Uri): boolean
  pathName(resource?: Uri): string
  linterArgs(resource?: Uri): string[]
  getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo
}

export interface ILinter {
  readonly info: ILinterInfo
  lint(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]>
}

export const IAvailableLinterActivator = Symbol('IAvailableLinterActivator')
export interface IAvailableLinterActivator {
  promptIfLinterAvailable(linter: ILinterInfo, resource?: Uri): Promise<boolean>
}

export const ILinterManager = Symbol('ILinterManager')
export interface ILinterManager {
  getAllLinterInfos(): ILinterInfo[]
  getLinterInfo(product: Product): ILinterInfo
  getActiveLinters(silent: boolean, resource?: Uri): Promise<ILinterInfo[]>
  isLintingEnabled(silent: boolean, resource?: Uri): Promise<boolean>
  enableLintingAsync(enable: boolean, resource?: Uri): Promise<void>
  setActiveLintersAsync(products: Product[], resource?: Uri): Promise<void>
  createLinter(product: Product, outputChannel: OutputChannel, serviceContainer: IServiceContainer, resource?: Uri): Promise<ILinter>
}

export interface ILintMessage {
  line: number
  column: number
  code: string | undefined
  message: string
  type: string
  severity?: LintMessageSeverity
  provider: string
}
export enum LintMessageSeverity {
  Hint,
  Error,
  Warning,
  Information
}

export const ILintingEngine = Symbol('ILintingEngine')
export interface ILintingEngine {
  readonly diagnostics: DiagnosticCollection
  lintOpenPythonFiles(): Promise<DiagnosticCollection>
  lintDocument(document: TextDocument): Promise<void>
  // tslint:disable-next-line:no-any
  linkJupyterExtension(jupyter: Extension<any> | undefined): Promise<void>
  clearDiagnostics(document: TextDocument): void
}
