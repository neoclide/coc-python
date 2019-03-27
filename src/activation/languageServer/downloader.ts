// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import { inject, injectable, named } from 'inversify'
import * as path from 'path'
import { workspace } from 'coc.nvim'
import { IApplicationShell } from '../../common/application/types'
import { STANDARD_OUTPUT_CHANNEL } from '../../common/constants'
import { IFileSystem } from '../../common/platform/types'
import { IOutputChannel } from '../../common/types'
import { createDeferred } from '../../common/utils/async'
import { Common, LanguageService } from '../../common/utils/localize'
import { StopWatch } from '../../common/utils/stopWatch'
import {
  IHttpClient, ILanguageServerDownloader, ILanguageServerFolderService,
  IPlatformData
} from '../types'
import { emptyFn } from '../../common/function'

// tslint:disable:no-require-imports no-any

const downloadFileExtension = '.nupkg'

@injectable()
export class LanguageServerDownloader implements ILanguageServerDownloader {
  constructor(
    @inject(IPlatformData) private readonly platformData: IPlatformData,
    @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private readonly output: IOutputChannel,
    @inject(IHttpClient) private readonly httpClient: IHttpClient,
    @inject(ILanguageServerFolderService) private readonly lsFolderService: ILanguageServerFolderService,
    @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    @inject(IFileSystem) private readonly fs: IFileSystem
  ) {
  }

  public async getDownloadInfo() {
    return this.lsFolderService.getLatestLanguageServerVersion().then(item => item!)
  }
  public async downloadLanguageServer(destinationFolder: string): Promise<void> {
    const downloadInfo = await this.getDownloadInfo()
    const downloadUri = downloadInfo.uri
    const lsVersion = downloadInfo.version.raw
    const timer: StopWatch = new StopWatch()
    let success = true
    let localTempFilePath = ''

    try {
      localTempFilePath = await this.downloadFile(downloadUri, 'Downloading Microsoft Python Language Server... ')
    } catch (err) {
      this.output.appendLine(LanguageService.downloadFailedOutputMessage())
      this.output.appendLine(err)
      success = false
      this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToDownload()).catch(emptyFn)
      throw new Error(err)
    }

    timer.reset()
    try {
      await this.unpackArchive(destinationFolder, localTempFilePath)
    } catch (err) {
      this.output.appendLine(LanguageService.extractionFailedOutputMessage())
      this.output.appendLine(err)
      success = false
      this.showMessageAndOptionallyShowOutput(LanguageService.lsFailedToExtract()).catch(emptyFn)
      throw new Error(err)
    } finally {
      await this.fs.deleteFile(localTempFilePath)
    }
  }

  protected async showMessageAndOptionallyShowOutput(message: string) {
    workspace.showMessage(message + ' checkout output for detail.', 'error')
  }

  protected async downloadFile(uri: string, title: string): Promise<string> {
    this.output.append(`Downloading ${uri}... `)
    const tempFile = await this.fs.createTemporaryFile(downloadFileExtension)
    let statusItem = workspace.createStatusBarItem(0, { progress: true })
    statusItem.text = `Downloading ${uri}... `

    const deferred = createDeferred()
    const fileStream = this.fs.createWriteStream(tempFile.filePath)
    fileStream.on('finish', () => {
      fileStream.close()
    }).on('error', err => {
      tempFile.dispose()
      deferred.reject(err)
    })

    statusItem.show()

    const req = await this.httpClient.downloadFile(uri)
    req.on('response', response => {
      if (response.statusCode !== 200) {
        const error = new Error(`Failed with status ${response.statusCode}, ${response.statusMessage}, Uri ${uri}`)
        deferred.reject(error)
        throw error
      }
    })
    const requestProgress = require('request-progress')
    requestProgress(req)
      .on('progress', (state: any) => {
        // https://www.npmjs.com/package/request-progress
        const received = Math.round(state.size.transferred / 1024)
        const total = Math.round(state.size.total / 1024)
        const percentage = Math.round(100 * state.percent)
        statusItem.text = `${title}${received} of ${total} KB (${percentage}%)`
      })
      .on('error', (err: any) => {
        deferred.reject(err)
        statusItem.dispose()
      })
      .on('end', () => {
        statusItem.dispose()
        this.output.appendLine(LanguageService.extractionCompletedOutputMessage())
        deferred.resolve()
      })
      .pipe(fileStream)

    await deferred.promise
    return tempFile.filePath
  }

  protected async unpackArchive(destinationFolder: string, tempFilePath: string): Promise<void> {
    this.output.append('Unpacking archive... ')

    const deferred = createDeferred()

    const title = 'Extracting files... '
    let statusItem = workspace.createStatusBarItem(0, { progress: true })
    statusItem.text = title
    statusItem.show()

    // tslint:disable-next-line:no-require-imports no-var-requires
    const StreamZip = require('node-stream-zip')
    const zip = new StreamZip({
      file: tempFilePath,
      storeEntries: true
    })

    let totalFiles = 0
    let extractedFiles = 0
    zip.on('ready', async () => {
      totalFiles = zip.entriesCount
      if (!await this.fs.directoryExists(destinationFolder)) {
        await this.fs.createDirectory(destinationFolder)
      }
      zip.extract(null, destinationFolder, (err: any) => {
        if (err) {
          deferred.reject(err)
        } else {
          deferred.resolve()
        }
        zip.close()
      })
    }).on('extract', () => {
      extractedFiles += 1
      statusItem.text = `${title}${Math.round(100 * extractedFiles / totalFiles)}%`
    }).on('error', (e: any) => {
      deferred.reject(e)
    })
    await deferred.promise
    statusItem.dispose()

    // Set file to executable (nothing happens in Windows, as chmod has no definition there)
    const executablePath = path.join(destinationFolder, this.platformData.engineExecutableName)
    await this.fs.chmod(executablePath, '0755') // -rwxrw-r--

    this.output.appendLine(LanguageService.extractionDoneOutputMessage())
  }
}
