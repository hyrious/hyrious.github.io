---
title: 'CRDT: 分数排序'
date: 2023-01-19
---

> 原文：[&laquo;CRDT: Fractional Indexing&raquo;](https://madebyevan.com/algos/crdt-fractional-indexing)
> 原网站里还有精美的可视化效果。

CRDT 是一系列解决协作问题的算法，其中一个不可避免的问题就是：如何记录顺序，如何在发生顺序修改时表现正确。假设我们使用一个数组来记录一组数据的话：

```js
var todos = ['hello', 'world']
```

在同步这个数据时，不可避免地要将这个数组发来发去，当数据量很大时显然不是一个优解。此时先别急着实现 CRDT 链表，我们可以让每个元素多记录一个特殊的数据用来排序，并且用这种方式的网络传输压力很小，下面就来看看。

首先，利用传统的 LWW (last-write-win) 算法，我们可以实现 CRDT Map，但这里面的元素不是有序的。接着，我们给每个元素添加一个字段表示它在数组中的位置。

```js
var todos = {
  '1@1': { text: 'hello', position: '?' },
  '1@2': { text: 'world', position: '?' },
}
```

其中左边的 `1@1` 只是用来标记元素唯一的，它可以通过 `client(本地随机id) + clock(自增整数)` 的方式生成。右边的 `position` 是本文即将说明的技巧，有了它就可以轻松实现排序、有序元素间交换等行为。

### `position` 的定义

我们定义 `position` 是一个从 0 到 1 的数，当出现新的元素要插到某个有序列中时，取其前后元素的 `position`，折半即可得到新元素的 `position`。当没有前元素时，认为它是 0，当没有后元素时，认为它是 1。

```js
var todos = {
  '1@1': { text: 'hello', position: 0.5 }, // 第一个元素，插入 0 ~ 1 的中间，取 0.5
  '1@2': { text: 'world', position: 0.75 }, // 第二个元素，插入 0.5 ~ 1 的中间，取 0.75
}
```

直接二分取数的话，很快我们就会碰到浮点数的瓶颈：折半失效了！此时可以把它转成字符串，利用大整数的实现思路，实现一个无限精度的小数（或者称之为以 10 的指数为分母的分数）。

```js
var todos = {
  '1@1': { text: 'hello', position: '0.5' }, // 5/10
  '1@2': { text: 'world', position: '0.75' }, // 75/100
}
```

### 冲突处理

上面这个技巧在多人协作时会有一个问题：如果两个人同时在一个位置插入了新节点，岂不是会产生两个一模一样的 `position`？

首先我们肯定不能让排序的结果不对，我们可以用客户端本地生成的随机 id (也就是上面 `todos` 的 keys) 对这些节点的排序算法做兜底。

其次有一个简单的方法可以避免这种确定性冲突——引入不确定的随机数即可，每次不光是折半产生下标，并且我们故意往后多添加几位随机数。在十进制下，仅仅是多添加三个字节就可以达到 1000 种不同的后缀，而这么多人同时操作同一个有序列表的概率不大。

```js
var todos = {
  '1@1': { text: 'hello', position: '0.5123' }, // ~5/10
  '1@2': { text: 'world', position: '0.75478' }, // ~75/100
}
```

当然，如果放宽 CRDT 的限制，引入中心服务器裁决的话，也可以让服务器帮冲突的节点挑选一个新位置。
