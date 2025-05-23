import katex from 'katex'
import matter from 'gray-matter'
import QuickLRU from 'quick-lru'
import { apStyleTitleCase } from 'ap-style-title-case'
import { marked, Renderer, type TokenizerAndRendererExtension, type Tokens } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import { default as markedLinkifyIt } from 'marked-linkify-it'
import { bundledLanguages, createHighlighter } from 'shiki'
import { transformerMetaWordHighlight, transformerNotationDiff } from '@shikijs/transformers'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { rendererRich, transformerTwoslash } from '@shikijs/twoslash'

export interface Parsed {
  id: string
  title: string
  date: Date
  raw: string
  html: string
  katex: boolean
}

const emptyParsed: Parsed = {
  id: '',
  title: '',
  date: new Date(),
  raw: '',
  html: '',
  katex: false,
}

const shiki_p = createHighlighter({
  themes: ['github-dark', 'github-light'],
  langs: Object.keys(bundledLanguages),
  engine: createJavaScriptRegexEngine(),
})

const twoslashCache = new QuickLRU<string, string>({ maxSize: 114 })
const highlight = markedHighlight({
  async: true,
  async highlight(code, lang, info) {
    const key = lang + '\x00' + code
    if (info.includes('twoslash') && twoslashCache.has(key)) {
      return twoslashCache.get(key)!
    }
    if (lang in bundledLanguages) {
      const shiki = await shiki_p
      const html = shiki.codeToHtml(code, {
        lang,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        cssVariablePrefix: '--s-',
        meta: { __raw: info },
        transformers: [
          transformerTwoslash({
            explicitTrigger: true,
            renderer: rendererRich({ jsdoc: false }),
          }),
          transformerNotationDiff(),
        ],
      })
      if (info.includes('twoslash')) {
        twoslashCache.set(key, html)
      }
      return html
    } else {
      return code
    }
  },
})
// Patch the renderer object because shiki returns <pre> already, I don't want double <pre>
const highlight_code = highlight.renderer!.code! as any;
highlight.renderer!.code = function custom_code(token: Tokens.Code): string | false {
  let str = highlight_code.call(this, token)
  if (str && str.startsWith('<pre><code') && str.includes('shiki')) {
    const start = str.indexOf('<pre', 1)
    const end = str.lastIndexOf('</code>')
    if (start >= 0 && end >= 0) return str.slice(start, end)
  }
  return str
}

marked.use(markedLinkifyIt(), gfmHeadingId(), highlight)

const math: TokenizerAndRendererExtension = {
  name: 'math',
  level: 'inline',
  start(src) {
    return src.match(/\$\$[^\$]+?\$\$|\$[^\$]+?\$/)?.index
  },
  tokenizer(src, tokens) {
    const block = /^\$\$([^\$]+?)\$\$/.exec(src)
    if (block) {
      return { type: 'math', raw: block[0], text: block[1], tokens: [], display: true }
    }
    const inline = /^\$([^\$]+?)\$/.exec(src)
    if (inline) {
      return { type: 'math', raw: inline[0], text: inline[1], tokens: [], display: false }
    }
  },
  renderer(token) {
    return katex.renderToString(token.text, { displayMode: token.display, output: 'html' })
  },
}

const footnote: TokenizerAndRendererExtension[] = [
  {
    name: 'footnoteList',
    level: 'block',
    start(src) {
      return src.match(/^\[\^\d+\]:/)?.index
    },
    tokenizer(src, tokens) {
      const match = /^(?:\[\^(\d+)\]:[^\n]*(?:\n|$))+/.exec(src)
      if (match) {
        const token = { type: 'footnoteList', raw: match[0], text: match[0].trim(), tokens: [] }
        this.lexer.inline(token.text, token.tokens)
        return token
      }
    },
    renderer(token) {
      const fragment = this.parser.parseInline(token.tokens || [])
      return `<section class="footnotes"><ol dir="auto">${fragment}</ol></section>\n`
    },
  },
  {
    name: 'footnote',
    level: 'inline',
    start(src) {
      return src.match(/\[\^\d+\]/)?.index
    },
    tokenizer(src, tokens) {
      const list = /^\[\^(\d+)\]:([^\n]*)(?:\n|$)/.exec(src)
      if (list) {
        const tokens = this.lexer.inlineTokens(list[2].trim(), [])
        return { type: 'footnote', raw: list[0], id: parseInt(list[1]), tokens, def: true }
      }
      const inline = /^\[\^(\d+)\]/.exec(src)
      if (inline) {
        return { type: 'footnote', raw: inline[0], id: parseInt(inline[1]), tokens: [], def: false }
      }
    },
    renderer(token) {
      if (!token.def) {
        return `<sup><a href="#user-content-fn-${token.id}" data-footnote-ref="" id="user-content-fnref-${token.id}">${token.id}</a></sup>`
      }
      const fragment = this.parser.parseInline(token.tokens || [])
      return `<li id="user-content-fn-${token.id}"><p dir="auto">${fragment} <a href="#user-content-fnref-${token.id}" class="data-footnote-backref" aria-label="Back to content"><g-emoji class="g-emoji" alias="leftwards_arrow_with_hook" fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/21a9.png">↩</g-emoji></a></p></li>`
    },
  },
]

marked.use({
  async: true,
  gfm: true,
  pedantic: false,
  extensions: [math, ...footnote],
  renderer: {
    code({ text, lang }) {
      if (lang === 'math') {
        return `<p class="math">${katex.renderToString(text, { displayMode: true, output: 'html' })}</p>`
      }
      return false
    },
    link(arg) {
      let html = Renderer.prototype.link.call(this, arg)
      if (arg.href.startsWith('http')) {
        html = html.replace(/^<a /, '<a target="_blank" rel="noopener" ')
      }
      return html
    },
  },
  hooks: {
    postprocess: optimizeShiki,
  },
})

function optimizeShiki(html: string): string {
  const shikiRegex = /style="--s-[^"]+"/gi
  const styles = new Set<string>()
  html.replaceAll(shikiRegex, s => (styles.add(s), ''))
  if (styles.size > 0) {
    const styleToClass = new Map<string, number>()
    const light: string[] = [], dark: string[] = []
    for (const style of styles) {
      extractStyle(style, styleToClass, light, dark)
    }
    const style: string = light.join('') + '@media(prefers-color-scheme:dark){' + dark.join('') + '}'
    html = `<style>${style}</style>${html}`
    html = html.replaceAll(shikiRegex, s => `class="μ${styleToClass.get(s)}"`)
    html = html.replaceAll(/\bclass="([^"]+)" class="([^"]+)"/gi, (_, a, b) => `class="${a} ${b}"`)
  }
  return html
}

function extractStyle(style: string, map: Map<string, number>, light_: string[], dark_: string[]) {
  if (map.has(style)) return;
  const light: string[] = [], dark: string[] = []
  const declarations = style.slice(7, -1).split(';')
  for (const declaration of declarations) {
    const [cssVar, value] = declaration.split(':')
    switch (cssVar) {
      case '--s-light': light.push(`color:${value}`); break
      case '--s-dark': dark.push(`color:${value}`); break
      case '--s-light-bg': light.push(`background-color:${value}`); break
      case '--s-dark-bg': dark.push(`background-color:${value}`); break
      case '--s-light-font-weight': light.push(`font-weight:${value}`); break
      case '--s-dark-font-weight': dark.push(`font-weight:${value}`); break
      default: throw new Error(`Unprocessed shiki var: ${style}`)
    }
  }
  light_.push(`.μ${map.size}{${light.join(';')}}`)
  dark_.push(`.μ${map.size}{${dark.join(';')}}`)
  map.set(style, map.size)
}

export async function markdownToJs(file: string, raw: string): Promise<Parsed> {
  file = file.replace(/[\\]+/g, '/')
  raw = raw.replace(/\r\n/g, '\n')

  const id = filePathToId(file)
  const { data, content } = matter(raw)
  if (!data) return missingFrontMatter(id)

  const title = (await marked.parseInline(data.title)) ?? apStyleTitleCase(id.replace(/-/g, ' '))
  const date = new Date(data.date ?? Date.now())

  const html = (await marked.parse(content, { async: true })).trimEnd()
  const katex = html.includes('<p class="math"') || html.includes('<span class="katex"')

  return { id, title, date, raw, html, katex }
}

function filePathToId(file: string): string {
  return file.match(/([^/]+)\.md$/)?.[1] ?? ''
}

function missingFrontMatter(id: string): Parsed {
  return { ...emptyParsed, id, title: 'error: missing frontmatter in ' + id }
}
