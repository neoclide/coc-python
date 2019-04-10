import { IPythonPathUpdaterService } from '../types'
import { IPersistentState } from '../../../common/types'

export class GlobalPythonPathUpdaterService implements IPythonPathUpdaterService {
  constructor(private readonly store: IPersistentState<string | undefined>) { }
  public async updatePythonPath(pythonPath: string, trigger: 'ui' | 'shebang' | 'load'): Promise<void> {
    let val = this.store.value
    if (val && trigger != 'ui') {
      return
    }
    if (val && val == pythonPath) {
      return
    }
    await this.store.updateValue(pythonPath)
  }
}
