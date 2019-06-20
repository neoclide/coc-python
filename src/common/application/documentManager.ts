// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any unified-signatures

import { injectable } from 'inversify'
import { IDocumentManager } from './types'
import { Uri, workspace } from 'coc.nvim'
import { TextDocument, Event, Position, WorkspaceEdit } from 'vscode-languageserver-protocol'

@injectable()
export class DocumentManager implements IDocumentManager {
  public get textDocuments(): TextDocument[] {
    return workspace.textDocuments
  }
  public get onDidOpenTextDocument(): Event<TextDocument> {
    return workspace.onDidOpenTextDocument
  }
  public get onDidCloseTextDocument(): Event<TextDocument> {
    return workspace.onDidCloseTextDocument
  }
  public get onDidSaveTextDocument(): Event<TextDocument> {
    return workspace.onDidSaveTextDocument
  }
  public showTextDocument(document: TextDocument, position?: Position, preserveFocus?: boolean): Promise<number>
  public showTextDocument(document: TextDocument | Uri, opencmd?: string): Promise<number>
  public showTextDocument(uri: any, options?: any, preserveFocus?: any): Promise<number> {
    let u: string = TextDocument.is(uri) ? uri.uri : uri.toString()
    let pos: Position = null
    if (Position.is(options)) {
      pos = options
    }
    let cmd = typeof options == 'string' ? options : null
    return workspace.jumpTo(uri, pos, cmd).then(() => {
      return workspace.nvim.call('bufnr', '%')
    })
  }

  public applyEdit(edit: WorkspaceEdit): Thenable<boolean> {
    return workspace.applyEdit(edit)
  }
  public async openTextDocument(uri: Uri): Promise<TextDocument> {
    let doc = workspace.getDocument(workspace.bufnr)
    if (doc.uri == uri.toString()) return doc.textDocument
    await workspace.jumpTo(uri.toString())
    doc = await workspace.document
    return doc.textDocument
  }
}
