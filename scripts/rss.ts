import fs from 'fs'
import { Feed, type Item } from 'feed'
import { markdownToJs } from './markdown-to-js'

const DOMAIN = 'https://hyrious.me'
const AUTHOR = {
  name: 'hyrious',
  email: 'hyrious@outlook.com',
  link: DOMAIN,
}

const feed = new Feed({
  title: 'hyrious.log',
  description: 'hyrious.log',
  author: AUTHOR,
  favicon: 'https://hyrious.me/favicon.svg',
  id: 'https://hyrious.me/',
  link: 'https://hyrious.me/',
  copyright: 'CC0 1.0',
  feedLinks: {
    json: 'https://hyrious.me/feed.json',
    atom: 'https://hyrious.me/feed.atom',
    rss: 'https://hyrious.me/feed.xml',
  },
})

const posts: Item[] = await Promise.all(
  fs
    .readdirSync('./posts')
    .filter((e) => e.endsWith('.md'))
    .map(async (e): Promise<Item> => {
      const raw = await fs.promises.readFile(`./posts/${e}`, 'utf-8')
      const { id, title, date, html } = await markdownToJs(`./posts/${e}`, raw)
      const content = html.replace('src="/', 'src="https://hyrious.me/')
      const link = `${DOMAIN}/p/${e.replace(/\.md$/, '')}`
      return { id, title, date, content, link }
    }),
).then((posts) => posts.sort((a, b) => +b.date - +a.date))

for (const post of posts) {
  feed.addItem(post)
}

fs.writeFileSync('./dist/feed.xml', feed.rss2())
fs.writeFileSync('./dist/feed.atom', feed.atom1())
fs.writeFileSync('./dist/feed.json', feed.json1())
