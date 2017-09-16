import hashString from 'string-hash'
import DefaultStyleSheet from './lib/stylesheet'

export default class StyleSheetRegistry {
  constructor(
    { StyleSheet = DefaultStyleSheet, optimizeForSpeed = false } = {}
  ) {
    this._sheet = new StyleSheet({
      name: 'styled-jsx',
      optimizeForSpeed
    })
    this._sheet.inject()
    this._isBrowser = typeof window !== 'undefined'

    this._fromServer = undefined
    this._indices = {}
    this._instancesCounts = {}

    this.computeId = this.createComputeId()
    this.computeSelector = this.createComputeSelector()
  }

  add(props) {
    if (undefined === this._optimizeForSpeed) {
      this._optimizeForSpeed = Array.isArray(props.css)
      this._sheet.setOptimizeForSpeed(this._optimizeForSpeed)
    }

    if (this._isBrowser && !this._fromServer) {
      this._fromServer = this.selectFromServer()
      this._instancesCounts = Object.keys(
        this._fromServer
      ).reduce((acc, tagName) => {
        acc[tagName] = 0
        return acc
      }, {})
    }

    const { styleId, rules } = this.getIdAndRules(props)

    // Deduping: just increase the instances count.
    if (styleId in this._instancesCounts) {
      this._instancesCounts[styleId] += 1
      return
    }

    this._instancesCounts[styleId] = 1
    this._indices[styleId] = rules.map(rule => this._sheet.insertRule(rule))
  }

  remove(props) {
    const { styleId } = this.getIdAndRules(props)
    this._instancesCounts[styleId] -= 1
    if (this._instancesCounts[styleId] < 1) {
      const tagFromServer = this._fromServer[styleId]
      if (tagFromServer) {
        tagFromServer.parentNode.removeChild(tagFromServer)
        delete this._fromServer[styleId]
      } else {
        this._indices[styleId].forEach(index => this._sheet.deleteRule(index))
        delete this._indices[styleId]
      }
      delete this._instancesCounts[styleId]
    }
  }

  update(props, nextProps) {
    this.add(nextProps)
    this.remove(props)
  }

  flush() {
    this._sheet.flush()
    this._fromServer = undefined
    this._indices = {}
    this._instancesCounts = {}

    this.computeId = this.createComputeId()
    this.computeSelector = this.createComputeSelector()
  }

  cssRules() {
    const fromServer = this._fromServer
      ? Object.keys(this._fromServer).map(styleId => [
          styleId,
          this._fromServer[styleId]
        ])
      : []
    const cssRules = this._sheet.cssRules()
    return fromServer.concat(
      Object.keys(this._indices).map(styleId => [
        styleId,
        this._indices[styleId].map(index => cssRules[index].cssText).join('\n')
      ])
    )
  }

  /**
   * createComputeId
   *
   * Creates a function to compute and memoize a jsx id from a basedId and optionally props.
   */
  createComputeId() {
    const cache = {}
    return function(baseId, props) {
      if (!props) {
        return `jsx-${baseId}`
      }
      const propsToString = String(props)
      const key = baseId + propsToString
      // return `jsx-${hashString(`${baseId}-${propsToString}`)}`
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
  createComputeSelector(
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

  getIdAndRules(props) {
    if (props.dynamic) {
      const styleId = this.computeId(props.styleId, props.dynamic)
      return {
        styleId,
        rules: Array.isArray(props.css)
          ? props.css.map(rule => this.computeSelector(styleId, rule))
          : [this.computeSelector(styleId, props.css)]
      }
    }

    return {
      styleId: this.computeId(props.styleId),
      rules: Array.isArray(props.css) ? props.css : [props.css]
    }
  }

  /**
   * selectFromServer
   *
   * Collects style tags from the document with id __jsx-XXX
   */
  selectFromServer() {
    const elements = Array.prototype.slice.call(
      document.querySelectorAll('[id^="__jsx-"]')
    )

    return elements.reduce((acc, element) => {
      const id = element.id.slice(2)
      acc[id] = element
      return acc
    }, {})
  }
}
