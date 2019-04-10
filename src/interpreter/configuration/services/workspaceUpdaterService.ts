import { Uri } from 'coc.nvim'
import { IPersistentState } from '../../../common/types'
import { IPythonPathUpdaterService } from '../types'

export class WorkspacePythonPathUpdaterService implements IPythonPathUpdaterService {
  constructor(private workspace: Uri, private readonly workspaceStore: IPersistentState<string | undefined>) {
  }
  public async updatePythonPath(pythonPath: string, trigger: 'ui' | 'shebang' | 'load'): Promise<void> {
    const pythonPathValue = this.workspaceStore.value
    if (pythonPathValue && trigger != 'ui') {
      return
    }
    if (pythonPathValue && pythonPathValue == pythonPath) {
      return
    }
    await this.workspaceStore.updateValue(pythonPath)
  }
}
