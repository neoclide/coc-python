import path from 'path'
import { fsExistsAsync } from '../common/utils/fs'
import { ITag } from './contracts'
import { Position, SymbolKind, CancellationToken } from 'vscode-languageserver-protocol'

// tslint:disable:no-require-imports no-var-requires no-suspicious-comment
// tslint:disable:no-any
// TODO: Turn these into imports.
const LineByLineReader = require('line-by-line')
const NamedRegexp = require('named-js-regexp')
const fuzzy = require('fuzzy')

const IsFileRegEx = /\tkind:file\tline:\d+$/g
const LINE_REGEX = '(?<name>\\w+)\\t(?<file>.*)\\t\\/\\^(?<code>.*)\\$\\/;"\\tkind:(?<type>\\w+)\\tline:(?<line>\\d+)$'

export interface IRegexGroup {
  name: string
  file: string
  code: string
  type: string
  line: number
}

export function matchNamedRegEx(data: String, regex: String): IRegexGroup | null {
  const compiledRegexp = NamedRegexp(regex, 'g')
  const rawMatch = compiledRegexp.exec(data)
  if (rawMatch !== null) {
    return rawMatch.groups() as IRegexGroup
  }

  return null
}

const CTagKinMapping = new Map<string, SymbolKind>()
CTagKinMapping.set('_array', SymbolKind.Array)
CTagKinMapping.set('_boolean', SymbolKind.Boolean)
CTagKinMapping.set('_class', SymbolKind.Class)
CTagKinMapping.set('_classes', SymbolKind.Class)
CTagKinMapping.set('_constant', SymbolKind.Constant)
CTagKinMapping.set('_constants', SymbolKind.Constant)
CTagKinMapping.set('_constructor', SymbolKind.Constructor)
CTagKinMapping.set('_enum', SymbolKind.Enum)
CTagKinMapping.set('_enums', SymbolKind.Enum)
CTagKinMapping.set('_enumeration', SymbolKind.Enum)
CTagKinMapping.set('_enumerations', SymbolKind.Enum)
CTagKinMapping.set('_field', SymbolKind.Field)
CTagKinMapping.set('_fields', SymbolKind.Field)
CTagKinMapping.set('_file', SymbolKind.File)
CTagKinMapping.set('_files', SymbolKind.File)
CTagKinMapping.set('_function', SymbolKind.Function)
CTagKinMapping.set('_functions', SymbolKind.Function)
CTagKinMapping.set('_member', SymbolKind.Function)
CTagKinMapping.set('_interface', SymbolKind.Interface)
CTagKinMapping.set('_interfaces', SymbolKind.Interface)
CTagKinMapping.set('_key', SymbolKind.Key)
CTagKinMapping.set('_keys', SymbolKind.Key)
CTagKinMapping.set('_method', SymbolKind.Method)
CTagKinMapping.set('_methods', SymbolKind.Method)
CTagKinMapping.set('_module', SymbolKind.Module)
CTagKinMapping.set('_modules', SymbolKind.Module)
CTagKinMapping.set('_namespace', SymbolKind.Namespace)
CTagKinMapping.set('_namespaces', SymbolKind.Namespace)
CTagKinMapping.set('_number', SymbolKind.Number)
CTagKinMapping.set('_numbers', SymbolKind.Number)
CTagKinMapping.set('_null', SymbolKind.Null)
CTagKinMapping.set('_object', SymbolKind.Object)
CTagKinMapping.set('_package', SymbolKind.Package)
CTagKinMapping.set('_packages', SymbolKind.Package)
CTagKinMapping.set('_property', SymbolKind.Property)
CTagKinMapping.set('_properties', SymbolKind.Property)
CTagKinMapping.set('_objects', SymbolKind.Object)
CTagKinMapping.set('_string', SymbolKind.String)
CTagKinMapping.set('_variable', SymbolKind.Variable)
CTagKinMapping.set('_variables', SymbolKind.Variable)
CTagKinMapping.set('_projects', SymbolKind.Package)
CTagKinMapping.set('_defines', SymbolKind.Module)
CTagKinMapping.set('_labels', SymbolKind.Interface)
CTagKinMapping.set('_macros', SymbolKind.Function)
CTagKinMapping.set('_types (structs and records)', SymbolKind.Class)
CTagKinMapping.set('_subroutine', SymbolKind.Method)
CTagKinMapping.set('_subroutines', SymbolKind.Method)
CTagKinMapping.set('_types', SymbolKind.Class)
CTagKinMapping.set('_programs', SymbolKind.Class)
CTagKinMapping.set('_Object\'s method', SymbolKind.Method)
CTagKinMapping.set('_Module or functor', SymbolKind.Module)
CTagKinMapping.set('_Global variable', SymbolKind.Variable)
CTagKinMapping.set('_Type name', SymbolKind.Class)
CTagKinMapping.set('_A function', SymbolKind.Function)
CTagKinMapping.set('_A constructor', SymbolKind.Constructor)
CTagKinMapping.set('_An exception', SymbolKind.Class)
CTagKinMapping.set('_A \'structure\' field', SymbolKind.Field)
CTagKinMapping.set('_procedure', SymbolKind.Function)
CTagKinMapping.set('_procedures', SymbolKind.Function)
CTagKinMapping.set('_constant definitions', SymbolKind.Constant)
CTagKinMapping.set('_javascript functions', SymbolKind.Function)
CTagKinMapping.set('_singleton methods', SymbolKind.Method)

const newValuesAndKeys = {}
CTagKinMapping.forEach((value, key) => {
  (newValuesAndKeys as any)[key.substring(1)] = value
})
Object.keys(newValuesAndKeys).forEach(key => {
  CTagKinMapping.set(key, (newValuesAndKeys as any)[key])
})

export function parseTags(
  workspaceFolder: string,
  tagFile: string,
  query: string,
  token: CancellationToken
): Promise<ITag[]> {
  return fsExistsAsync(tagFile).then(exists => {
    if (!exists) {
      return Promise.resolve([])
    }

    return new Promise<ITag[]>((resolve, reject) => {
      const lr = new LineByLineReader(tagFile)
      let lineNumber = 0
      const tags: ITag[] = []

      lr.on('error', (err: Error) => {
        reject(err)
      })

      lr.on('line', (line: string) => {
        lineNumber = lineNumber + 1
        if (token.isCancellationRequested) {
          lr.close()
          return
        }
        const tag = parseTagsLine(workspaceFolder, line, query)
        if (tag) {
          tags.push(tag)
        }
        if (tags.length >= 100) {
          lr.close()
        }
      })

      lr.on('end', () => {
        resolve(tags)
      })
    })
  })
}
function parseTagsLine(workspaceFolder: string, line: string, searchPattern: string): ITag | undefined {
  if (IsFileRegEx.test(line)) {
    return
  }
  const match = matchNamedRegEx(line, LINE_REGEX)
  if (!match) {
    return
  }
  if (!fuzzy.test(searchPattern, match.name)) {
    return
  }
  let file = match.file
  if (!path.isAbsolute(file)) {
    file = path.resolve(workspaceFolder, '.vscode', file)
  }

  const symbolKind = CTagKinMapping.get(match.type) || SymbolKind.Null
  return {
    fileName: file,
    code: match.code,
    position: Position.create(Number(match.line) - 1, 0),
    symbolName: match.name,
    symbolKind
  }
}
