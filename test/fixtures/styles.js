// eslint-disable-next-line import/no-extraneous-dependencies
import css from 'styled-jsx/css'

const color = 'red'

const bar = css`
  div { font-size: 3em }
`
export const uh = bar

export const foo = css`div { color: ${color}}`

export default css`
  div { font-size: 3em }
  p { color: ${color};}
`

