import hashString from 'string-hash'
import StyleSheet from './lib/stylesheet'

export default class StyleSheetRegistry {
  constructor(StyleSheet = StyleSheet, speedy = false) {
    this._sheet = new StyleSheet({ speedy })
    this._fromServer = undefined
    this._indices = {}
    this._instancesCounts = {}

    this.computeId = createComputeId()
    this.computeSelector = createComputeSelector()
  }

  getIdAndCss(props) {
    if (props.dynamic) {
      const styleId = this.computeId(props.styleId, props.dynamic)
      return {
        styleId,
        rules: useSingleSheet(props.css)
          ? props.css.map(rule => this.computeSelector(styleId, rule))
          : [this.computeSelector(styleId, props.css)]
      }
    }

    return {
      styleId: this.computeId(props.styleId),
      rules: useSingleSheet(props.css) ? props.css : [props.css]
    }
  }

  add(props) {
    if (undefined === this._isSpeedy) {
      this._isSpeedy = Array.isArray(props.css)
      this._sheet.speedy(this._isSpeedy)
    }

    if (!this._fromServer) {
      this._fromServer = selectFromServer()
      this._instancesCount = Object.keys(this._fromServer).reduce((acc, tagName) => {
        acc[tagName] = 0
        return acc
      }, {})
    }

    const { styleId, rules } = this.getIdAndCss(props)

    if (styleId in this._instancesCount) {
      this._instancesCount[styleId] += 1
      return
    }

    this._instancesCount[styleId] = 1

    if (!useSingleSheet(props.css)) {
      this._indices[styleId] = [this._sheet.insert(rules[0])]
      return
    }

    const length = this._sheet.length

    const indices = rules.map(rule => this._sheet.insert(rule))
    // Insertion interval
    this._indices[styleId] = [
      // Start
      indices[0],
      // End
      indices.slice(-1)
    ]
  }

  remove(props) {
    const { styleId } = this.getIdAndCss(props)
    this._instancesCount[styleId] -= 1
    if (this._instancesCount[styleId] < 1) {
      delete this._instancesCount[styleId]
      const indices = this._indices[styleId]
      delete this._indices[styleId]
      indices.forEach(index => this._sheet.delete(index))
    }
  }

  replace(props, nextProps) {
    if (!useSingleSheet(props.css)) {
      const { styleId } = this.getIdAndCss(props)
      if (this._instancesCount[styleId] === 1) {
        const index = this._indices[styleId][0]
        delete this._indices[styleId]
        delete this._instancesCount[styleId]
        const next = this.getIdAndCss(nextProps)
        // If it's already been replaced just remove the old one.
        if (this._indices[next.styleId]) {
          this._sheet.delete(index)
          this._instancesCount[next.styleId] += 1
        } else {
          // Never been inserted, replace the current tag content with the new one.
          this._sheet.replace(index, next.rules[0])
          this._indices[next.styleId] = index
          this._instancesCount[next.styleId] = 1
        }
        return
      }
    }
    this.add(nextProps)
    this.remove(props)
  }
}


// export default class StyleSheet {
//   constructor() {
//     this._fromServer = null
//     this._instancesCount = {}
//     this._tags = {}
//     this._sheet = null
//     this._isBrowser = typeof window !== 'undefined'

//     this.computeId = createComputeId()
//     this.computeSelector = createComputeSelector()
//   }

//   getIdAndCss(props) {
//     if (props.dynamic) {
//       const styleId = this.computeId(props.styleId, props.dynamic)
//       return {
//         styleId,
//         rules: useSingleSheet(props.css)
//           ? props.css.map(rule => this.computeSelector(styleId, rule))
//           : [this.computeSelector(styleId, props.css)]
//       }
//     }

//     return {
//       styleId: this.computeId(props.styleId),
//       rules: useSingleSheet(props.css) ? props.css : [props.css]
//     }
//   }

//   insert(props) {
//     if (!this._isBrowser) {
//       return
//     }
//     if (!this._fromServer) {
//       this._tags = selectFromServer()
//       this._fromServer = this._tags
//       this._instancesCount = Object.keys(this._tags).reduce((acc, tagName) => {
//         acc[tagName] = 0
//         return acc
//       }, {})
//     }

//     const { styleId, rules } = this.getIdAndCss(props)

//     if (styleId in this._instancesCount) {
//       this._instancesCount[styleId] += 1
//       return
//     }

//     this._instancesCount[styleId] = 1

//     if (!useSingleSheet(props.css)) {
//       this._tags[styleId] = makeStyleTag(rules[0])
//       return
//     }

//     if (!this._sheet) {
//       this._sheet = makeStyleTag('').sheet
//     }

//     // Insertion interval
//     this._tags[styleId] = [
//       // Start
//       this._sheet.cssRules.length,
//       // End
//       this._sheet.cssRules.length + rules.length - 1
//     ]

//     rules.forEach(rule =>
//       this._sheet.insertRule(rule, this._sheet.cssRules.length)
//     )
//   }

//   remove(props) {
//     if (!this._isBrowser) {
//       return
//     }
//     const { styleId } = this.getIdAndCss(props)
//     this._instancesCount[styleId] -= 1
//     if (this._instancesCount[styleId] < 1) {
//       delete this._instancesCount[styleId]
//       const t = this._tags[styleId]
//       delete this._tags[styleId]
//       if (
//         !useSingleSheet(props.css) ||
//         /* server side rendered styles are not arrays of indices */
//         !Array.isArray(t)
//       ) {
//         t.parentNode.removeChild(t)
//         return
//       }

//       for (let i = t[0]; i <= t[1]; i++) {
//         this._sheet.deleteRule(i)
//         this._sheet.insertRule('styledjsx-deleted-rule {}', i)
//       }
//     }
//   }

//   update(props, nextProps) {
//     if (!this._isBrowser) {
//       return
//     }
//     if (!useSingleSheet(props.css)) {
//       const { styleId } = this.getIdAndCss(props)
//       if (this._instancesCount[styleId] === 1) {
//         const t = this._tags[styleId]
//         delete this._tags[styleId]
//         delete this._instancesCount[styleId]
//         const next = this.getIdAndCss(nextProps)
//         // If it's already been replaced just remove the old one.
//         if (this._tags[next.styleId]) {
//           t.parentNode.removeChild(t)
//           this._instancesCount[next.styleId] += 1
//         } else {
//           // Never been inserted, replace the current tag content with the new one.
//           t.textContent = next.rules[0]
//           this._tags[next.styleId] = t
//           this._instancesCount[next.styleId] = 1
//         }
//         return
//       }
//     }
//     this.insert(nextProps)
//     this.remove(props)
//   }
// }

/**
 * useSingleSheet
 *
 * When css is an array (of strings) it means that we use the CSSOM api and therefore a single stylesheet.
 */
function useSingleSheet(css) {
  return Array.isArray(css)
}

/**
 * createComputeId
 *
 * Creates a function to compute and memoize a jsx id from a basedId and optionally props.
 */
export function createComputeId() {
  const cache = {}
  return function(baseId, props) {
    if (!props) {
      return `jsx-${baseId}`
    }
    const propsToString = String(props)
    const key = baseId + propsToString
    if (!cache[key]) {
      cache[key] = `jsx-${hashString(`${baseId}-${propsToString}`)}`
    }
    return cache[key]
  }
}

/**
 * createComputeSelector
 *
 * Creates a function to compute and memoize dynamic selectors.
 */
export function createComputeSelector(
  selectoPlaceholderRegexp = /__jsx-style-dynamic-selector/g
) {
  const cache = {}
  return function(id, css) {
    if (!cache[id]) {
      cache[id] = css.replace(selectoPlaceholderRegexp, id)
    }
    return cache[id]
  }
}

/**
 * selectFromServer
 *
 * Collects style tags from the document with id __jsx-XXX
 */
export function selectFromServer() {
  const elements = Array.prototype.slice.call(
    document.querySelectorAll('[id^="__jsx-"]')
  )

  return elements.reduce((acc, element) => {
    const id = element.id.slice(2)
    acc[id] = element
    return acc
  }, {})
}

export function makeStyleTag(str) {
  // Based on implementation by glamor
  const tag = document.createElement('style')
  tag.setAttribute('data-jsx-client', '')
  tag.appendChild(document.createTextNode(str))

  const head = document.head || document.getElementsByTagName('head')[0]
  head.appendChild(tag)

  return tag
}
