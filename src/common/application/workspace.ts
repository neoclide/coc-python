// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify'
import { IWorkspaceService } from './types'
import { WorkspaceFolder, Event, CancellationToken } from 'vscode-languageserver-protocol'
import { Uri, ConfigurationChangeEvent, FileSystemWatcher, workspace, WorkspaceConfiguration } from 'coc.nvim'
import util from 'util'
import glob from 'glob'
import { Resource } from '../types'

@injectable()
export class WorkspaceService implements IWorkspaceService {
  public get onDidChangeConfiguration(): Event<ConfigurationChangeEvent> {
    return workspace.onDidChangeConfiguration
  }
  public get rootPath(): string | undefined {
    return workspace.rootPath
  }
  public get workspaceFolders(): WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders
  }
  public getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration {
    return workspace.getConfiguration(section, resource ? resource.toString() : undefined)
  }
  public createFileSystemWatcher(globPattern: string, _ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher {
    return workspace.createFileSystemWatcher(globPattern, ignoreChangeEvents, ignoreChangeEvents, ignoreDeleteEvents)
  }
  public async findFiles(include: string, exclude?: string, maxResults?: number, _token?: CancellationToken): Promise<Uri[]> {
    let res = await util.promisify(glob)(include, {
      cwd: workspace.root,
      ignore: exclude,
    })
    if (maxResults) {
      res = res.slice(0, maxResults)
    }
    return res.map(file => Uri.file(file))
  }

  public getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined {
    if (uri) return workspace.getWorkspaceFolder(uri.toString())
    return workspace.workspaceFolder
  }
  public get hasWorkspaceFolders(): boolean {
    return workspace.workspaceFolders.length > 0
  }

  public getWorkspaceFolderIdentifier(resource: Resource, defaultValue = ''): string {
    const workspaceFolder = resource ? this.getWorkspaceFolder(resource) : undefined
    return workspaceFolder ? Uri.parse(workspaceFolder.uri).fsPath : defaultValue
  }
}
