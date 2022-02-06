import { fileURLToPath } from 'url'
import { readdirSync, promises, statSync } from 'fs'
import { normalize, basename, dirname, join, resolve } from 'path'
import { htmlEscape } from 'escape-goat'

const __filename = fileURLToPath(new URL(import.meta.url))
const __dirname = dirname(__filename)

const posts_folder = resolve(__dirname, '../posts')

export function gatherPosts() {
  return readdirSync(posts_folder)
    .filter(e => e.endsWith('.md'))
    .map(name => join(posts_folder, name))
    .map(path => ({
      path,
      link: `p/${basename(path, '.md')}.html`,
      mtime: statSync(path).mtime,
      // date is in the front matter, note that date != mtime
    }))
}

export const posts = gatherPosts()

export const template = `<!DOCTYPE html>
<html lang="zh-Hans-CN">
<head>
  <meta charset="UTF-8">
  <title>{{ title }}</title>
  <meta name="color-scheme" content="light dark">
  <meta name="viewport" content="width=device-width">
  <link rel="icon" href="../favicon.ico">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <h2>{{ title }}</h2>
  <address>最后更新于 <time>{{ date }}</time></address>
  {{ contents }}
  <footer>
    <p><a href="http://creativecommons.org/publicdomain/zero/1.0/">CC0</a> 2022 @ hyrious</p>
  </footer>
</body>
</html>
`

/** @param post {{ title: string, date: Date, contents: string }} */
export function renderPost({ title, date, contents }) {
  return template
    .replace('{{ title }}', htmlEscape(title))
    .replace('{{ title }}', htmlEscape(title)) // there are 2 {{ title }}
    .replace('{{ date }}', getDateString(date))
    .replace('{{ contents }}', contents.trimEnd())
}

const indexHtmlPath = resolve(__dirname, '../../index.html')
export const indexHTMLmtime = statSync(indexHtmlPath).mtime
const indexHTML = await promises.readFile(indexHtmlPath, 'utf8')
const beforeFOOTER = indexHTML.lastIndexOf('<footer')
const afterH3 = indexHTML.lastIndexOf('</h3>', beforeFOOTER) + '</h3>'.length
const beforeH3HTML = indexHTML.slice(0, afterH3)
const afterFooterHTML = indexHTML.slice(beforeFOOTER)

export const indexHtmlTemplate = [beforeH3HTML, afterFooterHTML]

export function getDateString(date) {
  return date.toISOString().split('T')[0]
}

export const today = getDateString(new Date())

/** @param links {{ title: string, link: string }[]} */
export function renderIndexHTML(links) {
  const sep = '\n  '
  let out = beforeH3HTML.replace(/<time>\S+</, `<time>${today}<`) + sep
  for (const { title, link } of links) {
    out += `<p><a href="${link}">${htmlEscape(title)}</a></p>` + sep
  }
  return out + afterFooterHTML
}
