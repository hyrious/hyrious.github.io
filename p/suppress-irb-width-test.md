---
title: 如何去除 IRB 启动时打印的 ▽
date: 2026-07-09
---

IRB 启动时其依赖 Reline 会打印一个 [▽](https://github.com/ruby/reline/blob/d32ed17/lib/reline.rb#L418) 来探测 unicode 字符的渲染宽度，有点碍眼，找了一下怎么关闭这个探测，在 `~/.irbrc` 中加入如下代码即可：

```rb
Reline.core.instance_variable_set(:@ambiguous_width, 1) # ▽
```
