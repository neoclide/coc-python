import { Uri } from 'coc.nvim'
import { inject, injectable } from 'inversify'
import { IPersistentState, IPersistentStateFactory } from '../../common/types'
import { GlobalPythonPathUpdaterService } from './services/globalUpdaterService'
import { WorkspaceFolderPythonPathUpdaterService } from './services/workspaceFolderUpdaterService'
import { WorkspacePythonPathUpdaterService } from './services/workspaceUpdaterService'
import { IPythonPathUpdaterService, IPythonPathUpdaterServiceFactory } from './types'

@injectable()
export class PythonPathUpdaterServiceFactory implements IPythonPathUpdaterServiceFactory {
  private readonly globalStore: IPersistentState<string | undefined>
  private readonly workspaceStore: IPersistentState<string | undefined>

  constructor(@inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory) {
    // this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService)
    this.globalStore = stateFactory.createGlobalPersistentState('SelectedPythonPath', undefined)
    this.workspaceStore = stateFactory.createWorkspacePersistentState('SelectedPythonPath', undefined)
  }
  public getGlobalPythonPathConfigurationService(): IPythonPathUpdaterService {
    return new GlobalPythonPathUpdaterService(this.globalStore)
  }
  public getWorkspacePythonPathConfigurationService(wkspace: Uri): IPythonPathUpdaterService {
    return new WorkspacePythonPathUpdaterService(wkspace, this.workspaceStore)
  }
  public getWorkspaceFolderPythonPathConfigurationService(workspaceFolder: Uri): IPythonPathUpdaterService {
    return new WorkspaceFolderPythonPathUpdaterService(workspaceFolder, this.workspaceStore)
  }
}
