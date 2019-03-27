'use strict'
// tslint:disable:no-var-requires no-require-imports

// This line should always be right on top.
// tslint:disable:no-any
require('reflect-metadata')
// Initialize source maps (this must never be moved up nor further down).
import { Disposable, ExtensionContext, languages, Memento, OutputChannel, Uri, workspace } from 'coc.nvim'
import { Container } from 'inversify'
import { CodeActionKind } from 'vscode-languageserver-protocol'
import { registerTypes as activationRegisterTypes } from './activation/serviceRegistry'
import { IExtensionActivationManager, ILanguageServerExtension } from './activation/types'
import { buildApi, IExtensionApi } from './api'
import { registerTypes as appRegisterTypes } from './application/serviceRegistry'
import { IApplicationDiagnostics } from './application/types'
import { ICommandManager, IWorkspaceService } from './common/application/types'
import { Commands, PYTHON, STANDARD_OUTPUT_CHANNEL } from './common/constants'
import { registerTypes as registerDotNetTypes } from './common/dotnet/serviceRegistry'
import { registerTypes as installerRegisterTypes } from './common/installer/serviceRegistry'
import { registerTypes as platformRegisterTypes } from './common/platform/serviceRegistry'
import { registerTypes as processRegisterTypes } from './common/process/serviceRegistry'
import { registerTypes as commonRegisterTypes } from './common/serviceRegistry'
// import { ITerminalHelper } from './common/terminal/types'
import {
  GLOBAL_MEMENTO, IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry, IExtensionContext, IFeatureDeprecationManager, IMemento, IOutputChannel,
  // Resource,
  WORKSPACE_MEMENTO
} from './common/types'
import { createDeferred } from './common/utils/async'
import { StopWatch } from './common/utils/stopWatch'
// import { Common } from './common/utils/localize'
import { registerTypes as variableRegisterTypes } from './common/variables/serviceRegistry'
import { registerTypes as formattersRegisterTypes } from './formatters/serviceRegistry'
import { IInterpreterSelector } from './interpreter/configuration/types'
import {
  // ICondaService,
  IInterpreterLocatorProgressService, IInterpreterService, InterpreterLocatorProgressHandler
} from './interpreter/contracts'
import { registerTypes as interpretersRegisterTypes } from './interpreter/serviceRegistry'
import { ServiceContainer } from './ioc/container'
import { ServiceManager } from './ioc/serviceManager'
import { IServiceContainer, IServiceManager } from './ioc/types'
import { LinterCommands } from './linters/linterCommands'
import { registerTypes as lintersRegisterTypes } from './linters/serviceRegistry'
// import { ILintingEngine } from './linters/types'
import { PythonCodeActionProvider } from './providers/codeActionsProvider'
import { PythonFormattingEditProvider } from './providers/formatProvider'
import { LinterProvider } from './providers/linterProvider'
import { ReplProvider } from './providers/replProvider'
import { registerTypes as providersRegisterTypes } from './providers/serviceRegistry'
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider'
import { TerminalProvider } from './providers/terminalProvider'
import { ISortImportsEditingProvider } from './providers/types'
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider'
import { initialize } from './sourceMapSupport'
import { registerTypes as commonRegisterTerminalTypes } from './terminals/serviceRegistry'
import { ICodeExecutionManager, ITerminalAutoActivation } from './terminals/types'
initialize()
const durations: Record<string, number> = {}
// Do not move this line of code (used to measure extension load times).
const stopWatch = new StopWatch()

// import { TEST_OUTPUT_CHANNEL } from './unittests/common/constants'
// import { ITestContextService } from './unittests/common/types'
// import { ITestCodeNavigatorCommandHandler, ITestExplorerCommandHandler } from './unittests/navigation/types'
// import { registerTypes as unitTestsRegisterTypes } from './unittests/serviceRegistry'

durations.codeLoadingTime = stopWatch.elapsedTime
const activationDeferred = createDeferred<void>()
let activatedServiceContainer: ServiceContainer | undefined

export async function activate(context: ExtensionContext): Promise<IExtensionApi> {
  let statusItem = workspace.createStatusBarItem(0, { progress: true })
  statusItem.text = 'loading python extension.'
  statusItem.show()
  try {
    let res = await activateUnsafe(context)
    statusItem.dispose()
    return res
  } catch (ex) {
    statusItem.dispose()
    // handleError(ex)
    throw ex  // re-raise
  }
}

// tslint:disable-next-line:max-func-body-length
async function activateUnsafe(context: ExtensionContext): Promise<IExtensionApi> {
  // displayProgress(activationDeferred.promise)
  durations.startActivateTime = stopWatch.elapsedTime
  const cont = new Container()
  const serviceManager = new ServiceManager(cont)
  const serviceContainer = new ServiceContainer(cont)
  activatedServiceContainer = serviceContainer
  registerServices(context, serviceManager, serviceContainer)
  await initializeServices(context, serviceManager, serviceContainer)

  const manager = serviceContainer.get<IExtensionActivationManager>(IExtensionActivationManager)
  context.subscriptions.push(manager)
  const activationPromise = manager.activate()

  serviceManager.get<ITerminalAutoActivation>(ITerminalAutoActivation).register()
  const configuration = serviceManager.get<IConfigurationService>(IConfigurationService)
  const pythonSettings = configuration.getSettings()

  const standardOutputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
  activateSimplePythonRefactorProvider(context, standardOutputChannel, serviceContainer)

  const sortImports = serviceContainer.get<ISortImportsEditingProvider>(ISortImportsEditingProvider)
  sortImports.registerCommands()

  serviceManager.get<ICodeExecutionManager>(ICodeExecutionManager).registerCommands()

  // tslint:disable-next-line:no-suspicious-comment
  // TODO: Move this down to right before durations.endActivateTime is set.
  // sendStartupTelemetry(Promise.all([activationDeferred.promise, activationPromise]), serviceContainer).catch(emptyFn)

  const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService)
  const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService)
  interpreterManager.refresh(Uri.file(workspace.rootPath))
    // tslint:disable-next-line: no-console
    .catch(ex => console.error('Python Extension: interpreterManager.refresh', ex))

  // const jupyterExtension = extensions.getExtension('donjayamanne.jupyter')
  // const lintingEngine = serviceManager.get<ILintingEngine>(ILintingEngine)
  // lintingEngine.linkJupyterExtension(jupyterExtension).catch(emptyFn)

  context.subscriptions.push(new LinterCommands(serviceManager))
  const linterProvider = new LinterProvider(context, serviceManager)
  context.subscriptions.push(linterProvider)

  if (pythonSettings && pythonSettings.formatting && pythonSettings.formatting.provider !== 'none') {
    const formatProvider = new PythonFormattingEditProvider(context, serviceContainer)
    context.subscriptions.push(languages.registerDocumentFormatProvider(PYTHON, formatProvider))
    context.subscriptions.push(languages.registerDocumentRangeFormatProvider(PYTHON, formatProvider))
  }

  const deprecationMgr = serviceContainer.get<IFeatureDeprecationManager>(IFeatureDeprecationManager)
  deprecationMgr.initialize()
  context.subscriptions.push(deprecationMgr)

  context.subscriptions.push(activateUpdateSparkLibraryProvider())

  context.subscriptions.push(new ReplProvider(serviceContainer))
  context.subscriptions.push(new TerminalProvider(serviceContainer))

  context.subscriptions.push(languages.registerCodeActionProvider(PYTHON, new PythonCodeActionProvider(), 'python', [CodeActionKind.SourceOrganizeImports]))

  durations.endActivateTime = stopWatch.elapsedTime
  activationDeferred.resolve()

  const api = buildApi(Promise.all([activationDeferred.promise, activationPromise]))
  // In test environment return the DI Container.
  return api as any
}

export function deactivate(): Thenable<void> {
  // Make sure to shutdown anybody who needs it.
  if (activatedServiceContainer) {
    const registry = activatedServiceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry)
    if (registry) {
      return registry.dispose()
    }
  }

  return Promise.resolve()
}

// tslint:disable-next-line:no-any
// function displayProgress(promise: Promise<any>) {
//
//   const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension() }
//   window.withProgress(progressOptions, () => promise)
// }
//
function registerServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
  serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer)
  serviceManager.addSingletonInstance<IServiceManager>(IServiceManager, serviceManager)
  serviceManager.addSingletonInstance<Disposable[]>(IDisposableRegistry, context.subscriptions)
  serviceManager.addSingletonInstance<Memento>(IMemento, context.globalState, GLOBAL_MEMENTO)
  serviceManager.addSingletonInstance<Memento>(IMemento, context.workspaceState, WORKSPACE_MEMENTO)
  serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, context)

  const standardOutputChannel = workspace.createOutputChannel('Python')
  // const unitTestOutChannel = window.createOutputChannel('Python Test Log')
  serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, standardOutputChannel, STANDARD_OUTPUT_CHANNEL)
  // serviceManager.addSingletonInstance<OutputChannel>(IOutputChannel, unitTestOutChannel, TEST_OUTPUT_CHANNEL)

  activationRegisterTypes(serviceManager)
  commonRegisterTypes(serviceManager)
  registerDotNetTypes(serviceManager)
  processRegisterTypes(serviceManager)
  variableRegisterTypes(serviceManager)
  lintersRegisterTypes(serviceManager)
  interpretersRegisterTypes(serviceManager)
  formattersRegisterTypes(serviceManager)
  platformRegisterTypes(serviceManager)
  installerRegisterTypes(serviceManager)
  commonRegisterTerminalTypes(serviceManager)
  // unitTestsRegisterTypes(serviceManager)
  // dataScienceRegisterTypes(serviceManager)
  // debugConfigurationRegisterTypes(serviceManager)
  appRegisterTypes(serviceManager)
  providersRegisterTypes(serviceManager)
}

async function initializeServices(context: ExtensionContext, serviceManager: ServiceManager, serviceContainer: ServiceContainer) {
  const selector = serviceContainer.get<IInterpreterSelector>(IInterpreterSelector)
  selector.initialize()
  context.subscriptions.push(selector)

  const interpreterManager = serviceContainer.get<IInterpreterService>(IInterpreterService)
  interpreterManager.initialize()

  // const handlers = serviceManager.getAll<IDebugSessionEventHandlers>(IDebugSessionEventHandlers)
  const disposables = serviceManager.get<IDisposableRegistry>(IDisposableRegistry)
  // const dispatcher = new DebugSessionEventDispatcher(handlers, DebugService.instance, disposables)
  // dispatcher.registerEventHandlers()

  const cmdManager = serviceContainer.get<ICommandManager>(ICommandManager)
  const outputChannel = serviceManager.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL)
  disposables.push(cmdManager.registerCommand(Commands.ViewOutput, () => outputChannel.show()))

  // Display progress of interpreter refreshes only after extension has activated.
  serviceContainer.get<InterpreterLocatorProgressHandler>(InterpreterLocatorProgressHandler).register()
  serviceContainer.get<IInterpreterLocatorProgressService>(IInterpreterLocatorProgressService).register()
  serviceContainer.get<IApplicationDiagnostics>(IApplicationDiagnostics).register()
  serviceContainer.get<ILanguageServerExtension>(ILanguageServerExtension).register()
  // serviceContainer.get<ITestCodeNavigatorCommandHandler>(ITestCodeNavigatorCommandHandler).register()
  // serviceContainer.get<ITestExplorerCommandHandler>(ITestExplorerCommandHandler).register()
  // serviceContainer.get<ITestContextService>(ITestContextService).register()
}

// tslint:disable-next-line:no-any
// async function sendStartupTelemetry(activatedPromise: Promise<any>, serviceContainer: IServiceContainer) {
//   try {
//     await activatedPromise
//     durations.totalActivateTime = stopWatch.elapsedTime
//     const props = await getActivationTelemetryProps(serviceContainer)
//     sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props)
//   } catch (ex) {
//     traceError('sendStartupTelemetry() failed.', ex)
//   }
// }
// function isUsingGlobalInterpreterInWorkspace(currentPythonPath: string, serviceContainer: IServiceContainer): boolean {
//   const service = serviceContainer.get<IInterpreterAutoSelectionService>(IInterpreterAutoSelectionService)
//   const globalInterpreter = service.getAutoSelectedInterpreter(undefined)
//   if (!globalInterpreter) {
//     return false
//   }
//   return currentPythonPath === globalInterpreter.path
// }

// function hasUserDefinedPythonPath(resource: Resource, serviceContainer: IServiceContainer) {
//   const workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService)
//   const pythonPath = workspaceService.getConfiguration('python', resource).get<string>('pythonPath')!
//   return pythonPath && pythonPath !== 'python'
// }
//
// function getPreferredWorkspaceInterpreter(resource: Resource, serviceContainer: IServiceContainer) {
//   const workspaceInterpreterSelector = serviceContainer.get<IInterpreterAutoSelectionRule>(IInterpreterAutoSelectionRule, AutoSelectionRule.workspaceVirtualEnvs)
//   const interpreter = workspaceInterpreterSelector.getPreviouslyAutoSelectedInterpreter(resource)
//   return interpreter ? interpreter.path : undefined
// }

/////////////////////////////
// telemetry

// tslint:disable-next-line:no-any

/////////////////////////////
// error handling

interface IAppShell {
  showErrorMessage(str: string): Promise<void>
}

function notifyUser(msg: string) {
  // tslint:disable-next-line:no-any
  workspace.showMessage(msg, 'error')
}

// async function sendErrorTelemetry(ex: Error) {
//   try {
//     // tslint:disable-next-line:no-any
//     let props: any = {}
//     if (activatedServiceContainer) {
//       try {
//         props = await getActivationTelemetryProps(activatedServiceContainer)
//       } catch (ex) {
//         // ignore
//       }
//     }
//     sendTelemetryEvent(EventName.EDITOR_LOAD, durations, props, ex)
//   } catch (exc2) {
//     traceError('sendErrorTelemetry() failed.', exc2)
//   }
// }
