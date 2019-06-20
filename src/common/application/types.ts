// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict'
import { ConfigurationChangeEvent, FileSystemWatcher, StatusBarItem, WorkspaceConfiguration } from 'coc.nvim'
import { CancellationToken, Disposable, Event, Position, TextDocument, WorkspaceEdit, WorkspaceFolder } from 'vscode-languageserver-protocol'
import { Uri, Terminal, TerminalOptions } from 'coc.nvim'
// import { IAsyncDisposable } from '../types'
import { ICommandNameArgumentTypeMapping } from './commands'

// tslint:disable:no-any unified-signatures

export type Resource = Uri | undefined
export const IApplicationShell = Symbol('IApplicationShell')
export interface IApplicationShell {
  /**
   * Opens URL in a default browser.
   *
   * @param url Url to open.
   */
  openUrl(url: string): void

  /**
   * Set a message to the status bar. This is a short hand for the more powerful
   * status bar [items](#window.createStatusBarItem).
   *
   * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
   * @param hideAfterTimeout Timeout in milliseconds after which the message will be disposed.
   * @return A disposable which hides the status bar message.
   */
  setStatusBarMessage(text: string, hideAfterTimeout: number): Disposable

  /**
   * Set a message to the status bar. This is a short hand for the more powerful
   * status bar [items](#window.createStatusBarItem).
   *
   * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
   * @param hideWhenDone Thenable on which completion (resolve or reject) the message will be disposed.
   * @return A disposable which hides the status bar message.
   */
  setStatusBarMessage(text: string, hideWhenDone: Thenable<any>): Disposable

  /**
   * Set a message to the status bar. This is a short hand for the more powerful
   * status bar [items](#window.createStatusBarItem).
   *
   * *Note* that status bar messages stack and that they must be disposed when no
   * longer used.
   *
   * @param text The message to show, supports icon substitution as in status bar [items](#StatusBarItem.text).
   * @return A disposable which hides the status bar message.
   */
  setStatusBarMessage(text: string): Disposable

  /**
   * Creates a status bar [item](#StatusBarItem).
   *
   * @param alignment The alignment of the item.
   * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
   * @return A new status bar item.
   */
  createStatusBarItem(priority?: number): StatusBarItem
}

export const ICommandManager = Symbol('ICommandManager')

export interface ICommandManager {

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
  registerCommand<E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(command: E, callback: (...args: U) => any, thisArg?: any): Disposable

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
  executeCommand<T, E extends keyof ICommandNameArgumentTypeMapping, U extends ICommandNameArgumentTypeMapping[E]>(command: E, ...rest: U): Thenable<T | undefined>

  /**
   * Retrieve the list of all available commands. Commands starting an underscore are
   * treated as internal commands.
   *
   * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
   * @return Thenable that resolves to a list of command ids.
   */
  getCommands(filterInternal?: boolean): Thenable<string[]>
}

export const IDocumentManager = Symbol('IDocumentManager')

export interface IDocumentManager {
  /**
   * All text documents currently known to the system.
   *
   * @readonly
   */
  readonly textDocuments: TextDocument[]
  /**
   * An event that is emitted when a [text document](#TextDocument) is opened.
   */
  readonly onDidOpenTextDocument: Event<TextDocument>
  /**
   * An event that is emitted when a [text document](#TextDocument) is disposed.
   */
  readonly onDidCloseTextDocument: Event<TextDocument>
  /**
   * An event that is emitted when a [text document](#TextDocument) is saved to disk.
   */
  readonly onDidSaveTextDocument: Event<TextDocument>

  /**
   * Show the given document in a text editor. A [column](#ViewColumn) can be provided
   * to control where the editor is being shown. Might change the [active editor](#window.activeTextEditor).
   *
   * @param document A text document to be shown.
   * @param column A view column in which the [editor](#TextEditor) should be shown. The default is the [one](#ViewColumn.One), other values
   * are adjusted to be `Min(column, columnCount + 1)`, the [active](#ViewColumn.Active)-column is
   * not adjusted.
   * @param preserveFocus When `true` the editor will not take focus.
   * @return A promise that resolves to an [editor](#TextEditor).
   */
  showTextDocument(document: TextDocument, position?: Position, preserveFocus?: boolean): Thenable<number>

  /**
   * Show the given document in a text editor. [Options](#TextDocumentShowOptions) can be provided
   * to control options of the editor is being shown. Might change the [active editor](#window.activeTextEditor).
   *
   * @param document A text document to be shown.
   * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
   * @return A promise that resolves to an [editor](#TextEditor).
   */
  showTextDocument(document: TextDocument, cmd?: string): Thenable<number>

  /**
   * A short-hand for `openTextDocument(uri).then(document => showTextDocument(document, options))`.
   *
   * @see [openTextDocument](#openTextDocument)
   *
   * @param uri A resource identifier.
   * @param options [Editor options](#TextDocumentShowOptions) to configure the behavior of showing the [editor](#TextEditor).
   * @return A promise that resolves to an [editor](#TextEditor).
   */
  showTextDocument(uri: Uri): Thenable<number>
  /**
   * Make changes to one or many resources as defined by the given
   * [workspace edit](#WorkspaceEdit).
   *
   * When applying a workspace edit, the editor implements an 'all-or-nothing'-strategy,
   * that means failure to load one document or make changes to one document will cause
   * the edit to be rejected.
   *
   * @param edit A workspace edit.
   * @return A thenable that resolves when the edit could be applied.
   */
  applyEdit(edit: WorkspaceEdit): Thenable<boolean>
  /**
   * Opens a document. Will return early if this document is already open. Otherwise
   * the document is loaded and the [didOpen](#workspace.onDidOpenTextDocument)-event fires.
   *
   * The document is denoted by an [uri](#Uri). Depending on the [scheme](#Uri.scheme) the
   * following rules apply:
   * * `file`-scheme: Open a file on disk, will be rejected if the file does not exist or cannot be loaded.
   * * `untitled`-scheme: A new file that should be saved on disk, e.g. `untitled:c:\frodo\new.js`. The language
   * will be derived from the file name.
   * * For all other schemes the registered text document content [providers](#TextDocumentContentProvider) are consulted.
   *
   * *Note* that the lifecycle of the returned document is owned by the editor and not by the extension. That means an
   * [`onDidClose`](#workspace.onDidCloseTextDocument)-event can occur at any time after opening it.
   *
   * @param uri Identifies the resource to open.
   * @return A promise that resolves to a [document](#TextDocument).
   */
  openTextDocument(uri: Uri): Promise<TextDocument>
}

export const IWorkspaceService = Symbol('IWorkspaceService')

export interface IWorkspaceService {
  /**
   * ~~The folder that is open in the editor. `undefined` when no folder
   * has been opened.~~
   *
   * @readonly
   */
  readonly rootPath: string | undefined

  /**
   * List of workspace folders or `undefined` when no folder is open.
   * *Note* that the first entry corresponds to the value of `rootPath`.
   *
   * @readonly
   */
  readonly workspaceFolders: WorkspaceFolder[] | undefined

  /**
   * An event that is emitted when the [configuration](#WorkspaceConfiguration) changed.
   */
  readonly onDidChangeConfiguration: Event<ConfigurationChangeEvent>

  /**
   * Creates a file system watcher.
   *
   * A glob pattern that filters the file events on their absolute path must be provided. Optionally,
   * flags to ignore certain kinds of events can be provided. To stop listening to events the watcher must be disposed.
   *
   * *Note* that only files within the current [workspace folders](#workspace.workspaceFolders) can be watched.
   *
   * @param globPattern A [glob pattern](#GlobPattern) that is applied to the absolute paths of created, changed,
   * and deleted files. Use a [relative pattern](#RelativePattern) to limit events to a certain [workspace folder](#WorkspaceFolder).
   * @param ignoreCreateEvents Ignore when files have been created.
   * @param ignoreChangeEvents Ignore when files have been changed.
   * @param ignoreDeleteEvents Ignore when files have been deleted.
   * @return A new file system watcher instance.
   */
  createFileSystemWatcher(globPattern: string, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher

  /**
   * Find files across all [workspace folders](#workspace.workspaceFolders) in the workspace.
   *
   * @sample `findFiles('**∕*.js', '**∕node_modules∕**', 10)`
   * @param include A [glob pattern](#GlobPattern) that defines the files to search for. The glob pattern
   * will be matched against the file paths of resulting matches relative to their workspace. Use a [relative pattern](#RelativePattern)
   * to restrict the search results to a [workspace folder](#WorkspaceFolder).
   * @param exclude  A [glob pattern](#GlobPattern) that defines files and folders to exclude. The glob pattern
   * will be matched against the file paths of resulting matches relative to their workspace.
   * @param maxResults An upper-bound for the result.
   * @param token A token that can be used to signal cancellation to the underlying search engine.
   * @return A thenable that resolves to an array of resource identifiers. Will return no results if no
   * [workspace folders](#workspace.workspaceFolders) are opened.
   */
  findFiles(include: string, exclude?: string, maxResults?: number, token?: CancellationToken): Thenable<Uri[]>

  /**
   * Get a workspace configuration object.
   *
   * When a section-identifier is provided only that part of the configuration
   * is returned. Dots in the section-identifier are interpreted as child-access,
   * like `{ myExt: { setting: { doIt: true }}}` and `getConfiguration('myExt.setting').get('doIt') === true`.
   *
   * When a resource is provided, configuration scoped to that resource is returned.
   *
   * @param section A dot-separated identifier.
   * @param resource A resource for which the configuration is asked for
   * @return The full configuration or a subset.
   */
  getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration
  /**
   * Whether a workspace folder exists
   * @type {boolean}
   * @memberof IWorkspaceService
   */
  readonly hasWorkspaceFolders: boolean
  /**
   * Generate a key that's unique to the workspace folder (could be fsPath).
   * @param {(Uri | undefined)} resource
   * @returns {string}
   * @memberof IWorkspaceService
   */
  getWorkspaceFolderIdentifier(resource: Uri | undefined, defaultValue?: string): string
  /**
   * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
   * * returns `undefined` when the given uri doesn't match any workspace folder
   * * returns the *input* when the given uri is a workspace folder itself
   *
   * @param uri An uri.
   * @return A workspace folder or `undefined`
   */
  getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined
}

export const ITerminalManager = Symbol('ITerminalManager')

export interface ITerminalManager {
  /**
   * An [event](#Event) which fires when a terminal is disposed.
   */
  readonly onDidCloseTerminal: Event<Terminal>
  /**
   * An [event](#Event) which fires when a terminal has been created, either through the
   * [createTerminal](#window.createTerminal) API or commands.
   */
  readonly onDidOpenTerminal: Event<Terminal>
  /**
   * Creates a [Terminal](#Terminal). The cwd of the terminal will be the workspace directory
   * if it exists, regardless of whether an explicit customStartPath setting exists.
   *
   * @param options A TerminalOptions object describing the characteristics of the new terminal.
   * @return A new Terminal.
   */
  createTerminal(options: TerminalOptions): Promise<Terminal>
}

export const IApplicationEnvironment = Symbol('IApplicationEnvironment')
export interface IApplicationEnvironment {
  /**
   * The application name of the editor, like 'VS Code'.
   *
   * @readonly
   */
  appName: string

  /**
   * The extension name.
   *
   * @readonly
   */
  extensionName: string

  /**
   * The application root folder from which the editor is running.
   *
   * @readonly
   */
  appRoot: string

  /**
   * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
   *
   * @readonly
   */
  language: string

  /**
   * A unique identifier for the computer.
   *
   * @readonly
   */
  machineId: string

  /**
   * A unique identifier for the current session.
   * Changes each time the editor is started.
   *
   * @readonly
   */
  sessionId: string
  /**
   * Contents of `package.json` as a JSON object.
   *
   * @type {any}
   * @memberof IApplicationEnvironment
   */
  packageJson: any
}
