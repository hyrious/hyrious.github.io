---
title: Electron 实现多窗口踩坑
date: 2024-05-31
---

想在 electron 里打开一个新窗口，除了在主进程 `new BrowserWindow()` 外，也可以在渲染进程执行 `window.open()`。后者其实在正常浏览器里也可以用来打开弹窗，而且如果没有跨域限制的话，可以随意访问和修改后者的 `document`：

```js
var w = window.open("about:blank", '', 'popup')
w.document.body.append('Hello, world!')
```

甚至你在主窗口里创建的元素也可以被塞进这个新窗口的 DOM 里：

```js
w.document.body.appendChild(document.createElement('h1')).textContent = 'Hello world!'
```

但是，注意到这两个窗口的 JS 对象其实都不共享：

```js
document.createElement('h1') instanceof w.HTMLElement === false
Uint8Array.of(1) instanceof w.Uint8Array === false
```

这就会导致一些库的逻辑出现问题，例如 [`rc-util`](https://hyrious.me/npm-browser/?q=rc-util@5.41.0/package/es/Dom/findDOMNode.js:7)：

```js
function isDOM(node) {
  return node instanceof HTMLElement || node instanceof SVGElement;
}
```

想要在跨 `window` 情况下判断正确就不能依赖 `instanceof`，来看 `lodash` 里的实现：

```js
function isElement(value) {
  return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
}
```

而且靠 `window.open()` 打开的窗口有一个小缺点，就是刷新这个窗口时，其网址如果是无效的（比如 `about:blank`）那么这个窗口就废了。

这么看来最稳妥的实现办法还是给这个窗口内容写一个独立的页面（当然可以通过 SPA 方式加载同一个页面只是 query / hash 不一样），窗口间通信使用 SharedWorker 或者在主进程里写一个简单的广播协议，不过这么一来要写的代码就比上面的多了。
