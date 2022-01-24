import { promises } from 'fs'
import { basename } from 'path'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import highlightjs from 'markdown-it-highlightjs'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

md.use(highlightjs)

export async function renderMarkdown(path) {
  const text = await promises.readFile(path, 'utf8')
  const { data, content } = matter(text)
  const contents = md.render(content)
  return { ...data, contents, link: `p/${basename(path, '.md')}.html` }
}

/** @param posts {{ date: Date }[]} */
export function sortByDate(posts) {
  return posts.sort((a, b) => b.date - a.date).reverse()
}
