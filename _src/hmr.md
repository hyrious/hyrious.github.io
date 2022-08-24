---
title: 热更新是怎么工作的
date: 2022-02-19
---

注：并非指线上软件不重启更新，而是指开发阶段能够获得更好的开发体验。

---

几年前我玩 RPG Maker 的时候也想过这个问题，每次修改过脚本后都要重新启动游戏才能测试效果，有没有什么办法可以不重启呢？

简单地想，如果直接重新执行被修改的那一页脚本，那么只需要他能保证执行后是想要的效果就行了。由于大部分脚本插件都是<q>插件</q>式的，他们通常是使用 `alias` 修改一些个默认系统里的方法以及定义一些新模块，由于 Ruby 有<q>打开类</q>的元编程特性，所以重新执行一段类/模块定义并不会出错，那么只需要能让一段基于 `alias` 写的插件执行两遍等于只执行第二遍就行了！

```rb
alias old_meth meth
def meth
  return old_meth + 1
end
```

假设有这样的插件代码。仔细观察，我们需要让 `old_meth` 第二次执行的时候仍然是<q>原方法</q>。怎么做呢？可以换成一个自定义的 `alias`：

```rb
magic_alias :old_meth, :meth
...
```

如果上下文里已经有 `old_meth`，说明已经执行过一次，什么都不做就行：

```rb
class << self
  def magic_alias(name, value)
    return if method_defined? name
    alias_method name, value # 否则正常使用原 alias 效果
  end
end
```

所以，我当时的方案就是：在每页文件开头加这么一个神秘函数，用它代替 alias，然后重新执行这页代码，就可以适配大部分插件脚本的热更新了。

---

Sublime Text 里也有一个针对插件的热更新机制，也是直接重新执行一下插件 python 文件。不过，它可以在顶层定义 `plugin_loaded` 和 `plugin_unloaded` 方法，在插件重载的时候可以利用这两个方法确保执行效果正确。

比起我的<q>神秘代码</q> + 重新执行，ST 的工作方式如下：

1. 原插件非阻塞调用 `plugin_unloaded`
2. 执行新插件
3. 执行新插件的 `plugin_loaded`

这样一来，等于将热更新逻辑交给写插件的人实现。

---

前端开发也有一套热更新方法，你可以在 [webpack](https://webpack.js.org/concepts/hot-module-replacement/)、[rollup](https://github.com/rixo/rollup-plugin-hot)、[nollup](https://github.com/PepsRyuu/nollup/blob/master/docs/nollup-hooks.md)、[vite](https://vitejs.dev/guide/features.html#hot-module-replacement) 里看到一套 HMR 接口，其基本思路和上面提到的其实也是一回事，每个模块（文件）可以注册退出 `hot.dispose()` 和进入 `hot.accept()` 时干的事情，从而达到热更新效果。

以 Vite 为例，他的热更新流程如下：

1. 后端扫描代码文件，理清依赖关系，把代码里包含 `hot.accept()` 的文件视为<q>热更新模块边界</q>
2. 有文件发生变化时，通过 1 的依赖关系查找到变化文件的公共热更新边界，通知前端刷新这个文件
3. 前端依次执行：
   1. 调用所有相关文件的 `hot.dispose()` 回调
   2. 下载执行 2 找到的边界文件
   3. 调用该文件的 `hot.accept()` 回调

不过，这里存在一个陷阱：你能保证除了更新的文件以外的模块不变吗？

```js
// global.js
export let state = [];

// a.js
import { state } from "./global.js";
state.push("a");

// b.js
import { state } from "./global.js";
state.push("b");
```

如果 a.js 发生了热更新，他能否在更新期间拿到和 b.js 一样的 `state`？

如果不能，那么此时运行时出现了两个 `state`，可能会出现一些 bug。

因此，那些基于黑 `require` 或类似技术（如 SystemJS）的 HMR 实现，可以保证新加载的模块依然可以引用到公共模块，只需要动态决定 `require` 返回啥就行了（比如可以用 `id+timestamp` 标识模块的唯一性）。

而 Vite 这种基于原生 ESM 的，显然没有地方给他黑 `import`，他唯一能做的就是利用浏览器缓存来让浏览器觉得使用了同一个模块。继续思考，然后你会发现他这种方案只能<q>不打包</q>，否则总是无法实现模块的唯一性。

Vite 的方案有没有可能在 Node.js 里实现呢？不好说，因为我们不清楚 `import` 到底有没有 cache，以及这个 cache 认不认 query（`import "mod?t=114514"`）。

---

什么东西适合热更新？虽然我上面只提了 RM/ST 插件、前端工具，但是不难看出，基本上就这些东西<q>在</q>实现热更新：

- 即插即用的插件
- 前端组件库，包括 CSS 样式

前者不难理解，本身已经对<q>即插即用</q>下了一些功夫。后者可以理解为，组件的副作用恰好是热更新的目标——因为组件本身存在生命周期，只需要调用前组件的卸载和新组件的挂载就行。这些组件就类似我一开篇提到的用 alias 编写的 RM 插件，因为符合某种规范所以恰好运行良好。

除此以外，适当缩小业务范围也不难定义出适合热更新的目标。比如我的博客[本身](https://github.com/hyrious/hyrious.github.io/blob/main/_src/lib/server.js)，就编写了一个非常简陋的热更新机制（我甚至手撸了一个小后端 WebSocket）。
