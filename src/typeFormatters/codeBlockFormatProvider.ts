import {
  FormattingOptions, Position, Range, TextDocument, TextEdit
} from 'vscode-languageserver-protocol'
import { BlockRegEx } from './contracts'
import { workspace } from 'coc.nvim'

export class CodeBlockFormatProvider {
  constructor(private blockRegExp: BlockRegEx, private previousBlockRegExps: BlockRegEx[], private boundaryRegExps: BlockRegEx[]) {
  }
  public canProvideEdits(line: string): boolean {
    return this.blockRegExp.test(line)
  }

  public provideEdits(document: TextDocument, position: Position, _ch: string, options: FormattingOptions, line: string): TextEdit[] {
    // We can have else for the following blocks:
    // if:
    // elif x:
    // for x in y:
    // while x:
    let doc = workspace.getDocument(document.uri)

    // We need to find a block statement that is less than or equal to this statement block (but not greater)
    for (let lineNumber = position.line - 1; lineNumber >= 0; lineNumber -= 1) {
      const prevLineText = doc.getline(lineNumber)

      // Oops, we've reached a boundary (like the function or class definition)
      // Get out of here
      if (this.boundaryRegExps.some(value => value.test(prevLineText))) {
        return []
      }

      const blockRegEx = this.previousBlockRegExps.find(value => value.test(prevLineText))
      if (!blockRegEx) {
        continue
      }

      const startOfBlockInLine = prevLineText.match(/^\s*/)[0].length
      if (startOfBlockInLine > line.match(/^\s*/)[0].length) {
        continue
      }

      const startPosition = Position.create(position.line, 0)
      const endPosition = Position.create(position.line, line.match(/^\s*/)[0].length - startOfBlockInLine)

      if (startPosition.line == endPosition.line && startPosition.character == endPosition.character) {
        // current block cannot be at the same level as a preivous block
        continue
      }

      if (options.insertSpaces) {
        return [
          TextEdit.del(Range.create(startPosition, endPosition))
        ]
      } else {
        // Delete everything before the block and insert the same characters we have in the previous block
        const prefixOfPreviousBlock = prevLineText.substring(0, startOfBlockInLine)

        const startDeletePosition = Position.create(position.line, 0)
        const endDeletePosition = Position.create(position.line, line.match(/^\s*/)[0].length)

        return [
          TextEdit.del(Range.create(startDeletePosition, endDeletePosition)),
          TextEdit.insert(startDeletePosition, prefixOfPreviousBlock)
        ]
      }
    }

    return []
  }
}
