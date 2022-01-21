import { promises } from 'fs'
import { posts, renderIndexHTML, renderPost, today } from './lib/collect.js'

const [command, ...args] = process.argv.slice(2)
if (command === 'dev') {
  const { onInit, sendUpdate, server } = await import('./lib/server.js')
  const { controller, initWatcher } = await import('./lib/watcher.js')
  server.listen(3000, () => console.log('serving http://localhost:3000'))
  onInit(() => {
    sendUpdate('init')
    initWatcher()
  })
  process.on('SIGINT', () => {
    controller.abort()
    server.close()
    process.exit(0)
  })
}
if (command === 'build') {
  const { renderMarkdown, sortByDate } = await import('./lib/render.js')
  const { build } = await import('esbuild')
  const rendered = await Promise.all(posts.map(e => renderMarkdown(e.path)))
  const baked = sortByDate(
    rendered.map(e => ({ ...e, contents: renderPost(e) })),
  )
  const indexHTML = renderIndexHTML(baked)
  await promises.rm('p', { recursive: true })
  await promises.mkdir('p', { recursive: true })
  await Promise.all([
    build({
      entryPoints: ['_src/style.css'],
      bundle: true,
      minify: true,
      outfile: 'style.css',
    }),
    promises.writeFile('index.html', indexHTML),
    ...baked.map(({ contents, link }) => {
      return promises.writeFile(link, contents)
    }),
  ])
}
if (command === 'preview') {
  const { spawnSync } = await import('child_process')
  process.exit(spawnSync('w7', { stdio: 'inherit' }).status)
}
if (command === 'new') {
  const [name] = args
  const src = `_src/posts/${name}.md`
  await promises.writeFile(
    src,
    `---\ntitle: Hello, world!\ndate: ${today}\n---\n\nHello, world!\n`,
  )
  console.log('created', src)
}
