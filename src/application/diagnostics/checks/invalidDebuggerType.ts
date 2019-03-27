// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable } from 'inversify'
import { DiagnosticSeverity } from 'vscode-languageserver-protocol'
import { IFileSystem } from '../../../common/platform/types'
import { Resource } from '../../../common/types'
import { IServiceContainer } from '../../../ioc/types'
import { BaseDiagnostic, BaseDiagnosticsService } from '../base'
import { DiagnosticCodes } from '../constants'
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler'
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types'

const InvalidDebuggerTypeMessage =
  'Your launch.json file needs to be updated to change the "pythonExperimental" debug ' +
  'configurations to use the "python" debugger type, otherwise Python debugging may ' +
  'not work. Would you like to automatically update your launch.json file now?'

export class InvalidDebuggerTypeDiagnostic extends BaseDiagnostic {
  constructor(message: string, resource: Resource) {
    super(
      DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
      message,
      DiagnosticSeverity.Error,
      DiagnosticScope.WorkspaceFolder,
      resource,
      'always'
    )
  }
}

export const InvalidDebuggerTypeDiagnosticsServiceId = 'InvalidDebuggerTypeDiagnosticsServiceId'

@injectable()
export class InvalidDebuggerTypeDiagnosticsService extends BaseDiagnosticsService {
  protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>
  protected readonly fs: IFileSystem
  constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
    super([DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer, true)
    this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(
      IDiagnosticHandlerService,
      DiagnosticCommandPromptHandlerServiceId
    )
    this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem)
  }
  public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
    return []
  }
  protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
    // This class can only handle one type of diagnostic, hence just use first item in list.
    if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
      return
    }
  }
}
