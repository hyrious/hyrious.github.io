---
title: TypeScript 小技巧
date: 2023-12-15
---

### Implicit Nominal Typing

不知道中文该叫什么，<q>隐式标称类型</q>？咳咳，简单来说我们想标记一类特定的对象是某个类型的，但是又没有也不想在他身上加个脏脏的标记字段，如下面的例子：

```ts
class Foo {}

class Bar {}

let foo: Foo = new Bar()
```

明明是两个类，但是其中一个的实例居然可以直接赋值成另一个类型。为了不让这么操作，可以要求 `Foo` 身上有个 `Bar` 身上没有的东西，可以往他身上添加一个不存在的私有属性来达到目的：

```ts twoslash
// @errors: 2741
class Foo {
  private declare _isFoo: true
}

class Bar {}

let foo: Foo = new Bar()
```

这里有两个标记使得他变得如此好用：

- `private` 决定了它仍然可以产生类型标记，但禁止了上层用户直接访问，你只能通过构造函数来实例化这个特殊的类型：

  ```ts
  // 生成的 d.ts
  declare class Foo {
    private _isFoo
  }
  ```

- `declare` 决定了这个属性只是个标记而没有实体，因此生成的 JavaScript 也很干净：

  ```js
  // 生成的 js
  class Foo {}
  ```

如果你设置了 [`useDefineForClassFields: false`](https://www.typescriptlang.org/tsconfig#useDefineForClassFields)，也可以省略 `declare` 换成 `!`。

#### Shared Nominal Typing

上文往 `class` 上添加了私有属性，如果是往 `interface` 上加呢？诶，我们发现 `private` 是保不住了，但是可以让一些类共享同一个类型，而且用户一般不会自己尝试实现这个类型：

```ts twoslash
// @errors: 2741
type FooLike = { _isFoo: FooLike }
//                       ^?

class Bar {
  declare _isFoo: this
}

let a: FooLike = new Bar()

class UserDefined {}

let b: FooLike = new UserDefined()
```

### Tagged Value

传统 JavaScript 人的做法是存一个 `{ type: string, value }`，写起来不免有些繁琐而且不利于代码压缩。我们可以考虑下面这个写法：

```ts
class Value<T> {
  /** @internal */
  constructor(readonly type: Type<T>, readonly value: T) {}

  static define<T>() {
    return new Type<T>()
  }

  is<T>(type: Type<T>): this is Value<T> {
    return this.type === type
  }
}

class Type<T> {
  of(value: T): Value<T> {
    return new Value(this, value)
  }
}

// 定义一个类型叫温度
const temperature = Value<number>.define()

// 实例化这个类型
const a = temperature.of(42)
a.is(temperature) // true
```

注意到 `@internal` 标记，这使得最终用户不能看到这个构造，也就可以要求一定通过指定的工厂函数实例化自定义类型了。
