// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { injectable } from 'inversify'
import { IApplicationEnvironment } from './types'
import { workspace } from 'coc.nvim'

@injectable()
export class ApplicationEnvironment implements IApplicationEnvironment {
  public get appName(): string {
    return 'coc.nvim'
  }
  public get appRoot(): string {
    return workspace.pluginRoot
  }
  public get language(): string {
    return 'en'
  }
  public get sessionId(): string {
    return process.pid.toString()
  }
  public get machineId(): string {
    return ''
  }
  public get extensionName(): string {
    // tslint:disable-next-line:non-literal-require
    return this.packageJson.name
  }
  // tslint:disable-next-line:no-any
  public get packageJson(): any {
    // tslint:disable-next-line:non-literal-require no-require-imports
    return require('../../../package.json')
  }
}
