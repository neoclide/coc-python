// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable } from 'inversify'
import { DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { IApplicationShell } from '../../common/application/types'
import { IServiceContainer } from '../../ioc/types'
import { workspace } from 'coc.nvim'
import { IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService } from './types'

export interface MessageCommandPrompt {
  commandPrompts: {
    prompt: string
    command?: IDiagnosticCommand
  }[]
  message?: string
}

export const DiagnosticCommandPromptHandlerServiceId = 'DiagnosticCommandPromptHandlerServiceId'

@injectable()
export class DiagnosticCommandPromptHandlerService implements IDiagnosticHandlerService<MessageCommandPrompt> {
  private readonly appShell: IApplicationShell
  constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
    // this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell)
  }
  public async handle(diagnostic: IDiagnostic, options: MessageCommandPrompt = { commandPrompts: [] }): Promise<void> {
    const prompts = options.commandPrompts.map(option => option.prompt)
    const response = await this.displayMessage(options.message ? options.message : diagnostic.message, diagnostic.severity, prompts)
    if (!response) {
      return
    }
    const selectedOption = options.commandPrompts.find(option => option.prompt === response)
    if (selectedOption && selectedOption.command) {
      await selectedOption.command.invoke()
    }
  }
  private async showQuickPick(message: string, prompts: string[]): Promise<string | undefined> {
    let idx = await workspace.showQuickpick(prompts, message)
    if (idx == -1) return undefined
    return prompts[idx]
  }
  private async displayMessage(message: string, severity: DiagnosticSeverity, prompts: string[]): Promise<string | undefined> {
    switch (severity) {
      case DiagnosticSeverity.Error: {
        return this.showQuickPick(message, prompts)
      }
      case DiagnosticSeverity.Warning: {
        return this.showQuickPick(message, prompts)
      }
      default: {
        return this.showQuickPick(message, prompts)
      }
    }
  }
}
