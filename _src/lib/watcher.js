import { watch } from 'fs'
import { basename, join } from 'path'
import { gatherPosts, today } from './collect.js'
import { renderMarkdown, sortByDate } from './render.js'
import { sendUpdate } from './server.js'

export const controller = new AbortController()

let posts = new Map()

watch('_src/posts', { signal: controller.signal }, async (type, filename) => {
  const name = basename(filename, '.md')
  const data = await renderMarkdown(join('_src/posts', filename))
  posts.set(name, data)
  notifyIndexChange()
  notifyPostChange()
})

function notifyIndexChange() {
  sendUpdate('update-index', {
    date: today,
    posts: sortByDate([...posts.values()]),
  })
}

function notifyPostChange() {
  for (const [name, data] of posts) {
    sendUpdate('update-post', { name, ...data })
  }
}

for (const { path, link, mtime } of gatherPosts()) {
  const name = basename(path, '.md')
  const data = await renderMarkdown(path)
  posts.set(name, data)
}

export function initWatcher() {
  if (posts.size > 0) {
    notifyIndexChange()
    notifyPostChange()
  }
}
