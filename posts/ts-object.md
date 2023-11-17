---
title: TypeScript `object` vs `record` vs `{}`
date: 2023-02-21
---

TypeScript 中存在三种可以用来描述<q>对象</q>的类型：`object`、`Record<string, any>`、`{}`，该用哪种？下面就来看看。

### `{}` 空的形状

首先我们知道 `{}` 是一个 interface，它负责匹配<q>形状</q>，而一个空的形状约等于 `any` ——

```ts
let a: {} = 1 // ok
```

实际上，它保证右侧的值是可以按<q>对象</q>形式（也就是下标形式）访问的。也就是说 `null` 和 `undefined` 不在此列（因为他们直接 `.foo` 会炸）。

```ts
let a: {} = null // error
```

此外，注意到对象都继承有 `Object.prototype`，所以我们可以调用这些方法而不爆炸：

```ts
let a: {} = 1
a.toString() // ok
```

上面的说法有个问题，`Object.create(null)` 可以不继承那些方法，但是 `Object.create()` 的类型返回 `any`，所以 TypeScript 实际检查不出下面代码的错误：

```ts
let a: {} = Object.create(null)
a.toString() // types ok, but runtime error
```

### `object` 非基本类型以外的所有

可以阅读 [TypeScript 2.2 的更新说明](https://devblogs.microsoft.com/typescript/announcing-typescript-2-2/#the-object-type)，就是 `{}` 去掉 `number` 之类的基本类型。

实际上，除了标准库里会有一些接口必须传入非基本类型对象（如 `map.set(object,value)`）外，日常操作几乎用不着这个玩意儿。

#### `Object` 所有对象都继承的形状

`Object`（大写 `O`）是定义在 `libes*.d.ts` 里的 interface，它是所有对象类型最终继承的形状，所以它上面的方法可以从任意对象上点出来使用。

除了用于扩展标准库以外，日常操作几乎用不着这个玩意儿。

```ts
// 可能的用途
// 模块上下文需要 declare global，脚本上下文不需要
declare global {
  interface Object {
    foo(): number
  }
}
Object.prototype.foo = function foo() {
  return 42
}
```

### `Record<string, any>` 传统字典，或者不如 `{}`

在 `Map`（es6）发明出来之前，JS 里只能使用对象来模拟使用字典（实际上 v8 会检测这种用法并在底层切到一个真的字典实现）。因此 `Record<K, V>` 可以用于标记这种用法。

另一种用法是，当你在玩一些类型体操，操作用户传入或者 infer 出来的对象类型时，需要先用 `extends` 来限制传进来的确实是对象类型，你可能会在哪里看到这种写法：

```ts
function foo<T extends Record<string, any>>(obj: T, key: keyof T) {}
```

简单解释一下 `extends`，这个关键字限制传进来的类型必须被右侧的类型*包含*，然后可以对原类型做后续处理（如 `keyof` 和别的体操）。

显然，这个例子里我们限制第一个参数大概需要是个对象，然后第二个参数会推导出第一个参数的下标。那么用 `{}` 可以吗？可以！

```ts
type Foo<T extends {}> = keyof T
// type A = 'a' | 'b'
type A = Foo<{ a: 1; b: 2 }>
// type B = 'toString' | 'toFixed' | 'toExponential' | 'toPrecision' | 'valueOf' | 'toLocaleString'
type B = Foo<1>
```

<q>这不对</q>，你可能想这么说。这一眼看上去不符合你对用户的用法的期待，但是类型和运行时上都是允许的。

<!-- prettier-ignore -->
```ts
foo(1, 'toString'); // ok
(1)['toString'] // ok
```

我建议所有人都把 `extends Record<string, any>` 换成 `extends {}`，因为

- 对类型的限制更宽松
- 更短，好写好读
- （性能上）更快
- （语义上）更正确

### `typescript-eslint` 历史遗留问题

[typescript-eslint 默认禁止你使用 `Object` 和 `{}`](https://typescript-eslint.io/rules/ban-types/)，前者没什么问题，但 `{}` 实际上是很有用的类型。这纯粹是因为 TypeScript 以前的 `{}` 没那么好用。

你可以添加以下规则来覆盖它对 `{}` 的限制：

<!-- prettier-ignore -->
```json
{
  "@typescript-eslint/ban-types": ["error", {
    "types": { "{}": false },
    "extendDefaults": true
  }]
}
```
