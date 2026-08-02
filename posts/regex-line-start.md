---
title: 匹配每行开头的正则
date: 2026-08-02
---

我想随时切换 git 全局配置里的项目，具体来说对部分行实现下面两种状态的切换：

```ini
[http "https://github.com"]
	proxy = socks5h://localhost:7890
```

```ini
# [http "https://github.com"]
# 	proxy = socks5h://localhost:7890
```

定位到相关字符串就不说了，一个小问题：如何对匹配到的所有行添加/删除前缀？

> 我有一个问题，我决定用正则解决，现在我有两个问题了！

显然，`^` 匹配行首，`m` 匹配多行，那么：

```js
text = `[http "https://github.com"]
	proxy = socks5h://localhost:7890`
text = text.replace(/^/gm, '# ')
```

似乎没问题。但是这在 Windows 上出错了：

```ini
# [http "https://github.com"]
#
# 	proxy = socks5h://localhost:7890
```

发生了什么？

```js
> [...'foo\r\nbar'.matchAll(/^/gm)]
[
  [ '', index: 0, input: 'foo\r\nbar', groups: undefined ],
  [ '', index: 4, input: 'foo\r\nbar', groups: undefined ],
  [ '', index: 5, input: 'foo\r\nbar', groups: undefined ]
]
```

好吧，`\r` 和 `\n` 右侧都是行首（语义上确实如此，`\r` 是回到开头但不到下一行）。

最终我决定不完全依赖正则解决这个问题，先提前删掉所有 `\r`，最后根据原来有没有 `\r` 再批量替换回去。
