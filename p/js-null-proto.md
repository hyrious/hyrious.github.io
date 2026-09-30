---
title: '什么时候不用 `{ __proto__: null }`'
date: 2026-09-30
---

今天看到[周报](https://javascriptweekly.com/issues/804)上有人写了个 [«Optimizing objects with null prototypes»](https://adventures.nodeland.dev/archive/optimizing-objects-with-null-prototypes/)，还挺有意思。

普通的 JS 对象会继承 `Object.prototype` 而自动获得 `toString` 等属性，但有的时候我们可能会用 JS 对象存储数据，或者当字典用，此时不能被继承属性影响，通常就会设置原型为 `null` 来解决。

设置原型有两种方法，一种初始化的时候直接写 `{ __proto__: null }`，另一种是对已有对象调用 `Object.setPrototypeOf(target, null)`，这两种方案其实存在 V8 性能上的区别，下面就来看看。

字面量写法会触发 V8 启用字典模式，此时每次访问字段都是一次查表；而后者会继续当作 class 来优化，访问字段时会走
[fast properties](https://v8.dev/blog/fast-properties) 加速，约等于直接计算了地址偏移来访问。

如果业务场景需要频繁 (一秒内几万次那种) 访问字段，使用 `Object.setPrototypeOf` 会带来有限的性能提升。总结一下：

| 写法                                    | 模式 |
| --------------------------------------- | ---- |
| `{ x: 1 }`                              | Fast |
| `Object.setPrototypeOf({ x: 1 }, null)` | Fast |
| `{ __proto__: null, x: 1 }`             | Slow |
| `Object.create(null)`                   | Slow |
