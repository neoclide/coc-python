// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { workspace, WorkspaceConfiguration } from 'coc.nvim'
import * as fs from 'fs'
import { promisify } from 'util'

// tslint:disable:no-require-imports
const setting = 'sourceMapsEnabled'

export class SourceMapSupport {
  private readonly config: WorkspaceConfiguration
  constructor() {
    this.config = workspace.getConfiguration('python.diagnostics', null)
  }
  public async initialize(): Promise<void> {
    if (!this.enabled) {
      return
    }
    // await this.enableSourceMaps(true)
    // const localize = require('./common/utils/localize') as typeof import('./common/utils/localize')
    // // const disable = localize.Diagnostics.disableSourceMaps()
    // // tslint:disable-next-line: no-floating-promises
    // workspace.showPrompt(localize.Diagnostics.warnSourceMaps() + ', disable?').then(res => {
    //   if (res) {
    //     this.disable().catch(emptyFn)
    //   }
    // })
  }
  public get enabled(): boolean {
    return this.config.get<boolean>(setting, false)
  }
  public async disable(): Promise<void> {
    // if (this.enabled) {
    //   this.config.update(setting, false, true)
    // }
    // await this.enableSourceMaps(false)
  }
  protected async enableSourceMaps(enable: boolean) {
    // const extensionSourceFile = path.join(EXTENSION_ROOT_DIR, 'lib', 'index.js')
    // const debuggerSourceFile = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'debugger', 'debugAdapter', 'main.js')
    // await Promise.all([this.enableSourceMap(enable, extensionSourceFile), this.enableSourceMap(enable, debuggerSourceFile)])
  }
  protected async enableSourceMap(enable: boolean, sourceFile: string) {
    const sourceMapFile = `${sourceFile}.map`
    const disabledSourceMapFile = `${sourceFile}.map.disabled`
    if (enable) {
      await this.rename(disabledSourceMapFile, sourceMapFile)
    } else {
      await this.rename(sourceMapFile, disabledSourceMapFile)
    }
  }
  protected async rename(sourceFile: string, targetFile: string) {
    const fsExists = promisify(fs.exists)
    const fsRename = promisify(fs.rename)
    if (await fsExists(targetFile)) {
      return
    }
    await fsRename(sourceFile, targetFile)
  }
}
export function initialize() {
  // if (!workspace.getConfiguration('python.diagnostics', null).get('sourceMapsEnabled', false)) {
  //   new SourceMapSupport().disable().catch(emptyFn)
  //   return
  // }
  // new SourceMapSupport().initialize().catch(_ex => {
  //   console.error('Failed to initialize source map support in extension')
  // })
}
