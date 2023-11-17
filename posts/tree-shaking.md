---
title: 简单理解 Tree Shaking
date: 2022-01-25
---

问：如何分析并删除无用的 JS 代码？Tree-Shaking 给了打包器们一个简单的方法：只需要删除每个闭包里的没有**使用**且没有**副作用**的变量声明/表达式即可。剩下的就是需要给代码块（语法节点）标上有没有被使用、有没有副作用的信息。

怎么知道一段代码的副作用呢？<span class="half-shrink-left">（</span>换句话说，是不是<q>纯</q>的）

首先，纯字面量（数字，字符串等表达式）肯定没有副作用：

```js
42
'hello'
{ a: [] }
function(){} // 函数本身也是没有副作用的 -- 除非你调他
```

~~其次，~~ 没有其次了，仅此而已。光有上面这些信息就足够 shake 掉这个例子：

```js
function add(a, b) { return a + b }
function mul(a, b) { return a * b }
export let sum = add(3, 5)
```

<p align=center>&darr; &darr; &darr;</p>

```js
function add(a, b) { return a + b }
export let sum = add(3, 5)
```

但是——你一拍大腿——能不能把函数调用也删掉呢？例如，假如我最终没有用上面的 `sum`，能不能把它连同 `add` 的定义一起删掉呢？——是可以的，用 Pure Annotation：

```js
export let sum = /* @__PURE__ */ add(3, 5)
```

这个注释在告诉打包器：本次函数调用是<q>纯</q>的，其返回值和 `123` 差不多，如果没人用的话可以把这个调用删了。

**陷阱**：但是你不能删掉函数括号里的东西。这是因为参数本身可能是由别的副作用产生的，兴许有人依赖这个副作用呢。例如：

```js
/* @__PURE__ */ debugPrint(createApp())
```

<p align=center>&darr; &darr; &darr;</p>

```js
createApp()
```

这个标记对下面这种调用也有效：

```js
/* @__PURE__ */ React.createElement('div', {}, 'Hello')  // => nothing
/* @__PURE__ */ new A.b.c.d()                            // => nothing
```

细心的你已经发现了：你无法对访问下标（`a.b`）标记是否含有副作用。实际上 esbuild 会认为所有的 getter setter 都是有副作用的。所以下面这段代码不能被 shake 掉：

```js
let a = {}
a.b = 1
// 即使没有用到 a，这段代码也不能被删掉
```

如果有一些复杂的初始化函数，你可以使用下面这个写法来规避这个问题：

```js
let a = /* @__PURE__ */ (() => {
  let a = {}
  a.b = 1
  return a
})()
```

注意：esbuild 的 `--minify-whitespace` 会将 `/* @__PURE__ */` 视为空格删掉，因此在输出 esm 时一定要记得关闭这个功能。

- - -

**附赠：如何在打出的包里区分 dev/prod 环境？**

虽然 Node.js 推出了 conditional exports 并建议大家用这样的形式导出不同的包：

```json
"exports": {
  "development": "./dist/index.dev.js",
  "production": "./dist/index.prod.js"
}
```

但是前端生态可等不到他推广这个 feature，反而是使用了一个非常 cjs 的方法：

```js
if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/index.prod.js')
} else {
  module.exports = require('./dist/index.dev.js')
}
```

你可以在 React 和 Vue3 的包里看到这种写法，而且现代打包器都对这种写法做了预处理。

- - -

总之，理解了 Tree-Shaking 是如何工作的，才能让打包结果符合你的预期。
