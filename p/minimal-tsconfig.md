---
title: 最小 tsconfig.json
date: 2023-12-18
---

TypeScript 发展至今积累了许多过时配置项以及重复配置项，本文试图按现在[最新](https://aka.ms/tsconfig)的文档，给出最小的 tsconfig.json 配置。

### TL;DR

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext"
  }
}
```

如果你有第三方库，建议增加以下配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "Preserve",
    "types": [],
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true
  }
}
```

### 解释

#### `strict`

开启严格模式，比如不允许含有 `null` 的类型通过检查。

```ts twoslash
// @errors: 18047
declare const a: string | null
a.length
```

这个严格模式代替了其他 8 个建议开启的配置项，我就不一一列举了，文末会附上一些更严格的选项，用户按需打开。

#### `target`

代码降级和默认 `lib`，类比 esbuild 的 `target`，不填是 `ES5`。例如，当 `target` 是 `ES5` 时，`let a = 1` 会变成 `var a = 1`。如果不使用 `tsc` 编译出 js 文件，这里的降级对我们没有意义。

当 `target` 是 `ES6` 及以上时，会默认设置：

- `lib` 为 `["DOM", "DOM.Iterable", ...]`；
- `module` 为 `ES6`，
  - `moduleResolution` 为 `Node`。

因此大多数情况下，你只需要设置 `target` 为 `ESNext` 即可使用最新的语法和 ESM 环境。

#### `module`

使用哪种模块类型，是 ESM 还是 CJS，类比 esbuild 的 `format`。不填时，当 `target` 是 `ES6` 以上时默认是为 `ES6`。

由于现代前端主流就是推行 ESM，这里设置为以下任何一个变体的即可。

| module          | 说明                                           |
| --------------- | ---------------------------------------------- |
| ES6/ES2015      | 支持 import / export                           |
| ES2020          | 增加了 import() / import.meta 支持             |
| ES2022/ESNext   | 增加了 top level await 支持                    |
| Node16/NodeNext | 等于 ES2020/ESNext，但是强制要求文件名后缀匹配 |
| **Preserve**    | **交给用户或者打包器决定，不再产生报错**       |

#### `moduleResolution`

要求按何种算法搜索 `import` 后面的路径，使用现代打包器的建议设置为 `Bundler`。

当你使用 `module: "Preserve"` 时，`moduleResolution: "Bundler"` 默认开启。

#### `esModuleInterop`

影响如何使用第三方库的默认导出名，使用现代打包器的这里无脑打开即可。

如果你没有第三方库，根本无需这个选项。

当你使用 `module: "Preserve"` 时，`esModuleInterop: true` 默认开启。

#### `types: ["node"]`

设置导入哪些污染全局的类型声明，比如 `@types/node`。默认不填的话所有 `node_modules/@types` 里的类型都会注入到全局，如果你觉得这个行为慢或者不安全，可以手动设置。

#### `skipLibCheck`

所有 d.ts 文件不再报告错误或警告，通常是用来规避一些第三方库的类型冲突问题。

#### `noEmit`

打开这个选项主要是为了规避文件名冲突问题，`tsc` 默认会假设你会运行他来生成目标 js 文件，如果这个生成会覆盖已有文件就会报错。你可以看情况打开这个选项告诉他不会生成 js。

#### `verbatimModuleSyntax`

强制要求类型导入必须使用 `import type`，方便第三方打包器分析文件依赖的时候不产生循环引用。

### 附：`include/exclude/files`

这几个选项会用来决定当前<q>项目</q>里有哪些文件，TypeScript 会使用以下几种行为。

- 啥也没设置的话，从 tsconfig.json 当前文件夹递归搜索所有 .ts 文件，跳过默认 exclude 的文件 (比如 node_modules)。
- 设置了 `files` 就直接用这个数组里的文件，不再搜索。
- 设置了 `include` 或 `exclude` 就执行这个搜索算法：`glob(include).reject(exclude)`。

因此最无脑的选择是直接把 tsconfig.json 放到 src 目录里。

### 附：超级严格选项

##### noFallthroughCasesInSwitch: true

不允许直接 fallthrough 到下一个 case，除非用 `// @ts-expect-error` 绕过。

```ts twoslash
// @noFallthroughCasesInSwitch: true
// @errors: 7029
const a: number = 6

switch (a) {
  case 0:
    console.log('even')
  case 1:
    console.log('odd')
    break
}

switch (a) {
  // @ts-expect-error
  case 0:
    console.log('even')
  case 1:
    console.log('odd')
    break
}
```

##### noImplicitOverride: true

不允许直接覆盖父类的方法，除非加一个 `override` 关键字。

##### noImplicitReturns: true

不允许不写 `return`。

##### noPropertyAccessFromIndexSignature: true

不允许用 `.` 访问未知下标属性。

##### noUncheckedIndexedAccess: true

访问未知下标属性的时候会自动加上 `| undefined`。

##### noUnusedLocals: true

不允许出现未使用的局部变量，真有可以加前缀 `_`。

##### noUnusedParameters: true

不允许出现未使用的参数，真有可以加前缀 `_`。

---

<time>2024-01-24</time> 更新

TypeScript 还有一个无配置文件模式，当然这个模式下默认是不开 `strict` 的，来看看实际上会造成什么问题：

0. `target: "es5"`，不使用 `tsc` 编译的话其实没啥影响
1. `alwaysStrict: false`，默认不产生 `"use strict"`
2. `noImplicitAny: false`，隐式 `any` 不会报错，所以你可以写下面这个东东
   ```ts
   window.foo = 'bar'
   // 否则你必须标记成
   ;(window as any).foo = 'bar'
   ```
3. `noImplicitThis: false`，`this` 不标类型不会报错，所以你可以写下面这个东东
   ```ts
   function foo() {
     return this.bar
   }
   // 否则你必须标记成
   function foo(this: { bar: unknown }) {
     return this.bar
   }
   ```
4. `strictNullChecks: false`，不会检查 `null | undefined`，但是目前 VS Code 和 Sublime LSP TypeScript 都是默认开启这个检查的 (有可能是 tsserver 默认开启)，所以实际上可以理解成仍然会检查 null。下面这段代码可以用 tsc 编译过但是常见编辑器里会有提示
   ```ts twoslash
   // @errors: 18047
   declare const a: string | null
   console.log(a.toLowerCase())
   ```
5. `strictPropertyInitialization: false`，不会检查未初始化的属性
   ```ts
   class Foo {
     bar: string
     constructor() {
       // Not initializing 'bar' here and no error
     }
   }
   ```
6. `useUnknownInCatchVariables: false`，`catch(error)` 默认用 any 类型。其实在规范的项目里我希望 `error` 直接隐式标成 `Error`，这样 `.message` 比较容易
7. 你可以正常使用 `import { uniq } from "lodash"` 和 `import.meta.url` 等语法
8. 但是不能写 top level await，这个功能必须要设置 `module: "ESNext" / "ES2022"`

---

<time>2024-05-23</time> 更新

最近 TypeScript 5.4 新增了一个 [`module: "Preserve"`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html#support-for-require-calls-in---moduleresolution-bundler-and---module-preserve)
配置项，可以让 TypeScript 在看到混合语法时不报错（通常这是由作者自己的打包器处理的），并且省下三个常用配置项：

```js
"moduleResolution": "bundler",
"esModuleInterop": true,
"resolveJsonModule": true,
```

另外，我将常用的 `tsconfig.json` 发到了一个包里：https://github.com/hyrious/configs
