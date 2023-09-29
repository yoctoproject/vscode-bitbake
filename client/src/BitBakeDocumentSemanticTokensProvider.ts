import { SemanticTokensLegend, SemanticTokensBuilder } from 'vscode'
import type { TextDocument, CancellationToken, SemanticTokens, DocumentSemanticTokensProvider } from 'vscode'

const tokenTypes = new Map<string, number>()
const tokenModifiers = new Map<string, number>()

interface IParsedToken {
  line: number
  startCharacter: number
  length: number
  tokenType: string
  tokenModifiers: string[]
}

const generateSemanticTokensLegend = (): SemanticTokensLegend => {
  const tokenTypesLegend = [
    'function', 'variable'
  ]
  tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index))

  const tokenModifiersLegend = [
    'declaration'
  ]
  tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index))

  return new SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend)
}

export const legend = generateSemanticTokensLegend()

export class BitBakeDocumentSemanticTokensProvider implements DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens (document: TextDocument, token: CancellationToken): Promise<SemanticTokens> {
    const allTokens = this._parseText(document.getText())
    const builder = new SemanticTokensBuilder(legend)
    allTokens.forEach((token) => {
      builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers))
    })
    return builder.build()
  }

  // Check node_modules/@types/vscode/index.d.ts for more encoding details
  private _encodeTokenType (tokenType: string): number {
    if (tokenTypes.has(tokenType)) {
      return Number(tokenTypes.get(tokenType))
    } else if (tokenType === 'notInLegend') {
      return tokenTypes.size + 2
    }
    return 0
  }

  private _encodeTokenModifiers (strTokenModifiers: string[]): number {
    let result = 0
    for (let i = 0; i < strTokenModifiers.length; i++) {
      const tokenModifier = strTokenModifiers[i]
      if (tokenModifiers.has(tokenModifier)) {
        result = result | (1 << Number(tokenModifiers.get(tokenModifier)))
      } else if (tokenModifier === 'notInLegend') {
        result = result | (1 << tokenModifiers.size + 2)
      }
    }
    return result
  }

  private _parseText (text: string): IParsedToken[] {
    /**
     * This function traverse the document twice. In the first traverse, the function and variable declarations will be matched and stored in an array which will be used to construct another array of regex for the second traverse. In the second traverse, the array of regex is used to match the function and variable references.
     */

    // TODO: Share tokens with other handlers such as diagnosis provider
    const resultTokens: IParsedToken[] = []
    const lines = text.split(/\r\n|\r|\n/)
    let declaredFunctions: string[] = []
    let declaredVariables: string[] = []

    const functionStartsWithDefRegex = /(?<!(#.*)|'.*|".*)(?<=def\s+)(?<name>[a-zA-Z0-9_][\w-]*)(?<operator>:(append|prepend|remove))?(?=\s*\()/
    const functionStartsWithPythonRegex = /(?<!(#.*)|'.*|".*)(?<=python\s+)(?<name>[a-zA-Z0-9_][\w-]*)(?<operator>:(append|prepend|remove))?(?=\s*\()/
    const shellFunctionsRegex = /(?<!(#.*)|'.*|".*)(?<name>[a-zA-Z0-9_][\w-]*)(?<operator>:(append|prepend|remove))?(?=\s*\(.*\)\s*\{)/
    const anonymousFunctionsRegex = /(\bpython)(?=\s*\(.*\)\s*\{)/
    const variableDeclarationRegex = /(?<name>[a-zA-Z0-9_][\w-]*)(?<operator>:(append|prepend|remove))?(?=\s*=\s*)(?!\s*\()/

    // First traverse: Match functions and variables declarations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      const matchFunctionStartsWithDef = functionStartsWithDefRegex.exec(line)
      const matchFunctionStartsWithPython = functionStartsWithPythonRegex.exec(line)
      const matchShellFunction = shellFunctionsRegex.exec(line)
      const matchVariableDeclaration = variableDeclarationRegex.exec(line)
      const matchAnonymousFunction = anonymousFunctionsRegex.exec(line)

      if (matchAnonymousFunction !== null) {
        // Avoid mistakening anonymous functions as shell function declaration
        continue
      }
      if (matchFunctionStartsWithDef?.groups?.name.length !== undefined) {
        resultTokens.push({
          line: i,
          startCharacter: matchFunctionStartsWithDef.index,
          length: matchFunctionStartsWithDef?.groups?.name.length,
          tokenType: 'function',
          tokenModifiers: ['declaration']
        })
        declaredFunctions.push(matchFunctionStartsWithDef?.groups?.name)
      } else if (matchFunctionStartsWithPython?.groups?.name.length !== undefined) {
        resultTokens.push({
          line: i,
          startCharacter: matchFunctionStartsWithPython.index,
          length: matchFunctionStartsWithPython?.groups?.name.length,
          tokenType: 'function',
          tokenModifiers: ['declaration']
        })

        declaredFunctions.push(matchFunctionStartsWithPython?.groups?.name)
      } else if (matchShellFunction?.groups?.name.length !== undefined) {
        resultTokens.push({
          line: i,
          startCharacter: matchShellFunction.index,
          length: matchShellFunction.groups?.name.length,
          tokenType: 'function',
          tokenModifiers: ['declaration']
        })

        declaredFunctions.push(matchShellFunction.groups?.name)
      } else if (matchVariableDeclaration?.groups?.name.length !== undefined) {
        resultTokens.push({
          line: i,
          startCharacter: matchVariableDeclaration.index,
          length: matchVariableDeclaration.groups?.name.length,
          tokenType: 'variable',
          tokenModifiers: ['declaration']
        })

        declaredVariables.push(matchVariableDeclaration.groups?.name)
      }
    }
    // Remove duplicates
    declaredFunctions = [...new Set(declaredFunctions)]
    declaredVariables = [...new Set(declaredVariables)]
    // Sort the regex from longest to shortest for precise matching
    declaredFunctions.sort((prev, next) => next.length - prev.length)
    declaredVariables.sort((prev, next) => next.length - prev.length)

    const declaredObjectsRegex: Array<{ regex: RegExp, type: string }> = []

    declaredFunctions.forEach(declaredFunction => {
      declaredObjectsRegex.push({ regex: new RegExp(`(?<!(#.*)|'.*|".*)(?<!python|def\\s+)${declaredFunction}\\b`, 'g'), type: 'function' })
    })
    declaredVariables.forEach(declaredVariable => {
      declaredObjectsRegex.push({ regex: new RegExp(`(?<!(#.*)|'.*|".*)\\b${declaredVariable}\\b(?!\\s*=\\s*)`, 'g'), type: 'variable' })
    })
    // Second traverse: Match functions and variables references
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      for (let j = 0; j < declaredObjectsRegex.length; ++j) {
        const match = declaredObjectsRegex[j].regex.exec(line)
        if (match !== null) {
          resultTokens.push({
            line: i,
            startCharacter: match.index,
            length: match[0].length,
            tokenType: declaredObjectsRegex[j].type,
            tokenModifiers: []
          })
        }
      }
    }
    return resultTokens
  }
}
