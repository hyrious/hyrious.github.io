---
title: "NPM Browser: 在线浏览 NPM 包内容"
date: 2022-08-24
---

我以前经常使用 [jsdelivr](https://cdn.jsdelivr.net/npm/lib0/) 和 [unpkg](https://unpkg.com/lib0/) 来查看一些 NPM 包的源码，这么做有几个好处：

1. 假如这个包没有开源[^1]，我们仍然可以读到一些有用的内容；
2. 虽然开源了，但是有可能打包工具配置有问题，可以借助这些网站快速查看包结构；
3. 是在线的，不用污染本地环境。

虽然这两个 CDN 都很快，但是想要切换文件还是比较慢。因此我写了个 [NPM Browser](https://hyrious.me/npm-browser) 来满足我的需求，它的前身是 [tool/npm](https://hyrious.me/tool/npm.html)。

### 用法

直接打开输入包名即可从 npm registry 上下载 tgz 并解压出来查看。目前我还没有发现第二个 npm registry 镜像能够给前端开 CORS 的。并且我还用了 indexeddb 缓存每个包的内容，浏览看过的包会很快。

搜索包也是用的 npm registry 的 API，有时可能会超出 rate limit 导致无法响应。

地址栏会实时显示整个应用的状态，可以简单地分享给别人~~对线~~，格式为:

```
网址?q=包名@版本/package/路径:行数
```

下面演示几个用法：

- 查看最新版 lodash 包的内容: https://hyrious.me/npm-browser/?q=lodash
- 指定到具体版本的具体文件的具体行: https://hyrious.me/npm-browser/?q=@github/textarea-autosize@0.3.0/package/dist/index.js:72

另一个我觉得很有用的功能是文件 diff，在标题栏包名右边第二个按钮就是。有的时候一些第三方包升级，但是 changelog 不会事无巨细地列出所有代码的修改，此时可以利用这个功能查看到底改了啥，例如前几天 markedjs 更新了一个小版本：

- [/package/lib/marked.esm.js: marked@4.0.18 &rarr; marked@4.0.19](https://hyrious.me/tool/diff-npm.html?a=marked%404.0.18%2Flib%2Fmarked.esm.js&b=marked%404.0.19%2Flib%2Fmarked.esm.js&s=1&f=l)

以上。

[^1]: 例如 [motion](https://motion.dev)
