---
title: 10 分钟速成 Git
date: 2023-08-22
---

不知道你在 Git 新手期是否有过以下灵魂发问：

> - 刚写的代码怎么一合并就丢了
> - 覆盖了远端怎么撤回
> - `git rebase` 咋用

别急，其实 Git 的设计目的就是让代码历史变得更简单可控，只是其他教材里的术语和高阶用法让你难以下咽。本文会尝试从另一种思路来介绍和帮助你使用 Git，下面就来看看。

### 🥱 TL;DR

1. 每个 `commit` 都是全量备份，所以别害怕 commit，平时可以养成打一堆 `wip` 的习惯；
2. 小心 `git pull`，可以使用 `git pull --ff-only` 或者 `git fetch --all --prune` 来规避常见问题；
3. 合理运用 `git rebase`、`git reset --hard` 和 `git cherry-pick` 即可完成绝大部分重构 commit 操作；
4. 万一搞炸了还有 `git reflog` 记录了所有操作的历史。

### 每个 `commit` 都是全量备份

怕代码丢怎么办？备份！朴素地想，只要我每打一行代码，就把整个项目打包成 `{当前时间+干了什么}.rar`，这样肯定不会丢失任何一段代码了吧！实际上 Git 也是这么想的，这个手动的<q>打包</q>操作在 Git 里其实就是打 commit。因为 commit 这个词直译为<q>提交</q>，所以我们也可以称打一次 commit 为<q>一个提交</q>。

下面就来试试！首先，需要把整个项目 `add` 到工作区；然后提交：

> 如果你之前没初始化过项目，可以先在项目根目录执行
>
> ```bash
> git init
> ```

```bash
git add .
git commit -m "my first commit"
```

这样一来，到现在为止的修改就已经**完整**保存在了 Git 历史记录里，任何时候都可以用这次 commit 的 hash 访问其中的代码。

如果你不需要参与多人协作，上述内容已经足够你开发私有项目了。

### 我是谁？我在哪？我要合到哪去？

> 阅读这段内容前，强烈建议先找一份 Git GUI 工具来更形象地观察 Git 历史记录。注意 [GitHub Desktop 不支持浏览历史记录图](https://github.com/desktop/desktop/issues/9452)。

在多人协作项目中，经常会出现的情况是：本地的 commit 落后于上游最新的分支。这时候其他教材或者软件会叫你 `git pull` -- 且慢！在默认配置下，通常你执行这个命令带来的后果要么是创建了一些奇怪的 merge commit，要么更糟：有冲突，git 自动进入了 rebase 流程，而碰巧你还不会 rebase 😱。

建议先执行一个更安全的命令，

```bash
git fetch --all --prune
```

意思是：拉取上游所有修改，但不自动同步本地分支。

执行完后观察历史记录，你会看到一系列由 commit 组成的有向图，它通常长这样：

```
root -- A -- B (origin/main)
         \__ C (HEAD → main)
```

什么意思呢？`HEAD` 代表你现在所处的提交，`origin/main` 所处的连线是上游最新的历史记录，而 `main` 是本地的记录。

理想情况下，我们想把 `main` 放到 `origin/main` 后面，也就是 A B C 连成一条线。但是此时 C 的 <q>base</q> 是 A，怎么把它拿到 B 右边呢？可以用 rebase 命令：

```bash
git rebase origin/main
```

这意味着要把从上一个分叉点开始到当前分支的所有 commit，从 origin/main 开始重新打一遍。在上例中就是把 C 拿到 B 右边再创建一次。

什么叫<q>再创建一次</q>？Git 对此的看法是把 `diff A..C` 拿到 B 上 `patch` 一下。因此这个过程即使不发生冲突，也有可能产生错误的代码。所以建议 rebase 完再 review 一下。

如果产生了冲突 (A--B 中存在和 A--C 中**重叠的**被修改的行)，Git 会进入冲突解决模式，此时有冲突的部分会被用 `>>>>>>` `======` `<<<<<<` 包起来，这部分操作建议配合 GUI 使用。

经过以上操作，你应该可以看到以下历史记录图：

```
root -- A -- B (origin/main) -- C (HEAD → main)
```

此时你就可以用非常顺滑的姿势推送 C 了：

```bash
git push -u origin main
```

### 一把梭

以下是一些你可能常用的命令。

#### `git reset --hard <commit>`

将当前分支 (`main`) 强行设置到某条 commit 上，随便跳。本地文件也会跟着改变 (`--hard`)。⚠️ 注意：这个命令操作的是**分支**，所有在这个分支上的 commit 都会跟着消失，请谨慎操作。如果怕 commit 链消失，此时最简单的办法是打一个新分支即可。

例如：

```
root -- A -- B (origin/main) -- (HEAD → main) D (merge C)
         \__ C ______________________________/
```

此例中，由于执行了默认的 `git pull`，Git 创建了一个 merge commit `D`。但我不想要这个 D，我想让 main 回到 C 的位置，那么可以这么做：

```bash
git reset --hard C
```

#### `git cherry-pick <commit>`

将某条 commit 拿到当前位置重新打一个新的。

例如：

```
root -- A -- B (HEAD → main, origin/main)
         \__ C (some-branch)
```

执行 `git cherry-pick C` 后：

```
root -- A -- B (origin/main) -- C' (HEAD → main)
         \__ C (some-branch)
```

注意这里创建的是 `C'`，原提交没有受到任何伤害。

#### Squash Commit

Squash 意为<q>压在一起</q>。有的时候我们希望把一堆连续的提交合并为一个以方便后续操作，此时可以使用 Git GUI 中提供的 Squash 功能，或者手动操作如下：

```bash
git rebase -i HEAD~4
```

`HEAD~4` 的意思是选中当前 commit 往前数 4 个 commit 的位置：

```
... -- HEAD~4 -- HEAD~3 -- HEAD~2 -- HEAD~1 -- HEAD
                 '----------+--------------------'
                            '- 接下来要操作这几个 commit
```

如果你知道具体的 commit id 也可以直接指定。这句命令的意思是：让我手动把这 4 个 commit rebase 到目标 commit (HEAD~4) 上，手动的意思是让我重新排列组合这几个 commit。

这时 Git 会打开一个编辑器让你编写具体的手动操作指令，一般来说只需要保留第一个 pick 并修改下面所有 pick 为 s 即可。

#### `git reflog`

你对 Git 历史记录的所有修改（增加、删除）都会在 reflog 里留下记录，其中最左侧是当前增加或影响的 commit。还记得前面说 commit 其实就是整个项目的全量备份吗？你可以使用 `git checkout <commit>` 来直接跳到某个记录上，即使是当前历史里并不存在的 commit (例如可能由于上文的 `git reset --hard` 操作而丢失了一些 commit)。

例如：

```
root -- A -- B (HEAD → main)

`git reset --hard A`

root -- A (HEAD → main)
```

这里 B 已经消失了，但是通过 reflog 可以查到 B 的 commit (假设就是 `B`)，那么我们仍然可以对它执行正常的合并等操作：

```
root -- A (HEAD → main)

`git reset --hard B` 或
`git merge B --ff-only` 或
`git rebase B` 或
`git cheery-pick B` (不推荐，因为创建了新 commit B')

root -- A -- B (HEAD → main)
```

### 总结

以上我还遗漏了不少重要的知识，例如工作区的概念、stash 的使用、GitHub PR 的使用等等。但是本文的目的并不是从 0 开始教你使用 Git，而是试图从设计初衷（更安全可靠地对代码进行备份以及支持多人协作时更容易地处理冲突问题）解释 Git 某些指令的效果。其余的知识建议自行使用搜索引擎学习。
