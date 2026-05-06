---
title: 如何修复 `Readable.fromWeb(response.body)` 类型报错？
date: 2025-09-10
---

```ts twoslash
// @errors: 2345
import * as stream from 'node:stream'

const response = await fetch('https://example.com')

if (response.body) {
  stream.Readable.fromWeb(response.body)
  //                               ^?
}
```

观察 `fetch` 的类型，会发现他来自 lib.dom.d.ts，可是哪一行代码引入了 DOM 类型呢？

```json
// tsconfig 里也没写 DOM ... 吗
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

其实，不写 `"lib"` 等于引入了默认 lib，也就是 [typescript/lib/lib.d.ts](https://cdn.jsdelivr.net/npm/typescript/lib/lib.d.ts)：

```ts
/// <reference lib="es5" />
/// <reference lib="dom" />
/// <reference lib="webworker.importscripts" />
/// <reference lib="scripthost" />
```

所以一个显而易见的修复方案是，手动指定一下 lib：

```json
{
  "compilerOptions": {
    "lib": ["ES2024"], // <-- 没有 DOM
    "types": ["node"]
  }
}
```

但是这个办法只能在所有文件都是 Node.js 环境的才可以，实际项目可能组织成下面这样：

- `src/vs/base/common/disposable.ts`
- `src/vs/base/node/fs.ts`
- `src/vs/base/browser/dom.ts`
- `src/tsconfig.json` (管所有文件)

> 简单解释一下这个结构：`{源码文件夹}/{独立模块}/{运行环境}/{代码}.ts` \
> 独立模块们可能是由不同人开发的，但是相比 [monorepo 里开一堆包](https://github.com/pnpm/pnpm)，这个结构不需要额外写一大堆内容大部分重复的 package.json，也不需要在每个子包里精确管理依赖（只要最顶层这个包的依赖完整即可）。\
> 根据运行环境分隔代码的好处是，开发者可以编写简单的 [lint 插件](https://github.com/microsoft/vscode/blob/main/.eslint-plugin-local/code-import-patterns.ts) 避免例如前端的代码引用了后端的问题。需要注意的是这种风格下最好避免使用 Barrel files (index.ts)。

这种情况下就不能避免 DOM 类型被引入了，解法是我们强行让 DOM 里的 Response 兼容 Node.js 里的：

```ts twoslash
import * as stream from 'node:stream'

// 注意到 DOM 里的 Response 是全局的, 可以通过 declare global 来修改他
import * as streamWeb from 'stream/web'
declare global {
  interface Response {
    body: streamWeb.ReadableStream<Uint8Array> | null
  }
}

const response = await fetch('https://example.com')

if (response.body) {
  stream.Readable.fromWeb(response.body)
  //                               ^?
}
```
