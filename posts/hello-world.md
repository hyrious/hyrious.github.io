---
title: Hello, world!
date: 2023-11-17
---

我又㕛叕重写了一遍博客，这次用上了 [Vite](https://vitejs.dev/)。其实我以前用过不少博客生成器，包括 [Jekyll](https://jekyllrb.com/)、[Hexo](https://hexo.io/)、[Gatsby](https://www.gatsbyjs.com/) 等等，但是他们要么渲染太慢，要么安装成本太大。我[曾经](https://github.com/hyrious/hyrious/issues/5)口胡过详细的需求，简单来说我需要这个生成器拥有以下功能：

- 支持无 JS 访问，也就是说整个页面只有 HTML 和 CSS 就应该能正常运行了
- 支持 [GFM](https://github.github.com/gfm/ 'GitHub Flavored Markdown')，因为源码放在 GitHub，最好能直接打开 GitHub 观看
- 仍然支持按需引入 JS 脚本，这样在我的博客上阅读时可以有更丰富的体验
- [优化] 支持秒级刷新，这样编辑时基本不会打断思路（我时不时就想看看渲染结果）

我曾经试过手撸 HTML 源码，这样确实灵活性很高且只需要<abbr title="不含学习 HTML 和 CSS 的时间">成本为零</abbr>的先验知识，但是遇到代码高亮等读写都比较麻烦的内容还是不够方便。后来我写了一个 [telegraph](https://github.com/hyrious/telegraph)，除了灵活度不高外基本实现了上述需求。

这次重写我决定尝试一下 Vite 的 [SSR](https://vitejs.dev/guide/ssr.html#pre-rendering-ssg)，在研究了一下 [Vue](https://github.com/antfu/vite-ssg) 的方案后，我发现核心就是要让前端代码能跑在 Node.js 上，这样本地的脚本就可以分析同一份前端数据以渲染那些网页了。

```js
// src/main.ts
export const app = import.meta.env.SSR ? createSSRApp(App) : createApp(App)

// scripts/build.ts
import { app } from '../src/main'
console.log(renderToString(app))
```

因为我不想要运行时带一个 100 kB 的 Vue，但是又想要 dev 环境下能看到内容，最后我的入口文件长这样：

```js
// 这几个变量都是纯的，打包时会被 tree shake 掉
export let templates = {}
export let posts = {}

// 只在预渲染和 dev 时加载真正的数据
if (import.meta.env.SSR || import.meta.hot) {
  templates = import.meta.glob('./templates/*.html', { as: 'raw', eager: true })
  posts = import.meta.glob('../posts/*.md', { eager: true })

  if (import.meta.hot) {
    render(location.pathname, templates, posts)
    import.meta.hot.accept()
  }
}
```

完整的代码见[这里](https://github.com/hyrious/hyrious.github.io/blob/-/src/main.ts)。

经过这么一通折腾，现在我可以用 Vite 生成无 JS 的博客了！

```
> @ build /path/to/hyrious.github.io
> esbuild-dev scripts/build.ts

[build] Build for client...
vite v5.0.0 building for production...
✓ 7 modules transformed.
dist/index.html                 0.50 kB │ gzip: 0.30 kB
dist/assets/index-vWxNvpCb.css  6.42 kB │ gzip: 2.37 kB
✓ built in 898ms

[build] Build for server...
dist/index.html          4.41 kB
dist/p/index.html        3.04 kB
dist/p/hello-world.html  12.11 kB

[build] Build finished.
```
