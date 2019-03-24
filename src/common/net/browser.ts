// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

// tslint:disable:no-var-requires

import { injectable } from 'inversify'
import { IBrowserService } from '../types'
import { workspace } from 'coc.nvim'

export function launch(url: string) {
  // tslint:disable-next-line: no-floating-promises
  workspace.openResource(url)
}

@injectable()
export class BrowserService implements IBrowserService {
  public launch(url: string): void {
    // tslint:disable-next-line: no-floating-promises
    workspace.openResource(url)
  }
}
