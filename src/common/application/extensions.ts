// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { injectable } from 'inversify'
import { extensions, Extension } from 'coc.nvim'
import { IExtensions } from '../types'

@injectable()
export class Extensions implements IExtensions {
  // tslint:disable-next-line:no-any
  public get all(): Extension<any>[] {
    return extensions.all
  }

  // tslint:disable-next-line:no-any
  public getExtension(extensionId: any): Extension<any> | null {
    for (let ext of extensions.all) {
      if (ext.id == extensionId) {
        return ext
      }
    }
    return null
  }
}
