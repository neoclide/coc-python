// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { injectable } from 'inversify'
import requestTypes from 'request'
import { IHttpClient } from '../../activation/types'
import { workspace } from 'coc.nvim'

@injectable()
export class HttpClient implements IHttpClient {
  public readonly requestOptions: requestTypes.CoreOptions
  constructor() {
    this.requestOptions = {
      proxy: workspace.getConfiguration('http').get('proxy')
      || process.env.http_proxy
      || process.env.HTTP_PROXY
      || process.env.https_proxy
      || process.env.HTTPS_PROXY
    }
  }

  public async downloadFile(uri: string): Promise<requestTypes.Request> {
    // tslint:disable-next-line:no-any
    const request = await import('request') as any
    return request.default(uri, this.requestOptions)
  }
  public async getJSON<T>(uri: string): Promise<T> {
    // tslint:disable-next-line:no-require-imports
    const request = require('request') as typeof requestTypes
    return new Promise<T>((resolve, reject) => {
      request(uri, this.requestOptions, (ex, response, body) => {
        if (ex) {
          return reject(ex)
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`))
        }
        resolve(JSON.parse(body) as T)
      })
    })
  }
}
