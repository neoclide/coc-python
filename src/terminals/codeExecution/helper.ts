// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import path from 'path'
import { IApplicationShell, IDocumentManager } from '../../common/application/types'
import { EXTENSION_ROOT_DIR } from '../../common/constants'
import { IProcessServiceFactory } from '../../common/process/types'
import { IConfigurationService } from '../../common/types'
import { IServiceContainer } from '../../ioc/types'
import { ICodeExecutionHelper } from '../types'

@injectable()
export class CodeExecutionHelper implements ICodeExecutionHelper {
  private readonly processServiceFactory: IProcessServiceFactory
  private readonly configurationService: IConfigurationService
  constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
    this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory)
    this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService)
  }
  public async normalizeLines(code: string, resource?: Uri): Promise<string> {
    try {
      if (code.trim().length === 0) {
        return ''
      }
      const pythonPath = this.configurationService.getSettings(resource).pythonPath
      const args = [path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'normalizeForInterpreter.py'), code]
      const processService = await this.processServiceFactory.create(resource)
      const proc = await processService.exec(pythonPath, args, { throwOnStdErr: true })

      return proc.stdout
    } catch (ex) {
      // tslint:disable-next-line: no-console
      console.error(ex, 'Python: Failed to normalize code for execution in terminal')
      return code
    }
  }

  public async getFileToExecute(): Promise<Uri | undefined> {
    const doc = workspace.getDocument(workspace.bufnr)
    if (!doc || doc.filetype != 'python' || doc.schema !== 'file') {
      workspace.showMessage('Python file required to run in terminal', 'error')
      return
    }
    await workspace.nvim.command('write')
    return Uri.parse(doc.uri)
  }

  public async getSelectedTextToExecute(mode: string): Promise<string | undefined> {
    let doc = workspace.getDocument(workspace.bufnr)
    if (!doc) return
    let range = await workspace.getSelectedRange(mode, doc)
    if (range) return doc.textDocument.getText(range)
  }
}
