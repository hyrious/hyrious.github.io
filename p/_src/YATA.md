## Yjs CRDT YATA 算法

https://juejin.cn/post/7030327499829542942

CRDT 首先要解决排序问题：让不同客户端的操作经过无中心的广播后，在所有端能够收敛到相同的顺序，从而保证执行这些操作后能够到达一样的结果。

```ts
type Client = number // 唯一标识符
type Clock = numer   // 自增计数器
type Id = [client: Client, clock: Clock] // 这个玩意儿就可以排序了

type Item<T = string> = {
  content: T | null
  id: Id
  left: Id | null // 在谁的右边插入的此 Item，下文会解释这个定义有什么用
}

type Doc<T = string> = {
  content: Item<T>[] // 一般实现为链表，以优化插入删除时的效率
                     // 但是由于 id 始终有序，
                     // 所以这里直接用一般的二分也可以
}
```

定义插入操作：假设你正在编辑一个线性数据，比如文本 `abc`，你往后面不知道哪里添加了 `d`，此时有 `abc` << `d` 表示在 `abc` 的右边插入了一个 `d`。这时空气中发来一条消息：另一个用户在 `???` 右边插入了一个 `!`，即 `???` << `!` 此时如何把这个人的操作合并到自己的数据上呢？

```ts
// 翻译成代码就是，你本地生成了一个对象
let d: Item<string> = { id: newId(), content: 'd', left: abc.id }
// 空气里发来一个对象
let remote: Item<string> = { id: {...}, content: '!', left: {???}.id }
// id 之间形成全序关系，即不存在相等，一定可以比较大小
```

分情况讨论：

如果 `abc` << `d` << `???`，显然直接在 `???` 后面插入 `!` 即可。

如果 `abc` << `???` << `d`，再分情况：

- 如果 `abc` << `???` &rarr; `d` << `!`，此时无法覆盖到 `abc` << `???` < `!` < `d` 的情况（这确实有可能存在）
- 如果 `abc` << `???` &rarr; `!` << `d`，此时有且只有一种可能的排列 `abc` << `???` << `!` << `d`，因此这种方案可以保证结果唯一可靠

综上，在 `d` 之前插入 `!` 即可。

如果 `???` << `abc`，我们看 `???` 右边的第一个元素 `X`，注意到 `X.left` <<= `???`，再分情况：

- 如果 `X.left` == `???`，此时相当于 `X` 和 `!` 都是在 `???` 后插入的元素，应该使用一些约定来排序，和下面 `???` == `abc` 的情况一样。
- 如果 `X.left` << `???`，此时有 `X.left` << `???` < `!` < `X` <<= `abc`（应用上面一个规则）。

综上，如果 `???` 右边第一个元素的「插入意图」是 `???` 本身，那么用下文中的策略来排序；否则，在该元素的左边插入 `!` 即可。

如果 `???` == `abc`，这意味着两个人同时在同一个元素后面插入元素，此时 _可以_ 直接通过比较 Id 来决定顺序。但是，注意到这里的 _同时_ 并不一定是真的同时——每个客户端用的都是本地的时间，因此完全有可能把本地的操作当作已经发生的操作之前操作，例如有文本 `abc光标xyz`，远端已经发了一个 `!` 过来，变成 `abc!xyz`，_然后_ 本地用户在 `abc` 右边插入了一个 `d`，变成 `abcd!xyz`，但是由于本地时间并不统一，很有可能 `d` 和 `!` 排序后变成 `abc!dxyz`，这就导致输入 `d` 的这边会看到自己的输入被改动了位置。

为了解决这种奇怪的问题，有些 CRDT 会实现为本地的 `clock` 始终是 `max(clock, 最新一条远端操作.clock) + 1`，这样本地操作一定排在已经收到的事件后面。而 Yjs 这里已经选择了再存一个 `right` 表示在谁的左边插入新节点，当出现这种难题时直接用 `right` 来定位即可。此时 Item 的定义变成了：

```ts
type Item<T = string> = {
  content: T | null
  id: Id
  left: Id | null // 在谁的右边插入的此 Item
  right: Id | null // 在谁的左边插入的此 Item
}
// 刚刚插入 d 的操作
let d: Item<string> = { id, content: 'd', left: 'abc'.id, right: 'def'.id }
```

用论文中描述的规则就是：禁止插入操作<q>交叉</q>，即 `AB` (`A` << `D` + `B` << `C`) &rarr; `ABCD` 或 `ADBC`，永远不会出现 `ABDC`。

综上所述，下面给出示例实现：

```ts
type Item<T = string> = {
  content: T | null
  id: Id
  left: Id | null
  right: Id | null
}

type Doc<T = string> = {
  content: Item<T>[]
}

function findIndex<T>(doc: Doc<T>, id: Id | null, fallback: number) {
  if (id === null) return fallback;
  // Yjs 在这层加了几个 cursor，即持久化的指针，来加速搜索的速度
  return doc.content.findIndex(e => isEqualId(id, e.id))
}

function insert<T>(doc: Doc<T>, newItem: Item<T>) {
  // 注意这里 left right 的语义：
  // left 指「用户操作希望在这个位置的右边紧接着插入该节点」
  let left = findIndex(doc, newItem.left, -1)
  let dest = left + 1
  let right = findIndex(doc, newItem.right, doc.content.length)
  let satisfied = false

  // 从当前要插入的位置向右搜索
  // 这一段有可能已经有本地用户输入了，要找到合适的位置
  for (let i = dest; i < right; ++i) {
    if (!satisfied) dest = i; // 右移 dest

    const item = doc.content[i]
    let itemLeft = findIndex(doc, item.left, -1)
    let itemRight = findIndex(doc, item.right, doc.content.length)

    if (
      itemLeft < left || (
        itemLeft === left &&
        itemRight === right &&
        newItem.id[0] <= item.id[0]
      )
    ) {
      break;
    }

    // 找到第一个 newItem 左边的元素
    if (itemLeft === left) {
      // 如果已经满足全序关系，那就不用再右移了
      satisfied = newItem.id[0] <= item.id[0]
    }
  }

  doc.content.splice(dest, 0, newItem)
}
```

删除操作使用 tombstone（墓碑）实现，具体来说就是并非真的删除节点，而仅仅是将它「标记」为已删除，这是为了保证历史记录过来的时候能在本地找到节点。但是这么实现有一个性能问题，就是所有被删除的字都没有真的被删除，一直占着内存。Yjs 对这点进行了优化，就是被删除的节点会在 GC 时被合并而且只存储一个代表长度的数字。只要不存原始数据就不会吃太多内存了。这么实现会带来一个问题：离线后所有的删除操作都不会被 GC 掉，不过既然要保证编辑的时效性，这个代价也没办法。
