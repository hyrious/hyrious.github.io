---
title: 基于 Lezer Parser 写一个 Formatter
date: 2024-06-19
---

我不止一次萌生过自己写一个代码格式化工具的想法，但几乎都以失败告终。究其原因，正如 Anthony Fu 在 [为什么我不使用 Prettier](https://antfu.me/posts/why-not-prettier-zh) 中抱怨的，Prettier 这个工具总是有一些不尽如人意的格式化结果。但这一次，我发现了一个简单的实现方式。

Prettier 的 [实现方式](https://prettier.io/docs/en/technical-details) 十分容易理解：首先将代码解析成 AST，然后对着它重新输出一遍格式化好的代码。有趣的地方是他在输出一个子语法树的时候，可以对比不同的输出方式（比如使用换行或者不换行）来决定最<q>好看</q>的结果。

> 上述步骤有一个小坑，就是解析 AST 的库（例如 Acorn）通常在遇到语法错误时会直接退出解析，这使得语法不正确的代码无法被格式化。实际上 Prettier 现在就有这样的问题。

也就是说，如果要按 Prettier 方式写一个新的格式化工具，至少需要以下几个基础设施：

- 一个 Parser 用于把代码解析成 token 或者 AST；
- Token 身上要有一定的上下文信息，从而决定 `foo()` 的括号前面没有空格，而 `for ()` 的括号前面有空格。

诶，Acorn 作者写的另一个库 [Lezer](https://lezer.codemirror.net) 似乎刚好满足要求。而且他还能从语法错误中恢复解析，简直是针对这个需求量身定制的一样。

下面就来试试！

```js
import { parser } from '@lezer/javascript'

let tree = parser.parse('let a=1')
tree.iterate({
  enter(node) {
    console.log(node.name, node.from, node.to)
  },
})
// Script 0 7
// VariableDeclaration 0 7
// let 0 3
// VariableDefinition 4 5
// Equals 5 6
// Number 6 7
```

最细粒度的 token 一定都存储在叶子结点上，如何只输出叶子结点呢？观察 `enter` 和 `leave` 的调用规律不难看出，只有 `enter` 后面紧跟着一个 `leave` 的结点才是叶子结点，所以可以这么写：

```js
let enter = false
let input = 'let a=1'
let tree = parser.parse(input)
tree.iterate({
  enter() {
    enter = true
  },
  leave(node) {
    if (enter) {
      console.log(node.name, [input.slice(node.from, node.to)])
    }
    enter = false
  },
})
// let [ 'let' ]
// VariableDefinition [ 'a' ]
// Equals [ '=' ]
// Number [ '1' ]
```

上面的几个 token 直接 `.join(' ')` 似乎就可以得到想要的结果了，但如果是这样呢 &darr;

```js
let input = 'let a=1,b'
// let [ 'let' ]
// VariableDefinition [ 'a' ]
// Equals [ '=' ]
// Number [ '1' ]
// , [ ',' ]
// VariableDefinition [ 'b' ]
```

诶，这个 `,` 前面不应该有空格。嗯，看来可以对每个 `node.name` 增加一个是否有前后空格的配置：

```js
let spaceAfter = (s) => s + ' '
let spaceBefore = (s) => ' ' + s
let spaceAround = (s) => ' ' + s + ' '

let spec = {
  [',']: spaceAfter,
  let: spaceAfter,
  Equals: spaceAround,
}

let out = ''
let enter = false
tree.iterate({
  enter() {
    enter = true
  },
  leave(node) {
    if (enter) {
      let f = spec[node.name]
      let s = input.slice(node.from, node.to)
      out += f ? f(s) : s
    }
    enter = false
  },
})

console.log(out) // let a = 1, b
```

如果代码中间有换行呢？

```js
let input = 'let a=1\nlet b=2'
// out = 'let a = 1let b = 2'
```

可以在每次 `+= code` 时，判断前面有没有跳过换行，有的话手动补一下：

```js
// before `out += f ? f(s) : s`
let newline = count_newline(input.slice(last.to, node.from))
if (newline) {
  out = out.trimEnd()
  out += newline > 1 ? '\n\n' : '\n'
}

function count_newline(s: string) {
  let count = 0
  let index = -1
  do {
    index = s.indexOf('\n', index + 1)
    if (index >= 0) count++
  } while (index >= 0)
  return count
}
```

类似的，我们也可以手动保留缩进、折叠重复的空格等等。下面来看另一个问题：如何根据上下文输出不同的文本？

```js
for() // => `for ()`
```

这里既然有 `enter` 和 `leave`，那么维护一个 scope 栈自然不是难事：

```js
let scope = []

tree.iterate({
  enter(node) {
    scope.push(node.name)
  },
  leave(node) {
    scope.pop()
  },
})
```

把这个 `scope` 传给上面的配置函数，就可以根据上下文输出不同的文本了：

```js
let spec = {
  ['('](s, scope) {
    if (scope.includes('ForSpec')) return spaceBefore(s)
    return s
  },
}
```

如果你感兴趣的话，这里有 [完整的代码](https://gist.github.com/hyrious/a2d3b22009a6d5a3b09e368254f139f9) 。
