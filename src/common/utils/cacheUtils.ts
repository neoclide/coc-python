// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

// tslint:disable:no-any no-require-imports

import { Uri, workspace } from 'coc.nvim'
import { Resource } from '../types'

interface CacheData {
  value: unknown
  expiry: number
}
const resourceSpecificCacheStores = new Map<string, Map<string, CacheData>>()

/**
 * Get a cache key specific to a resource (i.e. workspace)
 * This key will be used to cache interpreter related data, hence the Python Path
 *  used in a workspace will affect the cache key.
 * @param {String} keyPrefix
 * @param {Resource} resource
 * @returns
 */
function getCacheKey(resource: Resource): string {
  const config = workspace.getConfiguration('python', resource ? resource.toString() : null)
  if (!config) return 'python'
  let folder = workspace.rootPath

  const pythonPath = config.get<string>('pythonPath', 'python')
  return `${folder}-${pythonPath}`
}
/**
 * Gets the cache store for a resource that's specific to the interpreter.
 * @param {string} keyPrefix
 * @param {Resource} resource
 * @param {VSCodeType} [vscode=require('coc.nvim')]
 * @returns
 */
function getCacheStore(resource: Resource) {
  const key = getCacheKey(resource)
  if (!resourceSpecificCacheStores.has(key)) {
    resourceSpecificCacheStores.set(key, new Map<string, CacheData>())
  }
  return resourceSpecificCacheStores.get(key)!
}

function getCacheKeyFromFunctionArgs(keyPrefix: string, fnArgs: any[]): string {
  const argsKey = fnArgs.map(arg => `${JSON.stringify(arg)}`).join('-Arg-Separator-')
  return `KeyPrefix=${keyPrefix}-Args=${argsKey}`
}

export function clearCache() {
  resourceSpecificCacheStores.clear()
}

export class InMemoryInterpreterSpecificCache<T> {
  private readonly resource: Resource
  private readonly args: any[]
  constructor(private readonly keyPrefix: string,
    protected readonly expiryDurationMs: number,
    args: [Uri | undefined, ...any[]]) {
    this.resource = args[0]
    this.args = args.slice(1)
  }
  public get hasData() {
    const store = getCacheStore(this.resource)
    const key = getCacheKeyFromFunctionArgs(this.keyPrefix, this.args)
    const data = store.get(key)
    if (!store.has(key) || !data) {
      return false
    }
    if (this.hasExpired(data.expiry)) {
      store.delete(key)
      return false
    }
    return true
  }
  /**
   * Returns undefined if there is no data.
   * Uses `hasData` to determine whether any cached data exists.
   *
   * @type {(T | undefined)}
   * @memberof InMemoryInterpreterSpecificCache
   */
  public get data(): T | undefined {
    if (!this.hasData) {
      return
    }
    const store = getCacheStore(this.resource)
    const key = getCacheKeyFromFunctionArgs(this.keyPrefix, this.args)
    const data = store.get(key)
    if (!store.has(key) || !data) {
      return
    }
    return data.value as T
  }
  public set data(value: T | undefined) {
    const store = getCacheStore(this.resource)
    const key = getCacheKeyFromFunctionArgs(this.keyPrefix, this.args)
    store.set(key, {
      expiry: this.calculateExpiry(),
      value
    })
  }
  public clear() {
    const store = getCacheStore(this.resource)
    const key = getCacheKeyFromFunctionArgs(this.keyPrefix, this.args)
    store.delete(key)
  }

  /**
   * Has this data expired?
   * (protected class member to allow for reliable non-data-time-based testing)
   *
   * @param expiry The date to be tested for expiry.
   * @returns true if the data expired, false otherwise.
   */
  protected hasExpired(expiry: number): boolean {
    return expiry < Date.now()
  }

  /**
   * When should this data item expire?
   * (protected class method to allow for reliable non-data-time-based testing)
   *
   * @returns number representing the expiry time for this item.
   */
  protected calculateExpiry(): number {
    return Date.now() + this.expiryDurationMs
  }
}
