import katex from 'katex'
import matter from 'gray-matter'
import { apStyleTitleCase } from 'ap-style-title-case'
import { marked, Renderer, type TokenizerAndRendererExtension } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import { default as markedLinkifyIt } from 'marked-linkify-it'
import { bundledLanguages, getHighlighter } from 'shikiji'

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

const shiki_p = getHighlighter({
  themes: ['github-dark', 'github-light'],
  langs: Object.keys(bundledLanguages),
})

marked.use(
  markedLinkifyIt(),
  gfmHeadingId(),
  markedHighlight({
    async: true,
    async highlight(code, lang) {
      if (lang in bundledLanguages) {
        const shiki = await shiki_p
        return shiki.codeToHtml(code, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          cssVariablePrefix: '--s-',
        })
      } else {
        return code
      }
    },
  }),
)

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
    return katex.renderToString(token.text, { displayMode: token.display })
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
  // These are by default:
  // gfm: true,
  // pedantic: false,
  extensions: [math, ...footnote],
  renderer: {
    code(code, lang) {
      if (lang === 'math') {
        return `<p class="math">${katex.renderToString(code, { displayMode: true })}</p>`
      }
      return false
    },
    link(href, title, text) {
      let html = Renderer.prototype.link.call(this, href, title, text)
      if (href.startsWith('http')) {
        html = html.replace(/^<a /, '<a target="_blank" rel="noopener" ')
      }
      return html
    },
  },
  hooks: {
    preprocess: (a) => a,
    postprocess: optimizeShiki,
  },
})

function optimizeShiki(html: string): string {
  const colorRe = /style="color:#[0-9a-f]{6};--s-dark:#[0-9a-f]{6}"/gi
  let seen = new Set<string>()
  html.replaceAll(colorRe, (s) => {
    seen.add(s)
    return ''
  })
  if (seen.size > 0) {
    const colors = new Map<string, number>()
    const darks: string[] = []
    let style = ''
    for (const color of seen) {
      const light = color.slice(13, 20)
      const dark = color.slice(30, 37)
      darks.push(dark)
      const i = colors.size
      style += `.μ${i}{color:${light}}`
      colors.set(color, i)
    }
    style += '@media(prefers-color-scheme:dark){'
    darks.forEach((dark, i) => {
      style += `.μ${i}{color:${dark}}`
    })
    style += '}'
    html = `<style>${style}</style>${html}`
    html = html.replaceAll(colorRe, (s) => {
      const i = colors.get(s)!
      return `class="μ${i}"`
    })
  }
  return html
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
