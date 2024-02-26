import './style.scss'

export type Post = import('../scripts/markdown-to-js').Parsed

// variables here are only for SSR, they are empty in browser
export let templates: { [path: string]: string } = {}
export let posts: { [path: string]: Required<Post> } = {}
//                   ^^^^ parse(path) => id
//                                  ^^^^^^^^^^^^^^ generated by ../scripts/vite-plugin-posts.ts

if (import.meta.env.SSR || import.meta.hot) {
  templates = import.meta.glob('./templates/*.html', { query: 'raw', import: 'default', eager: true })
  posts = import.meta.glob('../posts/*.md', { import: 'default', eager: true })

  if (import.meta.hot) {
    const { compile, makeArgs } = await import('../scripts/compile-template')

    async function update(t: typeof templates, p: typeof posts) {
      let done = false
      function refresh(html: string) {
        const dom = new DOMParser().parseFromString(html, 'text/html')
        document.title = dom.title || 'hyrious.log'
        document.body.className = dom.body.className
        document.body.innerHTML = dom.body.innerHTML
        done = true
      }

      // console.debug({ t, p })
      const { pathname } = location
      const posts_ = Object.values(p)
      const argsStr = '{ site, posts, post, strip_html, katex }'

      // update /index.html
      if (['/', '/index', '/index.html'].includes(pathname)) {
        const render = compile('index', t['./templates/index.html'], argsStr)
        refresh(render(makeArgs(posts_)))
      }

      // update /p/index.html
      else if (['/p/', '/p/index', '/p/index.html'].includes(pathname)) {
        const render = compile('p', t['./templates/p.html'], argsStr)
        refresh(render(makeArgs(posts_)))
      }

      // update /p/hello-world.html
      else if (pathname.startsWith('/p/')) {
        const id = pathname.slice(3).replace(/\.html$/, '')
        const post = p[`../posts/${id}.md`]
        if (post) {
          const render = compile('post', t['./templates/post.html'], argsStr)
          refresh(render(makeArgs(posts_, post)))
        }
      }

      // 404
      if (!done) {
        document.title = '404 Not found'
        document.body.className = ''
        document.body.innerHTML = `<h1>404 Not found</h1>`
      }

      // Patch <a> tags to use client-side navigation
      document.querySelectorAll('a').forEach((a) => {
        if (a.href.startsWith(location.origin)) {
          a.onclick = (e) => {
            e.preventDefault()
            history.pushState({}, '', a.href)
            update(t, p)
          }
        }
      })
      onpopstate = () => update(t, p)
    }

    if (!import.meta.hot.data.accepted) {
      await update(templates, posts)
    }

    import.meta.hot.accept(async (mod) => {
      if (mod) {
        await update(mod.templates, mod.posts)
        import.meta.hot!.data.accepted = true
      }
    })
  }
}
