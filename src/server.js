import React from 'react'
import { flush } from './style'

export default function flushToReact() {
  const mem = flush()
  const arr = []
  for (const [id, css] of mem) {
    arr.push(
      React.createElement('style', {
        'data-jsx-ssr': id,
        // Avoid warnings upon render with a key
        key: `__jsx-style-${id}`,
        dangerouslySetInnerHTML: {
          __html: css
        }
      })
    )
  }
  return arr
}

export function flushToHTML() {
  const mem = flush()
  let html = ''
  for (const [id, css] of mem) {
    html += `<style data-jsx-ssr="${id}">${css}</style>`
  }
  return html
}
