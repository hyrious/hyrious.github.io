---
title: 画一个 Sublime Merge 同款 Commit Graph
date: 2025-01-24
---

<iframe src="/i/smerge-snapshot.html" width="100%" height="300px"></iframe>

上面的 Git 记录来自这个真实的仓库：https://github.com/opensumi/core

我从起码 [5 年前](https://github.com/desktop/desktop/issues/9452) 就想画这玩意儿了，但一直缺少某些前置条件：a. 解析 Git Log 的东西和 b. 想明白这个图是怎么画的。前者我在 VS Code 的 [内置 Git 插件](https://github.com/microsoft/vscode/blob/c4c7c61/extensions/git/src/git.ts#L885) 里抄到了，于是问题变成：

已知每个 Commit（看成列表里的元素）包含以下信息：

```ts
interface Commit {
  // 当前 commit ID
  hash: string
  // 上一个 commit 是谁，如果是 merge commit 会有两个 parent
  parents: string[]
}
```

想办法用它（和它前后的 commit，如果需要的话）计算出绘制 Graph（也就是上面例子中左侧的图形）的必要信息。

考虑到现实场景中存在 [几十万](https://github.com/microsoft/vscode) 条 commits 的情况，显然 Sublime 不可能是离线（就是需要先获取到所有 commits 再计算结果）算的。因为 Sublime Merge 直接有最终效果供参考，可以通过<abbr title="找规律">瞪眼法</abbr>先盲猜一下每一行需要的信息是什么：

- 有 N 列路径
- 对每条路径，往上看可能有 I（I &ge; 0）条输入路径
- 往下看类似，有 O（O &ge; 0）条输出路径
- 如果一条路消失了，它不会导致右侧的线向左移动，而是留下空位
- 如果出现新的端点，他会优先寻找空位，没有再往右添加

再仔细看看，会发现：

- 每一行只能出现一个「点」，代表当前 commit
- 只有这个点上会出现 merge（也就是多根线合并到一起的情况）
- 每列路径有一个东西是不变的：它总是在等待对的 parent commit 出现

那么可以先这么定义一下中间状态：

```ts
// 一开始会有一根预置的线表示正在等待 HEAD commit 出现
let currentTracks = [HEAD.hash]
let update = (commit) => {
  // 更新 currentTracks 并计算图
}
```

每次要处理某个 commit 时，对「上一次出来的线」计算「这一次他们变道到了哪一路」。什么情况下会变道呢？只有「出现了正在等待的 commit」时，这些线才会合并到第一根上，否则保持直线向下。

```ts
type Track = { depth: number; in: number[]; out: number[] }
let nextTracks = []
let merged: Track | undefined
let k = 0 // 取 commit.parents 用
for (let j = 0; j < currentTracks.length; j++) {
  let parent = currentTracks[j]
  if (parent) {
    if (parent === commit.hash) {
      if (!merged) {
        // 出现了，直接合并
        nextTracks[j] = commit.parents[k++] // 这根线接下来要找另一个 parent 了
        merged = { depth: j, in: [j], out: nextTracks[j] ? [j] : [] }
      } else {
        // 合并到第一根上，所以下一次没有这根线了
        nextTracks[j] = null
        merged.in.push(j)
      }
    } else {
      // 无关的线继续向下
      nextTracks[j] = parent
    }
  } else {
    // 空的还是空的
    nextTracks[j] = null
  }
}
// 此时没被 merge 的 parents 要么往左合并，要么往右分叉
while (commit.parents[k]) {
  let exist = currentTracks.indexOf(commit.parents[k])
  if (exist) {
    // 已经往左合并了
    merged?.out.push(exist)
    nextTracks[exist] = commit.parents[k++]
  } else {
    // 分叉，往右找到第一个空位
    let index = nextTracks.indexOf(null)
    if (index < 0) index = nextTracks.length
    nextTracks[index] = commit.parents[k++]
    if (merged) {
      // 添加到当前 merge commit 的输出里
      merged.out.push(index)
    } else {
      // 如果没有 merge commit，那么新的 parent 自动形成一路
      merged = { depth: index, in: [], out: [index] }
    }
  }
}

currentTracks = nextTracks
```

上述实现已经在 https://github.com/hyrious/git-tm 里使用了，感兴趣可以用用。
