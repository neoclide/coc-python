// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { workspace } from 'coc.nvim'
import { CancellationToken } from 'vscode-jsonrpc'
import { FormattingOptions, Range, TextDocument, TextEdit } from 'vscode-languageserver-types'
import { Product } from '../common/installer/productInstaller'
import { IServiceContainer } from '../ioc/types'
import { BaseFormatter } from './baseFormatter'

export class BlackFormatter extends BaseFormatter {
  constructor(serviceContainer: IServiceContainer) {
    super('black', Product.black, serviceContainer)
  }

  public formatDocument(document: TextDocument, options: FormattingOptions, token: CancellationToken, range?: Range): Thenable<TextEdit[]> {
    const settings = workspace.getConfiguration('python', document.uri)
    const hasCustomArgs = Array.isArray(settings.formatting.blackArgs) && settings.formatting.blackArgs.length > 0
    const formatSelection = range ? range : false

    if (formatSelection) {
      const errorMessage = async () => {
        // Black does not support partial formatting on purpose.
        workspace.showMessage('Black does not support the "Format Selection" command', 'error')
        return [] as TextEdit[]
      }

      return errorMessage()
    }

    const blackArgs = ['--diff', '--quiet']
    if (hasCustomArgs) {
      blackArgs.push(...settings.formatting.blackArgs)
    }
    const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs)
    return promise
  }
}
