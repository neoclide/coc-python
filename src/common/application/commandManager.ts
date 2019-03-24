// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any

import { injectable } from 'inversify'
import { Disposable } from 'vscode-languageserver-protocol'
import { ICommandNameArgumentTypeMapping } from './commands'
import { ICommandManager } from './types'
import { commands } from 'coc.nvim'

@injectable()
export class CommandManager implements ICommandManager {

  /**
   * Registers a command that can be invoked via a keyboard shortcut,
   * a menu item, an action, or directly.
   *
   * Registering a command with an existing command identifier twice
   * will cause an error.
   *
   * @param command A unique identifier for the command.
   * @param callback A command handler function.
   * @param thisArg The `this` context used when invoking the handler function.
   * @return Disposable which unregisters this command on disposal.
   */
  public registerCommand<E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(command: E, callback: (...args: U) => any, thisArg?: any): Disposable {
    return commands.registerCommand(command, callback as any, thisArg)
  }

  /**
   * Executes the command denoted by the given command identifier.
   *
   * * *Note 1:* When executing an editor command not all types are allowed to
   * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
   * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
   * * *Note 2:* There are no restrictions when executing commands that have been contributed
   * by extensions.
   *
   * @param command Identifier of the command to execute.
   * @param rest Parameters passed to the command function.
   * @return A thenable that resolves to the returned value of the given command. `undefined` when
   * the command handler function doesn't return anything.
   */
  public executeCommand(command: string, ...rest: any[]): Promise<any> {
    return commands.executeCommand(command, ...rest)
  }

  /**
   * Retrieve the list of all available commands. Commands starting an underscore are
   * treated as internal commands.
   *
   * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
   * @return Thenable that resolves to a list of command ids.
   */
  public async getCommands(filterInternal?: boolean): Promise<string[]> {
    let items = commands.commandList.filter(item => {
      if (filterInternal) {
        return item.internal != true
      }
      return item
    })
    return items.map(o => o.id)
  }
}
