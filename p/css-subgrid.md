---
title: 网格布局一把梭
date: 2024-01-22
---

> 参考：https://web.dev/articles/css-subgrid

自从 `subgrid` 被[广泛支持](https://caniuse.com/css-subgrid)后，网格布局系统终于可以在前端被当成一把梭的存在 (和 `flex` 平起平坐了)，下面就来看看。

来看这么一个例子 (取自 [Subgrids Considered Essential](https://meyerweb.com/eric/thoughts/2016/01/15/subgrids-considered-essential/))：

```html
<ul>
  <li><label>Name:</label> <input id="name"></li>
  <li><label>Email:</label> <input id="email"></li>
  <li><label>Password:</label> <input id="password"></li>
</ul>
```

你的设计师朋友：这几个 label 能不能加个纵向对齐？

除了强行给 `<label>` 加个估算的 `width` 外，其实用 `subgrid` 就可以实现：

```css
ul {
  display: grid;
  grid-template-columns: [column-1] max-content [column-2] 1fr [end];
}
ul li {
  grid-column: span 2;
  display: grid;
  grid-template-columns: subgrid;
}
```

简单解释几点：

- `[name]` 是用来给**格线**命名的，也可以不命名直接从 1 开始数 (或者从右侧 -1 开始数)，也就是说本例中 `[column-1]` 实际上等于 1，`[end]` 实际上等于 3 或者 -1
- `grid-template-columns: max-content 1fr` 设置了这样一个网格：\
  一共两列，第一列宽度是其内容的最大宽度，第二列是占满剩下的宽度
- `grid-column` 是一个缩写属性，表示本元素在父网格中**开始**到**结束**的列**格线**，以下几个表示的都是<q>前两格</q>：
  ```css
  ul li {
    grid-column: 1 / 3;
    grid-column: 1 / span 2;
    grid-column: span 2;
    grid-column: column-1 / end; /* 可以通过命名更直观地表示范围 */
  }
  ```
  本例中，`<li>` 元素需要占满宽度，所以直接框选了一行里的所有格子
- `grid-template-columns: subgrid` 表示此网格继承父元素的网格位置，也就是刚刚用 `grid-column: span 2` 框住的两列
- 所以我们现在有 1 + 3 个 `display: grid`，其中 `<ul>` 是三行两列的，而每个 `<li>` 各自占住一行并且是两列的，并且他们的<q>两列</q>完全是同一个逻辑网格里的
