// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from 'coc.nvim'
import { IDisposable } from '../common/types'

export const ICodeExecutionService = Symbol('ICodeExecutionService')

export interface ICodeExecutionService {
  execute(code: string, resource?: Uri): Promise<void>
  executeFile(file: Uri): Promise<void>
  initializeRepl(resource?: Uri): Promise<void>
}

export const ICodeExecutionHelper = Symbol('ICodeExecutionHelper')

export interface ICodeExecutionHelper {
  normalizeLines(code: string): Promise<string>
  getFileToExecute(): Promise<Uri | undefined>
  getSelectedTextToExecute(mode: string): Promise<string | undefined>
}

export const ICodeExecutionManager = Symbol('ICodeExecutionManager')

export interface ICodeExecutionManager {
  onExecutedCode: Event<string>
  registerCommands(): void
}

export const ITerminalAutoActivation = Symbol('ITerminalAutoActivation')
export interface ITerminalAutoActivation extends IDisposable {
  register(): void
}
