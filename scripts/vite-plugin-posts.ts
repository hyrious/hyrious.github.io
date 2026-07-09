import { type Plugin, createFilter } from 'vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import quoteJsString from 'quote-js-string'

interface IPostCache {
  [id: string]: { hash: string; data: import('./markdown-to-js').Parsed } | undefined
}

export function posts(): Plugin {
  const filter = createFilter(/\.md$/)
  const cacheFile = join('node_modules', '.cache', 'hyrious-posts.json')
  const markdownToJs_ = import('./markdown-to-js').then((mod) => mod.markdownToJs)

  let cache: IPostCache = {}
  try {
    cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  } catch {}

  async function markdownToJs(id: string, raw: string): Promise<string> {
    let hash = createHash('md5').update(raw).digest('base64')
    let entry = cache[id]
    if (entry?.hash !== hash) {
      const render = await markdownToJs_
      cache[id] = entry = { hash, data: await render(id, raw) }
      saveCacheEventually()
    }
    return `export default /* @__PURE__ */ JSON.parse(${quoteJsString(JSON.stringify(entry.data))});`
  }

  let timer: ReturnType<typeof setTimeout>
  function saveCacheEventually() {
    clearTimeout(timer)
    timer = setTimeout(saveCache, 1000)
  }
  function saveCache() {
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, JSON.stringify(cache))
  }

  return {
    name: 'hyrious:md',
    enforce: 'pre',
    async transform(raw, id) {
      if (filter(id)) {
        try {
          return markdownToJs(id, raw)
        } catch (e) {
          this.error(e)
        }
      }
    },
    handleHotUpdate(ctx) {
      if (filter(ctx.file)) {
        const { read } = ctx
        ctx.read = async function () {
          return markdownToJs(ctx.file, await read())
        }
      }
    },
  }
}
