
/**
 * Split a string using the cr and lf characters and return them as an array.
 * By default lines are trimmed and empty lines are removed.
 * @param {SplitLinesOptions=} splitOptions - Options used for splitting the string.
 */
export function splitLines(str: string, splitOptions: { trim: boolean; removeEmptyEntries: boolean } = { removeEmptyEntries: true, trim: true }): string[] {
  let lines = str.split(/\r?\n/g)
  if (splitOptions && splitOptions.trim) {
    lines = lines.map(line => line.trim())
  }
  if (splitOptions && splitOptions.removeEmptyEntries) {
    lines = lines.filter(line => line.length > 0)
  }
  return lines
}

/**
 * Appropriately formats a string so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 * @param {String} value.
 */
export function toCommandArgument(str: string): string {
  if (!str) {
    return str
  }
  return (str.indexOf(' ') >= 0 && !str.startsWith('"') && !str.endsWith('"')) ? `"${str}"` : str.toString()
}

/**
 * Appropriately formats a a file path so it can be used as an argument for a command in a shell.
 * E.g. if an argument contains a space, then it will be enclosed within double quotes.
 */
export function fileToCommandArgument(str: string): string {
  if (!str) {
    return str
  }
  return toCommandArgument(str).replace(/\\/g, '/')
}

/**
 * String.trimQuotes implementation
 * Removes leading and trailing quotes from a string
 */
export function trimQuotes(str: string): string {
  if (!str) {
    return str
  }
  return str.replace(/(^['"])|(['"]$)/g, '')
}

export function format(str: string, ...args: any[]): string {
  // tslint:disable-next-line: variable-name
  return str.replace(/{(\d+)}/g, (match, n) => args[n] === undefined ? match : args[n])
}
