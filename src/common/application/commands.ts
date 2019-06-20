// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { Commands } from '../constants'
import { Uri } from 'coc.nvim'
import { CancellationToken } from 'vscode-languageserver-protocol'

export type CommandsWithoutArgs = keyof ICommandNameWithoutArgumentTypeMapping

/**
 * Mapping between commands and list or arguments.
 * These commands do NOT have any arguments.
 * @interface ICommandNameWithoutArgumentTypeMapping
 */
interface ICommandNameWithoutArgumentTypeMapping {
  ['python.debugger.replaceExperimental']: []
  [Commands.Upgrade_Languageserver]: []
  [Commands.Set_Interpreter]: []
  [Commands.Set_ShebangInterpreter]: []
  [Commands.Run_Linter]: []
  [Commands.Enable_Linter]: []
  ['workbench.action.reloadWindow']: []
  ['editor.action.format']: []
  ['editor.action.rename']: []
  [Commands.ViewOutput]: []
  [Commands.Set_Linter]: []
  [Commands.Start_REPL]: []
  [Commands.Enable_SourceMap_Support]: []
  [Commands.Exec_Selection_In_Terminal]: []
  [Commands.Exec_Selection_In_Django_Shell]: []
  [Commands.Create_Terminal]: []
  [Commands.Tests_View_UI]: []
  [Commands.Tests_Ask_To_Stop_Discovery]: []
  [Commands.Tests_Ask_To_Stop_Test]: []
  [Commands.Tests_Discovering]: []
}

/**
 * Mapping between commands and list of arguments.
 * Used to provide strong typing for command & args.
 * @export
 * @interface ICommandNameArgumentTypeMapping
 * @extends {ICommandNameWithoutArgumentTypeMapping}
 */
export interface ICommandNameArgumentTypeMapping extends ICommandNameWithoutArgumentTypeMapping {
  ['setContext']: [string, boolean]
  ['revealLine']: [{ lineNumber: number; at: 'top' | 'center' | 'bottom' }]
  ['python._loadLanguageServerExtension']: {}[]
  [Commands.Build_Workspace_Symbols]: [boolean, CancellationToken]
  [Commands.Sort_Imports]: [undefined, Uri]
  [Commands.Exec_In_Terminal]: [undefined, Uri]
  [Commands.Tests_Stop]: [undefined, Uri]
}
