import { ConfigurationTarget, Uri, workspace } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import * as path from 'path'
import { IServiceContainer } from '../../ioc/types'
import { IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from './types'

@injectable()
export class PythonPathUpdaterService implements IPythonPathUpdaterServiceManager {
  private readonly pythonPathSettingsUpdaterFactory: IPythonPathUpdaterServiceFactory
  constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
    this.pythonPathSettingsUpdaterFactory = serviceContainer.get<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory)
  }
  public async updatePythonPath(pythonPath: string, configTarget: ConfigurationTarget, trigger: 'ui' | 'shebang' | 'load', wkspace?: Uri): Promise<void> {
    // const stopWatch = new StopWatch()
    const pythonPathUpdater = this.getPythonUpdaterService(configTarget, wkspace)
    let failed = false
    try {
      await pythonPathUpdater.updatePythonPath(path.normalize(pythonPath), trigger)
    } catch (reason) {
      failed = true
      // tslint:disable-next-line:no-unsafe-any prefer-type-cast
      const message = reason && typeof reason.message === 'string' ? reason.message as string : ''
      workspace.showMessage(`Failed to set 'pythonPath'. Error: ${message}`, 'error')
      // tslint:disable-next-line: no-console
      console.error(reason)
    }
  }

  private getPythonUpdaterService(configTarget: ConfigurationTarget, wkspace?: Uri) {
    switch (configTarget) {
      case ConfigurationTarget.Global: {
        return this.pythonPathSettingsUpdaterFactory.getGlobalPythonPathConfigurationService()
      }
      case ConfigurationTarget.Workspace: {
        if (!wkspace) {
          throw new Error('Workspace Uri not defined')
        }
        // tslint:disable-next-line:no-non-null-assertion
        return this.pythonPathSettingsUpdaterFactory.getWorkspacePythonPathConfigurationService(wkspace!)
      }
      default: {
        if (!wkspace) {
          throw new Error('Workspace Uri not defined')
        }
        // tslint:disable-next-line:no-non-null-assertion
        return this.pythonPathSettingsUpdaterFactory.getWorkspaceFolderPythonPathConfigurationService(wkspace!)
      }
    }
  }
}
