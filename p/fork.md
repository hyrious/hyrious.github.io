---
title: 魔改之道 · 以 RPG Maker MZ 为例
date: 2025-04-16
---

经常 fork 的朋友都知道，魔改一时爽 rebase 火葬场。本文将介绍一种可持续性魔改办法，让你在面对<abbr title="原版">上游</abbr>不停的改动下仍然泰然自若，及时更新。

为什么用 RPG Maker 呢，因为这个软件会更新项目的引擎部分，你可以看一下它上一代 [RMMV 的这部分文件](https://github.com/rpgtkoolmv/corescript)<small>（因为某些原因开源了，但 RMMZ 的这部分其实是不开源的）</small>。所谓更新其实就是直接把相关文件都覆盖掉，所以如果你对这部分代码有任何改动都会丢失。

RPG Maker 鼓励用户使用 patch 方式扩展游戏功能，这样就可以不动到引擎代码，从而规避上述问题。但现实情况是有时你需要往某个函数的<q>中间</q>插入一段代码，如果继续使用 patch 方式就会需要严格控制插件加载顺序，其实反而是增加了维护难度。

### Git is All You Need

为了避免改动丢失，可以使用 Git 管理游戏仓库的代码部分。不过考虑到 RMMZ 的引擎并不通过 Git 下发更新，可以先把它这部分做成一个公共分支，里面只放引擎代码：

```bash
$ cd Project1
$ git init
$ git add .
$ git commit -m 1.9.0
$ git tag 1.9.0
$ git branch corescript  # 基于当前位置创建一个分支只用于管理核心代码
```

然后在 `main` 分支正常开发游戏，可以直接对核心代码进行改动。当出现新的上游更新比如 `1.9.1` 时，可以从 `corescript` 分支计算出 diff 并应用到 `main` 上：

```bash
$ git switch corescript
# 打开 RMMZ，点击更新核心代码
$ git add .
$ git commit -m 1.9.1
$ git tag 1.9.1
$ git switch main
$ git diff 1.9.0 1.9.1 | git apply  # 应用 1.9.0..1.9.1 的修改到本地代码
```

应用 diff 过程中可能会产生少量冲突，手动解决即可。

### 可持续性魔改

有的时候，上游发生了大的重构或者删掉了包含你的修改的部分文件，apply 过程中因为不是冲突可能你不会注意到这点。这里就需要一点工程学技巧来维护了，例如，可以在自己的代码周围增加特殊标记：

```js
Game_Actor.prototype.someCoreFunction = function() {
  // ... existing code ...
  // --- Start Patch --- // [!code ++]
  customLogicHere();     // [!code ++]
  // --- End Patch ---   // [!code ++]
  // ... existing code ...
}
```

然后可以写一个小脚本检测 apply 前后每个文件的 patch 数量变化，来确定是否有 patch 丢失，这里就不贴多余代码了。

### 解耦模式

通常情况下我们希望避免对原代码做过多的魔改，那样不仅会导致 rebase 困难，而且也不利于其他人类阅读和维护。[《游戏设计模式》](https://gpp.tkchu.me/decoupling-patterns.html)中说：

> 当我们说两块代码<q>解耦</q>时，是指修改一块代码一般不会需要修改另一块代码。 当我们修改游戏中的特性时，需要修改的代码越少，就越容易。

下面我们就来看看最常见的解耦模式<q>依赖注入</q>的一个特化形式：服务定位器。

简单来说，我们可以假设（或者大部分编程语言中真的存在）一个**全局**的东西，任何地方的代码都可以访问到并和这个全局做一些操作，比如保存一些变量或者发送一些事件。

例如，我们希望在游戏中获得物品时弹出一个提醒，可以想到在获得物品的函数里通知其他地方的代码：

```js
Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
  $game._onGainItem.fire({ item, amount, includeEquip }) // [!code ++]
  // ... existing code ...
}

// 某个十万八千里外的代码:           // [!code ++]
$game.onGainItem(e => {              // [!code ++]
  showNotification(e.item, e.amount) // [!code ++]
})                                   // [!code ++]
```

游戏中有一些经常 patch 的区域，比如 `Game_Character#update`，可以重写成：

```js
Game_Character.prototype.update = function() {
  $game._onWillCharacterUpdate.fire();
  Game_CharacterBase.prototype.update.call(this);
  $game._onDidCharacterUpdate.fire();
};
// 下略
```

游戏中可能会对战斗系统做深度定制，比如在计算伤害时，会有多种奇形怪状的技能和状态参与进来，如果把它们都硬编码在一个文件里不免看着头大，可以重写成：

```ts
$game.battle.registerActionEffect(new class extends Game_ActionEffect {
  async run(target: Game_Battler) {
    // 假设效果为启动一个别的效果
    const action = new Game_Action(battler).setSkill(skillId);
    $game.battle.scheduleAction(target, action);
  }
});
```
