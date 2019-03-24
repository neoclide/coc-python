'use strict'
import path from 'path'
import { Commands } from '../common/constants'
import { Disposable, commands, workspace } from 'coc.nvim'

export function activateUpdateSparkLibraryProvider(): Disposable {
  return commands.registerCommand(Commands.Update_SparkLibrary, updateSparkLibrary)
}

function updateSparkLibrary() {
  const pythonConfig = workspace.getConfiguration('python', null)
  const extraLibPath = 'autoComplete.extraPaths'
  // tslint:disable-next-line:no-invalid-template-strings
  const sparkHomePath = '${env:SPARK_HOME}'
  pythonConfig.update(extraLibPath, [path.join(sparkHomePath, 'python'), path.join(sparkHomePath, 'python/pyspark')], true)
  workspace.showMessage('Make sure you have SPARK_HOME environment variable set to the root path of the local spark installation!', 'more')
  // sendTelemetryEvent(EventName.UPDATE_PYSPARK_LIBRARY)
}
