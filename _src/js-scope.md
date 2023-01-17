---
title: JS 作用域碎碎念
date: 2023-01-17
---

JS 里存在两类<q>块</q>，一种是 block `{}`，另一种是 function body `(){}`（包括 method），这两种块对不同的变量声明会有不同的作用域效果，下面就来看看。

#### `var`

```js
if (false) {
  var a = 1;
}
console.log(a); // undefined
```

`var` 是一种历史悠久的变量，他不认识 block `{}`，会直接提升到第一个 function body 区，即使是 Dead-code 也不例外。

#### `let`, `const`

```js
let a = 1;
if (true) {
  const a = 2;
}
console.log(a); // 1
```

`let` 和 `const` 严格存在于当前 block 内，不会发生任何变量提升。

#### `function`

```js
if (false) {
  function foo() {}
}
console.log(foo); // undefined
```

`function` 也是一种定义变量的方式，他和 `var` 一样悠久，提升规则和 `var` 几乎一样，但有两点不同：

```js
const a = 1;
if (false) {
  var a = 2; // SyntaxError: Identifier 'a' has already been declared
}
```

```js
const foo = 1;
if (true) {
  function foo() {}
}
console.log(foo); // 1
```

1. `var` 会不择手段地提升，碰到 `const`, `let` 之类硬茬就会爆炸；而 `function` 则温和很多。

```js
console.log(a, foo()); // undefined, 2
var a = 1;
function foo() {
  return 2;
}
```

2. 和 `var` 只送一个 `undefined` 不同，`function` 会连着定义一起送出去，我们可以 _看起来_ 在定义之前就使用他。实际上，可以认为 `function` 连着内容一起被提升到了当前函数块的顶部执行。

另外，当整个 `function` 作为表达式而不是语句存在时，其名称只会被限定在函数体内可以访问：

```js
$button.onclick = function hello() {
  console.log(hello.name); // 'hello'
};

console.log(hello); // ReferenceError: hello is not defined
```

#### `class`

```js
const A = 1;
if (true) {
  class A {}
  A = 2;
}
console.log(A); // 1
```

`class` 创造的变量约等于 `let`，不过需要注意的是，在 `class` 的静态表达式中是可以直接访问到其类名的，而 `let` 需要先执行完 `class`，反而不能这么使用：

```js
class A {
  static a = A.name; // 'A'
  static b = this.name; // can also use `this`
}
```

```js
let A = class {
  static a = A.name; // ReferenceError: A is not defined
  static b = this.name; // 'A'
};
```

注意到最后一个例子，`A.b` 可以拿到 `'A'`，这是因为匿名类会被自动赋予左边的变量名。当左边不是一个变量的时候该类的名字就是空了：

```js
console.log(
  class {
    static b = this.name;
  }.b
); // ''
```
