import * as TreeSitterUtils from './utils'
import type { SyntaxNode, Tree } from 'web-tree-sitter'

export function getAllErrorNodes (tree: Tree): SyntaxNode[] {
  const errorNodes: SyntaxNode[] = []
  TreeSitterUtils.forEach(tree.rootNode, (node) => {
    const followChildren = node.type !== 'ERROR'
    if (!followChildren) {
      errorNodes.push(node)
    }
    return followChildren
  })
  return errorNodes
}
