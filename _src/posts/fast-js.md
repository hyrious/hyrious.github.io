---
title: 如何编写更快的 JS
date: 2022-01-28
---

这篇博客主要是对 4 年前的这篇 <q>[Maybe you don't need Rust and WASM to speed up your JS](https://mrale.ph/blog/2018/02/03/maybe-you-dont-need-rust-to-speed-up-your-js.html)</q> 的笔记。

**注意**：过早优化是万恶之源，了解这篇博客**可能**有助于你写出更快的 JS/TS，但是不要一味追求写出让人看不懂的代码。

1. 调用函数时传递和声明一样多的参数，不使用可选参数。
2. [单态化](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)函数，简单来说让每个参数的形状（对象的结构、或者函数本身）都永远不变。这个招式平时比较难搓，建议看前面的文章详细理解。
3. 克制地使用缓存 —— 除非查找它比计算它容易。
4. 想办法减少 GC 的压力，例如申请一个大的 TypedArray 存储定长数据。
5. 如果只是在 `ASCII` 范围内工作，用 `Uint8Array` 代替 `String`。

还有一些常识：

1. 用 `class` 维护对象的形状，不去改变 `prototype`。
2. 从<q>维护形状</q>考虑，不要用 `Record<string, X>` 当 `Map/Set` 使 —— 直接用 `Map` 即可。

