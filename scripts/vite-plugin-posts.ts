import { type Plugin, createFilter } from 'vite'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { markdownToJs as markdownToJs_, type Parsed } from './markdown-to-js'

interface IPostCache {
  [id: string]: { hash: string; data: Parsed } | undefined
}

export function posts(): Plugin {
  const filter = createFilter(/\.md$/)
  const cacheFile = join('node_modules', '.posts-cache.json')

  let cache: IPostCache = {}
  try {
    cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  } catch {}

  async function markdownToJs(id: string, raw: string): Promise<string> {
    let hash = createHash('md5').update(raw).digest('base64')
    let entry = cache[id]
    if (entry?.hash !== hash) {
      cache[id] = entry = { hash, data: await markdownToJs_(id, raw) }
      saveCacheEventually()
    }
    return `export default /* @__PURE__ */ JSON.parse(${JSON.stringify(JSON.stringify(entry.data))});`
  }

  let timer: ReturnType<typeof setTimeout>
  function saveCacheEventually() {
    clearTimeout(timer)
    timer = setTimeout(saveCache, 1000)
  }
  function saveCache() {
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
