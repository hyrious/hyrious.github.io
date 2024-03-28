---
title: Debug 生产环境的 Electron 应用
date: 2024-03-28
---

首先启动应用，在任务管理器 / 活动监视器里找到该应用主进程的 PID，注意只有不带 Helper 后缀的才是主进程。

然后用 Node.js 往这个进程发送 `SIGUSR1` 信号：

```js
process._debugProcess(pid)
```

然后 Chrome 打开 `chrome://inspect` 就可以开始调试了。

当然开发者还是可以针对特定信号做防御的，比如 NTQQ 就会直接退出。

不过我还是建议就算是生产环境也保留开发者工具选项。
