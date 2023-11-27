---
title: 代码分割并不简单
date: 2023-11-27
---

Code Splitting 一直是前端性能优化的一个重要手段，但是如此重要的功能在 [esbuild](https://esbuild.github.io/api/#splitting) 中时至今日仍然是实验性的，这是为什么呢？下面就来看看。

### 一个简单的例子

考虑下面这段代码：

```js
// shared.js
export let util = 1

// a.js (entry)
import { util } from './shared.js'
import b from './b.js'
foo(b, util)

// b.js (entry)
import { util } from './shared.js'
export default bar(util)
```

如果我要你对 a.js 和 b.js 进行打包，且要求仅打包出两个文件，如何对敌？

简单来说，此时你必须决定把 shared.js 放入某个文件里，而这次「放入」实际上产生了某种程度上说可以称之为错误的结果，下面就来看看：

```js
// dist/a.js (a + shared)
export let util = 1
import b from './b.js' // a -> b
foo(b, util)

// dist/b.js (b)
import { util } from './a.js' // b -> a
export default bar(util)
```

可以观察到：竟然出现了循环引用！实际上光是在 dist/a.js 中创建出 `util` 这个导出都是有问题的——因为原文件 a.js 没有要你导出 `util`。

语义上的事情暂且放到一边，接下来看看运行时效果是否正确。因为 a.js 和 b.js 都是入口文件，理论上他们都可能被单独执行。然而，当你运行 dist/a.js 时，他要 import dist/b.js，所以 bar() 先执行；当你运行 dist/b.js 时，他要 import dist/a.js，所以 foo() 先执行。🤯

但是我们看一下源文件，b.js 压根没有依赖 a.js，所以理论上来说执行 b.js 时不应该执行 foo() 才对。

### 副作用管理没有<abbr title="trivial">平凡</abbr>解

我们的软件功能基于副作用工作，大部分<abbr title="imperative">命令式</abbr>编程语言需要代码按顺序运行。考虑下面的代码，从语法上说他们是分离的语法树，但是由于引用关系，一些代码必须要在其他一些代码之后执行：

```js
class A {} // [1]
A.foo = 1 // [2] 必须在 [1] 之后执行

// [3] 「似乎」不需要在 [1] 之后执行
function foo() {
  return new A()
}

foo() // [4] 如果你不知道 foo() 里在干什么，你无法确定 [4] 要在 [1] 之后执行
```

实际上，追踪语法树之间的**实际执行顺序**关系太复杂了 (光是引用关系还好说，但是在 JavaScript 中可以轻易出现交叉引用)，各种隐式的依赖关系几乎不可能分析完整。因为打包器无法知道产物具体是如何运行的，只能尽最大努力兼容所有情况，出现 [bug](https://github.com/evanw/esbuild/issues/399) 也是常有的。

### 如何实践

对于库作者，尽量发布 ESM 格式的纯函数包。如果要依赖副作用，可以手动包装成工厂函数或者其他形式实现懒惰加载，如此一来等到运行时，相关副作用代码大概率已经被执行过了，就不怕顺序问题了。另外，尽量不要出现循环引用，打包器通常很难决定在这种情况下哪个文件先执行。

```js
// bundle.js
export function foo() {
  return new A()
}
class A {} // 假设 class A {} 被打包器挪到了后面
A.data = 1 // 副作用

// main.js
foo() // 用户代码执行的时候也不怕 A.data 未定义了
```

对于终端开发者，如果你有 HTTP/2，可以无脑使用打包器的默认配置来分包，通常情况下会分出相当多的碎片，这主要是为了保证语义和运行顺序的正确性。不用担心碎片文件的性能问题，我们还有 [preload](https://guybedford.com/es-module-preloading-integrity#modulepreload-polyfill) 机制可以提前下载并解析模块。一句话概括，Just use [Vite](https://vitejs.dev/)。

如果你需要一定程度的手动配置 ([Manual chunks](https://github.com/evanw/esbuild/issues/207))，目前 Rollup 和 webpack 各自实现了一套相对稳定的分包算法。而 esbuild 还没实现，不过你可以[手动](https://github.com/hyrious/esbuild-split-vendors-example)模拟 webpack 的效果。
