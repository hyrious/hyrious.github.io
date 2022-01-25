---
title: YATA：一种针对文本编辑优化的 CRDT 算法
date: 2022-01-26
---

参考：https://juejin.cn/post/7030327499829542942

CRDT 是用来实现同步应用状态的**一类**数据结构（而且大多不需要中心服务器<span class="half-shrink-right">）</span>，其目的是为了让应用的状态在多方共同操作的时候通过**不能保证顺序**的广播消息机制和一套算法处理后能够保持一致。<small>虽然不保证消息顺序，但是仍然要求所有消息都能到达所有客户端，其实这个要求还是有点高了&hellip;</small>

那么，如何设计数据结构，才能表达一段同步的文本呢？YATA 使用了双链表，每一项都可能包含一些文本段或者为空（例如被删除<span class="half-shrink-right">）</span>，用户的操作都基于链表进行。例如，我们可能存在这些操作：

```swift
func 向某个节点后插入新文本节点(参考节点, 新文本节点);
func 删除某个节点(要删除的节点);
// 注意：不存在 "修改" 操作
```

除了操作本身以外，我们还需要一种机制可以对操作排序，保证本地的有序只需要一个 counter，而涉及多端同步时，还需要加一个唯一的 id：

```ts
interface Operation {
  id: string; // 或者 number，只要满足唯一需求就行
  clock: number;
  type: string;
  payload: any;
}
```

接着，我们按这种方式更新 clock：

```rb
# 发生本地事件时
local_clock = local_clock + 1
# 收到远程事件时
local_clock = max(local_clock, remote_clock) + 1
```

再配合比较 id，我们就可以把所有操作排序了。

考虑到本地操作：<q>在节点 A 后面插入 B</q> 和远程操作：<q>在节点 C 后面插入 D</q>，我们需要设计一套算法来使得无论他们按什么顺序到达客户端，都能使客户端到达一个一致的状态。

#### 解决冲突

YATA 算法的核心是：如果我们把<q>参考节点</q>一起发出去，新节点和参考节点之间连线，那么所有的这种连线都不能<q>交叉</q>。

两种合法的插入结果（假设 A B C 已知，D 是当前要插入的<span class="half-shrink-right">）</span>：

<svg preserveAspectRatio='xMidYMid meet' viewBox='0 0 200 100'>
  <path d="M 10,50 q 10,-35 20,0 m 20,0 q 10,-35 20,0" fill="none" stroke="currentColor" />
  <text x="10" y="50" text-anchor="middle" dominant-baseline="hanging">A</text>
  <text x="30" y="50" text-anchor="middle" dominant-baseline="hanging">B</text>
  <text x="50" y="50" text-anchor="middle" dominant-baseline="hanging">C</text>
  <text x="70" y="50" text-anchor="middle" dominant-baseline="hanging" color="#FF4136">D</text>
  <text x="90" y="50" text-anchor="middle" dominant-baseline="hanging">,</text>
  <path d="M 110,50 q 30,-40 60,0 M 130,50 q 10,-15 20,0" fill="none" stroke="currentColor" />
  <text x="110" y="50" text-anchor="middle" dominant-baseline="hanging">C</text>
  <text x="130" y="50" text-anchor="middle" dominant-baseline="hanging">A</text>
  <text x="150" y="50" text-anchor="middle" dominant-baseline="hanging">B</text>
  <text x="170" y="50" text-anchor="middle" dominant-baseline="hanging" color="#FF4136">D</text>
</svg>

只要设计的算法能满足这个要求，就可以达到一致性需求（证明见[论文](https://www.researchgate.net/publication/310212186_Near_Real-Time_Peer-to-Peer_Shared_Editing_on_Extensible_Data_Types)<span class="half-shrink-right">）</span>。如何实现呢？我们分情况看看不同的操作应该如何合并：

首先定义操作：

```js
state = [node('A')]
let op1 = { type: 'insert', left: node('A'), content: node('B') };
let op2 = { type: 'insert', left: node('C'), content: node('D') };
apply(op1) // state = [node('A'), node('B')]
apply(op2) // <- 该做什么？
```

由于我们的底层数据结构是双链表，node 之间是可以排序的。先引入一个记号：`a < b` 表示 a 紧跟在 b 左边，`a << b` 表示 a 在 b 左边不知道多远的地方。

- 如果 `A << B << C`，显然 D 应该直接插入到 C 右边。
- 如果 `A << C << B`，此时存在两种情况：
  - 如果 `A << C` &rarr;  `B << D`，注意这里的 &rarr; 表示我们假设推导出这种结果，此时有可能实际情况是 `A << C < D << B`，就无法保证一致了。
  - 所以，这里我们要假设 `A << C` &rarr;  `D << B`，也就是 `A << C << D << B`，这个结果是唯一的。写成代码就是（对应上图右<span class="half-shrink-right">）</span>：
    ```js
    if (node('A').isLeftOf(node('C'))) {
      node('B').insertBefore(node('D'))
    }
    ```
- 如果 `C << A`，我们看 C 右边第一个元素 X，注意到 `X.left <<= C`，
  - 如果 `X.left == C`，那么 X 和 D 都在 C 的右侧且 left 都是 C，此时等价于他们发生了冲突，下面会介绍一种算法来解决它。
  - 如果 `X.left << C`，此时有 `X.left << C < X <<= A`，此时 D 必然插入到 `C < D < X`（见上面关于 `A(X.left) << C << B(A)` 的推理<span class="half-shrink-right">）</span>。

如果有两个新元素的参考元素是同一个，这意味着发生了冲突，此时 YATA 算法引入了一个新的属性：right，表示参考元素右侧的元素。当发生冲突时，我们先切换到比较右侧元素上来，当右侧元素也一样时，再通过 id 排序决定。

- - -

虽然我上面说了一堆，其实实现并不复杂，只要保持上面提到的<q>依赖连线不交叉</q>的性质就行，下面我们来看看实现（摘自 [Yjs](https://github.com/yjs/yjs/blob/main/src/structs/Item.js#L409)<span class="half-shrink-right">）</span>：

还是以上面的 `ABCD` 为例，我们看插入 D 时发生了什么：

```js
// constructor() {
this.left = origin
this.right = originRight
```

首先，将 D 的 left 和 right 设为他的参考元素，即 C。此时链表长这样：

```text
--C.left--C--C.right--D.right--
           \         /
            D  =  this
```

我们的目的是找到一个位置 `left` 让 D 插入，使得最终所有端的链表一致。

```js
// integrate (transaction, offset) {
if (
  (!this.left && (!this.right || this.right.left !== null)) ||
  (this.left && this.left.right !== this.right)
) {
```

如果 `C.right` 不等于 `D.right` <span class="half-shrink-left">（第二个条件<span class="half-shrink-right">）</span>，说明从 `C.right` 开始产生了冲突，需要走接下来的冲突处理。如果 D 前面没有元素，但是 `D.right.left` 存在，说明 D 前面**其实有**元素，从 D 开始产生了冲突。

```js
let left = this.left
// set o to the first conflicting item
let o = left?.right                    // 不考虑 parent 后的简化代码
const conflictingItems = new Set()
const itemsBeforeOrigin = new Set()
// Let c in conflictingItems, b in itemsBeforeOrigin
// ***{origin}bbbb{this}{c,b}{c,b}{o}***
```

考虑遍历所有的冲突元素，我们从 `o = C.right` 遍历到 `D.right`。这里还拿了两个 Set，不知道做什么用，我暂且蒙在鼓里。

```js
while (o !== null && o !== this.right) {
  itemsBeforeOrigin.add(o)
  conflictingItems.add(o)
```

当<q>当前考察的元素`o`</q>存在而且不是 `D.right`，

```js
if (compareIDs(this.origin, o.origin)) {
```

如果当前元素的参考元素 `o.origin` 和 `D.origin` 相等，也就是说 o 和 D 期望插入到同一个位置，

```js
// case 1
if (o.id.client < this.id.client) {
  left = o
  conflictingItems.clear()
}
```

此时用 id 排一下 o 和 D 的顺序，如果 o 应该在 D 前面，将 D 的 left 设为 o <span class="half-shrink-left">（</span>但是没有真的设<span class="half-shrink-right">）</span>，并且清空一个 Set <span class="half-shrink-left">（</span>暂且蒙在鼓里<span class="half-shrink-right">）</span>。

```text
C.right--o-?-D.right--
          \ /
           D
```

```js
else if (compareIDs(this.rightOrigin, o.rightOrigin)) {
  // this and o are conflicting and point to the same integration points. The id decides which item comes first.
  // Since this is to the left of o, we can break here
  break
} // else, o might be integrated before an item that this conflicts with. If so, we will find it in the next iterations
```

如果 `o.rightOrigin` 和 `D.rightOrigin` 相等，也就是说 o 和 D 不止期望插入同一个位置后，也期望插入到同一个位置前，此时 D 一定在 o 前面，所以可以直接停止遍历。

```text
--C--D--o--
```

```js
} else if (
  o.origin !== null &&
  itemsBeforeOrigin.has(getItem(transaction.doc.store, o.origin))
) {
  // case 2
  if (!conflictingItems.has(getItem(transaction.doc.store, o.origin))) {
    left = o
    conflictingItems.clear()
  }
```

如果 `o.origin` 和 `D.origin` 不相等，且 `o.origin` 不在 C 左边，且从最后一次调整 `D.left` 开始到当前的 o 不含有 `o.origin`，将 `D.left` 设为 o。

```text
--C-D.left-o.origin--o--
     \                \
      D (previous)     D (now)
```

```js
} else {
  break
}
o = o.right // 紧接着上面调整 left = o 之后执行
```

否则不存在冲突，可以直接停止遍历。

现在我们知道 `conflictingItems` 其实就是 `D.left` 到当前遍历节点之间的所有元素、`itemsBeforeOrigin` 其实就是 `C` 到当前遍历节点之间的所有元素。这个算法通过调整 `D.left` 到冲突节点前后来达到<q>消除交叉</q>的效果。

最后，我们成功的到了理想的 `D.left`，再将 D 真正插入到链表中即可。
