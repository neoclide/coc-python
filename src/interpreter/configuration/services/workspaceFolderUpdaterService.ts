import { Uri } from 'coc.nvim'
import * as path from 'path'
import { IWorkspaceService } from '../../../common/application/types'
import { IPythonPathUpdaterService } from '../types'

export class WorkspaceFolderPythonPathUpdaterService implements IPythonPathUpdaterService {
  constructor(private workspaceFolder: Uri, private readonly workspaceService: IWorkspaceService) {
  }
  public async updatePythonPath(pythonPath: string): Promise<void> {
    const pythonConfig = this.workspaceService.getConfiguration('python', this.workspaceFolder)
    const pythonPathValue = pythonConfig.inspect<string>('pythonPath')

    if (pythonPathValue && pythonPathValue.workspaceValue === pythonPath) {
      return
    }
    if (pythonPath.toLowerCase().startsWith(this.workspaceFolder.fsPath.toLowerCase())) {
      pythonPath = path.relative(this.workspaceFolder.fsPath, pythonPath)
    }
    pythonConfig.update('pythonPath', pythonPath, false)
  }
}
