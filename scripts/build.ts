import fs from 'fs'
import c from 'chalk'
import PQueue from 'p-queue'
import { join } from 'path'
import { ResolvedConfig, resolveConfig, build as viteBuild } from 'vite'
import { compile, makeArgs, mergeHTML } from './compile-template'
import type { Post } from '../src/main'

function log(text: string) {
  console.log(`${c.gray('[build]')} ${c.yellow(text)}`)
}

function logEnd(text: string) {
  console.log(`${c.gray('[build]')} ${c.greenBright(text)}`)
}

async function resolveAlias(config: ResolvedConfig, entry: string) {
  const result = await config.createResolver()(entry, config.root)
  return result || join(config.root, entry)
}

function filePathToId(file: string): string {
  return file.match(/([^/]+)\.html$/)?.[1] ?? ''
}

function compileTemplates(base: string, raw: { [path: string]: string }) {
  const result: { [path: string]: (data: any) => string } = {}
  for (const key in raw) {
    const id = filePathToId(key.replace(/[\\]+/g, '/'))
    const template = mergeHTML(base, raw[key])
    const renderFn = compile(id, template, '{ site, posts, post, strip_html, katex }')
    result[id] = renderFn
  }
  return result
}

async function formatHTML(html: string): Promise<string> {
  const minifier = await import('html-minifier')
  return minifier.minify(html, {
    collapseWhitespace: true,
    caseSensitive: true,
    collapseInlineTagWhitespace: false,
    minifyJS: true,
    minifyCSS: true,
  })
}

async function build() {
  const config = await resolveConfig({}, 'build', 'production', 'production')

  const out = join(config.root, config.build.outDir)

  const ssrOut = join(config.root, 'node_modules', '.ssr')
  fs.rmSync(ssrOut, { recursive: true, force: true })

  log('Build for client...')
  await viteBuild({
    build: {
      modulePreload: { polyfill: false },
      // ssrManifest: true,
    },
    mode: config.mode,
  })

  console.log()
  log('Build for server...')
  const ssrEntry = await resolveAlias(config, 'src/main.ts')
  await viteBuild({
    build: {
      ssr: ssrEntry,
      outDir: ssrOut,
      minify: false,
      cssCodeSplit: false,
    },
    mode: config.mode,
    logLevel: 'warn',
  })

  // Vite cleans outdir on build, so the package.json should be created after that
  fs.writeFileSync(join(ssrOut, 'package.json'), '{"type":"module"}')

  fs.mkdirSync(join(out, 'p'), { recursive: true })

  const serverEntry = join(process.platform === 'win32' ? 'file://' : '', ssrOut, 'main.js')
  const { templates: templates_, posts: posts_ } = (await import(serverEntry)) as {
    templates: { [path: string]: string }
    posts: { [path: string]: { readonly default: Required<Post> } }
  }
  const indexHTML = fs.readFileSync(join(out, 'index.html'), 'utf8')
  const templates = compileTemplates(indexHTML, templates_)
  const posts = Object.values(posts_).map((mod) => mod.default)

  // const critters = await import('critters').then((mod) => {
  //   const Critters = mod.default
  //   return new Critters({
  //     path: out,
  //     logLevel: 'error',
  //     external: true,
  //     inlineFonts: true,
  //     preloadFonts: true,
  //   })
  // })

  // const manifest: Manifest = JSON.parse(fs.readFileSync(join(out, 'ssr-manifest.json'), 'utf8'))
  // TODO Preload assets using manifest

  const queue = new PQueue({ concurrency: 20 })
  const outFiles: string[] = []
  const output = async (file: string, html: string) => {
    outFiles.push(file)
    const filename = join(out, file)
    // const transformed = await critters.process(html)
    const formatted = await formatHTML(html)
    await fs.promises.writeFile(filename, formatted)
  }

  for (const page of ['index', 'p']) {
    const filename = page === 'index' ? 'index.html' : `${page}/index.html`
    queue.add(() => output(filename, templates[page](makeArgs(posts))))
  }

  for (const post of posts) {
    queue.add(() => output(`p/${post.id}.html`, templates.post(makeArgs(posts, post))))
  }

  await queue.start().onIdle()

  fs.rmSync(ssrOut, { recursive: true, force: true })

  const paths: { file: string; prefix: string; filename: string; length: number }[] = []
  for (const file of outFiles) {
    const path = join(config.build.outDir, file)
    const i = path.lastIndexOf('/') + 1
    const prefix = path.slice(0, i)
    const filename = path.slice(i)
    paths.push({ file, prefix, filename, length: path.length })
  }

  const maxPath = paths.reduce((len, a) => Math.max(len, a.length), 0) + 2

  for (const { file, prefix, filename, length } of paths) {
    const sizeStr = `${(fs.statSync(join(out, file)).size / 1024).toFixed(2)} kB`
    config.logger.info(c.dim(prefix) + c.green(filename) + ' '.repeat(maxPath - length) + c.dim.bold(sizeStr))
  }

  console.log()
  logEnd('Build finished.')

  const waitInSeconds = 15
  setTimeout(() => {
    log(`Force exit after ${waitInSeconds}s.`)
    process.exit()
  }, waitInSeconds * 1000).unref()
}

await build()

// Now './dist' exists, write feed.xml there
await import('./rss')
