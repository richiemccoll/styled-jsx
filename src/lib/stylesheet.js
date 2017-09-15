/*

high performance StyleSheet for css-in-js systems

- uses multiple style tags behind the scenes for millions of rules
- uses `insertRule` for appending in production for *much* faster performance
- 'polyfills' on server side

// usage

import StyleSheet from 'styled-jsx/stylesheet'
let styleSheet = new StyleSheet()

styleSheet.inject()
- 'injects' the stylesheet into the page (or into memory if on server)

styleSheet.insert('#box { border: 1px solid red; }')
- appends a css rule into the stylesheet

styleSheet.flush()
- empties the stylesheet of all its contents

*/

function last(arr) {
  return arr[arr.length - 1]
}

function sheetForTag(tag) {
  if (tag.sheet) {
    return tag.sheet
  }

  // this weirdness brought to you by firefox
  for (let i = 0; i < document.styleSheets.length; i++) {
    if (document.styleSheets[i].ownerNode === tag) {
      return document.styleSheets[i]
    }
  }
}

const isBrowser = typeof window !== 'undefined'
const isProd = process.env.NODE_ENV === 'production'

const oldIE = (() => {
  if (isBrowser) {
    let div = document.createElement('div')
    div.innerHTML = '<!--[if lt IE 10]><i></i><![endif]-->'
    return div.getElementsByTagName('i').length === 1
  }
})()

function makeStyleTag(name) {
  let tag = document.createElement('style')
  tag.type = 'text/css'
  tag.setAttribute(`data-${name}`, '')
  tag.appendChild(document.createTextNode(''))
  ;(document.head || document.getElementsByTagName('head')[0]).appendChild(tag)
  return tag
}

export default class StyleSheet {
  constructor(
    {
      name = 'stylesheet',
      speedy = isProd,
      maxLength = isBrowser && oldIE ? 4000 : 65000
    } = {}
  ) {
    this.name = name
    // the big drawback here is that the css won't be editable in devtools and can't add source maps.
    this.isSpeedy = speedy
    this.sheet = undefined
    this.tags = []
    this.maxLength = maxLength
    this.ctr = 0
  }
  getSheet(tag) {
    if (undefined === tag) {
      return sheetForTag(last(this.tags))
    }

    return sheetForTag(tag)
  }
  getTagForRule(index) {
    const tagIndex = Math.floor(index / this.maxLength)
    if (undefined === this.tags[tagIndex]) {
      throw new Error('tag not found')
    }
    return this.tags[tagIndex]
  }
  getRuleIndex(index) {
    if (this.tags.length === 1) {
      return index
    }

    const tagIndex = Math.floor(index / this.maxLength)
    return index - (tagIndex * this.maxLength)
  }
  inject() {
    if (this.injected) {
      throw new Error('already injected!')
    }
    if (isBrowser) {
      this.tags[0] = makeStyleTag(this.name)
    } else {
      // server side 'polyfill'. just enough behavior to be useful.
      this.sheet = {
        cssRules: [],
        insertRule: rule => {
          // enough 'spec compliance' to be able to extract the rules later
          // in other words, just the cssText field
          this.sheet.cssRules.push({ cssText: rule })
        }
      }
    }
    this.injected = true
  }
  speedy(bool) {
    if (this.ctr !== 0) {
      // cannot change speedy mode after inserting any rule to sheet. Either call speedy(${bool}) earlier in your app, or call flush() before speedy(${bool})
      throw new Error(`cannot change speedy now`)
    }
    this.isSpeedy = !!bool
  }
  _insert(rule) {
    // this weirdness for perf, and chrome's weird bug
    // https://stackoverflow.com/questions/20007992/chrome-suddenly-stopped-accepting-insertrule
    try {
      let sheet = this.getSheet()
      sheet.insertRule(
        rule,
        rule.indexOf('@import') !== -1 ? 0 : sheet.cssRules.length
      )
    } catch (e) {
      if (!isProd) {
        // might need beter dx for this
        console.warn('illegal rule', rule) // eslint-disable-line no-console
      }
    }
  }
  insert(rule) {
    this.ctr++

    if (!isBrowser) {
      // server side is pretty simple
      this.sheet.insertRule(
        rule,
        rule.indexOf('@import') !== -1 ? 0 : this.sheet.cssRules.length
      )
      return this.ctr - 1
    }

    // this is the ultrafast version, works across browsers
    const sheet = this.getSheet()
    if (this.isSpeedy && sheet.insertRule) {
      // this weirdness for perf, and chrome's weird bug
      // https://stackoverflow.com/questions/20007992/chrome-suddenly-stopped-accepting-insertrule
      try {
        sheet.insertRule(
          rule,
          rule.indexOf('@import') !== -1 ? 0 : sheet.cssRules.length
        )
      } catch (e) {
        if (!isProd) {
          // might need beter dx for this
          console.warn('illegal rule', rule) // eslint-disable-line no-console
        }
      }
    } else {
      const tag = last(this.tags)
      if (rule.indexOf('@import') !== -1) {
        tag.insertBefore(document.createTextNode(rule), tag.firstChild)
      } else {
        tag.appendChild(document.createTextNode(rule))
      }
    }

    if (this.ctr % this.maxLength === 0) {
      this.tags.push(makeStyleTag(this.name))
    }

    return this.ctr - 1
  }
  replace(index, rule) {
    const tag = this.getTagForRule(index)
    const sheet = this.getSheet(tag)
    const ruleIndex = this.getRuleIndex(index)
    console.log(index, ruleIndex, tag, tag[ruleIndex])
    if (this.isSpeedy && sheet.insertRule) {
      rule = rule.trim() ? rule : '#___stylesheet-empty-rule____{}'
      sheet.deleteRule(ruleIndex)
      sheet.insertRule(
        rule,
        ruleIndex
      )
    } else {
      tag[ruleIndex].textContent = rule
    }
    return index
  }
  delete(index) {
    this.replace(index, '')
  }
  flush() {
    if (isBrowser) {
      forEach(this.tags, tag => tag.parentNode.removeChild(tag))
      this.tags = []
      this.sheet = null
      this.ctr = 0
      // todo - look for remnants in document.styleSheets
    } else {
      // simpler on server
      this.sheet.cssRules = []
    }
    this.injected = false
  }
  rules() {
    if (!isBrowser) {
      return this.sheet.cssRules
    }
    let arr = []
    this.tags.forEach(tag =>
      arr.splice(arr.length, 0, ...Array.from(sheetForTag(tag).cssRules))
    )
    return arr
  }
  get length() {
    return this.ctr
  }
}
