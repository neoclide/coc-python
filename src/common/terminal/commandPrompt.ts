// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict'

import path from 'path'
import { ConfigurationTarget } from 'coc.nvim'
import { IConfigurationService, ICurrentProcess } from '../types'

export function getCommandPromptLocation(currentProcess: ICurrentProcess) {
  const system32Path = path.join('C:\Windows', 'System32')
  return path.join(system32Path, 'cmd.exe')
}

export async function useCommandPromptAsDefaultShell(currentProcess: ICurrentProcess, configService: IConfigurationService) {
  const cmdPromptLocation = getCommandPromptLocation(currentProcess)
  await configService.updateSectionSetting('terminal', 'integrated.shell.windows', cmdPromptLocation, undefined, ConfigurationTarget.User)
}
