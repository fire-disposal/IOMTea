import type { SvgNode } from './types'

const attrString = (attrs?: Record<string, string | number>) => {
  if (!attrs) return ''
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(' ')
}

export function serializeSvgNode(node: SvgNode): string {
  const attrs = attrString(node.attrs)
  const attrChunk = attrs ? ` ${attrs}` : ''
  const children = node.children ?? []

  if (children.length === 0 && !node.text) {
    return `<${node.tag}${attrChunk} />`
  }

  const body = [node.text ?? '', ...children.map(serializeSvgNode)].join('')
  return `<${node.tag}${attrChunk}>${body}</${node.tag}>`
}
