import chalk from 'chalk'
import type { Post } from '../src/main'

class Token {
  constructor(
    public head: string,
    public tail: string,
    public expr: string | null,
    public raw: string | null,
  ) {}
}

function next_mustache_tag(str: string): Token | undefined {
  let i: number, j: number
  if ((i = str.indexOf('{')) >= 0) {
    if (str[i + 1] === '{') {
      if ((j = str.indexOf('}}', i + 2)) >= 0) {
        return new Token(str.slice(0, i), str.slice(j + 2), null, str.slice(i + 1, j + 1))
      }
    }
    if ((j = str.indexOf('}', i + 1)) >= 0) {
      return new Token(str.slice(0, i), str.slice(j + 1), str.slice(i + 1, j), null)
    }
  }
}

function s(str: string) {
  return JSON.stringify(str)
}

function expr(str: string, id: string) {
  if (str.startsWith('#if')) return `if (${str.slice(3).trim()}) {\n`
  if (str.startsWith('#else')) return '} else {\n'
  if (str.startsWith('#else if')) return `} else if (${str.slice(8).trim()}) {\n`
  if (str.startsWith('/if')) return '}\n'
  if (str.startsWith('#each')) {
    const [list, x] = str.slice(5).split(' as ')
    return `for (const ${x.trim()} of ${list.trim()}) {\n`
  }
  if (str.startsWith('/each')) return '}\n'
  if (str.startsWith('@const')) return `const ${str.slice(6)}\n`
  if (str.startsWith('@debug')) return `console.log(${str.slice(6)})\n`
  return assert_syntax(str, id) ? `html += ${str.trim()}\n` : '\n'
}

export function compile(file: string, str: string, args: string) {
  str = str.replace(/\r\n/g, '\n')
  let code = "let html = '';\n"
  while (true) {
    const tag = next_mustache_tag(str)
    if (tag) {
      code += `html += ${s(tag.head)};\n`
      if (tag.raw) code += `html += ${s(tag.raw)};\n`
      if (tag.expr) code += expr(tag.expr, file)
    } else {
      code += `html += ${s(str)};\n`
      break
    }
    str = tag.tail
  }
  code += 'return html;'
  code = make_safe(code, file)
  const render = new Function(args, code)
  Object.defineProperty(render, 'name', { value: file })
  return render as (data: any) => string
}

function assert_syntax(str: string, file: string) {
  try {
    Function(`return (${str})`)
    return true
  } catch (syntax_error) {
    console.error(chalk.red(' syntax'), file + ':', chalk.red(str))
    return false
  }
}

function make_safe(content: string, source: string) {
  let code = 'try {\n'
  code += content + '\n'
  code += '} catch (error) {\n'
  let message = chalk.red('  error') + ' ' + source + ':'
  let format = chalk.red('|').split('|')
  code += `var message = ${s(format[0])} + error.message + ${s(format[1])}\n`
  code += `console.error(${s(message)}, message)\n`
  code += `return '<pre>' + error.stack + '</pre>'\n`
  code += '}'
  return code
}

export function mergeHTML(base: string, code: string): string {
  if (code.startsWith('<head')) {
    const head_attributes = code.match(/<head([^>]*)>/)?.[1] || ''
    if (head_attributes) {
      base = base.replace('<head>', `<head${head_attributes}>`)
    }
    const head_contents = (code.match(/>(.+?)<\/head>/s)?.[1] || '').trim()
    if (head_contents) {
      const title = head_contents.match(/<title>(.+?)<\/title>/)?.[1] || ''
      if (title) {
        base = base.replace(/<title>(.+?)<\/title>/, `<title>${title}</title>`)
      }
      // TODO: other meta tags
    }
  }
  if (code.includes('<body')) {
    code = code.slice(code.indexOf('<body'))
    const body_attributes = code.match(/<body([^>]*)>/)?.[1] || ''
    if (body_attributes) {
      base = base.replace('<body>', `<body${body_attributes}>`)
    }
    const body_contents = (code.match(/>(.+?)<\/body>/s)?.[1] || '').trim()
    if (body_contents) {
      base = base.replace('</body>', `  ${body_contents}\n</body>`)
    }
  }
  base = base.replace(/(<body[^>]*>)(\s+)/s, '$1\n  ')
  return base
}

export function makeArgs(posts: Required<Post>[], post?: Required<Post>): any {
  posts.map((p) => {
    p.date = new Date(p.date)
    p.date.toString = () => p.date.toISOString().slice(0, 10)
  })
  posts.sort((a, b) => +b.date - +a.date)
  return { site: { date: posts[0].date }, posts, post, strip_html, katex: post?.katex }
}

function strip_html(text: string) {
  return text.trim().replace(/<[!\/a-z].*?>/gi, '')
}
