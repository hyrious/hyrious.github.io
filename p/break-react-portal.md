---
title: 打破 React Portal
date: 2023-03-01
---

[Portal](https://zh-hans.react.dev/reference/react-dom/createPortal) 是 React 的 <q>DOM 传送门</q>，它可以把虚拟 DOM 转移到其他真实 DOM 下渲染，同时还会保持虚拟 DOM 树的事件冒泡。但实际使用时我们可能反而不想要事件冒泡被<q>传送</q>走，只需要两行 CSS 即可达到这个目的，下面就来看看。

### TL;DR

```css
.portal {
  pointer-events: none;
}
.contents {
  pointer-events: all;
}
```

### Portal 的真身

众所周知，[React DOM 包装了一套合成事件](https://zh-hans.react.dev/reference/react-dom/components/common#react-event-object)来打平不同浏览器的区别，但是不仅仅如此，它还负责以下两个重要任务：

- 减少对真实 DOM 的 `addEventListener` 的调用，避免性能问题
- [捕捉所有 Portal 里的事件，传送到对应的组件里处理](https://zh-hans.react.dev/reference/react-dom/createPortal)

除了第一个纯粹是自作自受以外，第二个具体是怎么实现的呢？我们观察 Portal 元素，会发现上面挂了所有可能的事件监听器，大概就可以猜到他是怎么转移这些事件的了。

### 屏蔽事件监听器

如何清空一个元素上所有未知的监听器？在不黑原生 API 的情况下，一种方法是创建一个新的元素替代他：

```js
let dup = old.cloneNode() // 所有 DOM 属性继承，但是新元素没有挂任何监听器
dup.append(...old.childNodes)
old.replaceWith(dup)
```

不过这会导致这个新元素不被 React DOM 管理，上面缺少了一些私有 JS 属性。

另一个方法是，通过设置 CSS，这个元素就会变成纯纯的空气，所有事件都不会发到他身上。

```css
.portal {
  pointer-events: none;
}
```

但是这个属性是**继承**的，就像 `color` 属性会影响下面所有元素一样，这下里面元素的事件也发不出来了。所以我们需要再启用里面的元素的事件：

```css
.contents {
  pointer-events: all;
}
```

这样一来，传送门下面的事件就可以正常发送到外面，被外面的元素（例如另一个 React DOM 根元素）捕获了。
