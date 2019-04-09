// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { Uri, workspace } from 'coc.nvim'
import path from 'path'
import { inject, injectable } from 'inversify'
import which from 'which'
import { IWorkspaceService } from '../../../common/application/types'
import { traceVerbose } from '../../../common/logger'
import { IFileSystem } from '../../../common/platform/types'
import { IPersistentStateFactory, Resource } from '../../../common/types'
import { IPythonPathUpdaterServiceManager } from '../../configuration/types'
import { IInterpreterHelper, PythonInterpreter, InterpreterType } from '../../contracts'
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types'
import { BaseRuleService, NextAction } from './baseRule'

/**
 * EnvironmentAutoSelectionRule check current python path, if inside workspaceFolder, then use it.
 * @public
 *
 * @extends {BaseRuleService}
 */
@injectable()
export class EnvironmentAutoSelectionRule extends BaseRuleService {
  constructor(
    @inject(IFileSystem) fs: IFileSystem,
    @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
    @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
    @inject(IPythonPathUpdaterServiceManager) private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
    @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService) {

    super(AutoSelectionRule.environment, fs, stateFactory)
  }
  protected async onAutoSelectInterpreter(resource: Resource, manager?: IInterpreterAutoSelectionService): Promise<NextAction> {
    const workspacePath = this.helper.getActiveWorkspaceUri(resource)
    if (!workspacePath) {
      return NextAction.runNextRule
    }
    const interpreters = await this.getWorkspaceEnvironmentInterpreters(resource)
    let bestInterpreter: PythonInterpreter | undefined
    if (Array.isArray(interpreters) && interpreters.length > 0) {
      bestInterpreter = this.helper.getBestInterpreter(interpreters)
    }
    if (bestInterpreter && manager) {
      await this.cacheSelectedInterpreter(workspacePath.folderUri, bestInterpreter)
      await manager.setWorkspaceInterpreter(workspacePath.folderUri!, bestInterpreter)
    }
    traceVerbose(`Selected Interpreter from ${this.ruleName}, ${bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'}`)
    return bestInterpreter ? NextAction.exit : NextAction.runNextRule
  }

  protected async getWorkspaceEnvironmentInterpreters(resource: Resource): Promise<PythonInterpreter[] | undefined> {
    const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource)
    if (!workspaceFolder) {
      return
    }
    let folder = Uri.parse(workspaceFolder.uri).fsPath
    let paths = await Promise.all(['python', 'python3'].map(cmd => {
      return this.executablePath(cmd)
    }))
    paths = paths.filter(p => p != null && p.toLowerCase().startsWith(folder.toLowerCase()))
    if (paths.length == 0) {
      let cmds = ['python', 'python3'].map(p => {
        return path.join(folder, 'bin', p)
      })
      paths = await Promise.all(cmds.map(cmd => {
        return workspace.nvim.call('executable', cmd).then(res => {
          return res == 1 ? cmd : null
        })
      }))
      paths = paths.filter(p => !!p)
    }
    let interpreters = await Promise.all(paths.map(pythonPath => {
      return this.getInterpreterDetails(pythonPath)
    }))
    return interpreters.filter(s => s != null)
  }

  private async getInterpreterDetails(pythonPath: string): Promise<PythonInterpreter | undefined> {
    return this.helper.getInterpreterInformation(pythonPath)
      .then(details => {
        if (!details) {
          return
        }
        return {
          ...(details as PythonInterpreter),
          path: pythonPath,
          type: details.type ? details.type : InterpreterType.VirtualEnv
        }
      })
  }

  protected async cacheSelectedInterpreter(resource: Resource, interpreter: PythonInterpreter | undefined) {
    // We should never clear settings in user settings.json.
    if (!interpreter) {
      await super.cacheSelectedInterpreter(resource, interpreter)
      return
    }
    const activeWorkspace = this.helper.getActiveWorkspaceUri(resource)
    if (!activeWorkspace) {
      return
    }
    await this.pythonPathUpdaterService.updatePythonPath(interpreter.path, activeWorkspace.configTarget, 'load', activeWorkspace.folderUri)
    await super.cacheSelectedInterpreter(resource, interpreter)
  }

  private async executablePath(cmd: string): Promise<string | null> {
    return new Promise(resolve => {
      which(cmd, (err, path) => {
        if (err) return resolve(null)
        resolve(path)
      })
    })
  }
}
