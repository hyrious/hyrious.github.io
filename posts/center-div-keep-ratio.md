---
title: 如何让固定比例的 DIV 尽量占满外层元素？
date: 2025-10-24
---

<iframe src="/i/center-div-keep-ratio.html" width="100%" height="300px"></iframe>

简单来说，我们要实现以下三个目的：

- 占满宽高
- 垂直居中
- 水平居中

**TLDR:**

```css
.container {
  align-content: center; /* 垂直居中 */
}
.content {
  aspect-ratio: 16 / 9;
  max-height: 100%;
  min-height: 0;
  margin: 0 auto; /* 水平居中 */
}
```

### 占满宽高

一个 DIV 元素默认的宽度是 [`stretch`](https://developer.mozilla.org/en-US/docs/Web/CSS/width#stretch)，约等于占满，所以可以不用动。而高度默认是 [`auto`](https://developer.mozilla.org/en-US/docs/Web/CSS/height#auto) 即跟随内容增长，我们需要把他设置为<q>可以占满</q> 即 `max-height: 100%`。

注意这里不能使用 `height: stretch`，因为后者跟 `aspect-ratio` 同时使用时，不满足 `aspect-ratio` 的[生效条件](https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio#auto_ratio:~:text=At%20least%20one%20of%20the%20box%27s%20sizes%20needs%20to%20be%20automatic)：

> At least one of the box's sizes needs to be automatic in order for `aspect-ratio` to have any effect.
> 宽高至少得有一项是 `auto` 才能生效。

### 垂直居中

如果使用 Flex / Grid，这俩货会覆盖内容的尺寸，比如 `align-items: center` 会让内容高度尽量小，而 `align-items: stretch` 会直接拉满。这里我们要使用一个比较少见的属性：`align-content: center` 可以在 `display: block` 上生效，他会保留 div 本身的宽高。

### 水平居中

刚才说过不能使用 Flex / Grid，所以这里也要使用传统的方式：`margin: 0 auto`。

### 收尾

在写好布局类 UI 之后，最好用一些常见的场景测试一下，比如如果塞了巨长的内容（通常用文本即可）会如何渲染。检查后发现在容器宽度比较窄时，内容会撑高子元素，只需要设置 `min-height: 0` 让内容无法影响高度即可。
