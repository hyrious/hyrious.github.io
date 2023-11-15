import { Plugin, createFilter } from 'vite'
import { markdownToJs as markdownToJs_ } from './markdown-to-js'

export function posts(): Plugin {
  const filter = createFilter(/\.md$/)

  async function markdownToJs(id: string, raw: string): Promise<string> {
    const data = await markdownToJs_(id, raw)
    return `export default /* @__PURE__ */ JSON.parse(${JSON.stringify(JSON.stringify(data))});`
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
