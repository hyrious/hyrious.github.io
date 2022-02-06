---
title: Sublime Text 插件踩坑
date: 2022-02-06
---

春节花了几天写了一个 [Sublime Text 插件](https://github.com/hyrious/prettierd)，这里大概记录一下关于它（主要是 python 部分）的小知识。

### <samp>sublime.set_timeout()</samp> 和 <samp>sublime.set_timeout_async()</samp>

文档上说 <q><samp>\_async</samp></q> 会放在另一个线程里执行，听着似乎等于 <samp>threading<wbr>.Thread()<wbr>.start()</samp>？其实不然！这里文档没有明说的是，sublime 一共只有两个线程 —— 主渲染线程和 worker 线程。<q><samp>\_async</samp></q> 的意思是把一个函数放到 worker 线程里跑 —— worker 线程里的任务还是会互相阻塞。所以一旦我们需要实现一些长时间阻塞的任务（如 <samp>process<wbr>.stdout<wbr>.readline()</samp>，假设你要做一个使用 tsserver 的插件<span class="half-shrink-right">）</span>，最好还是自己拿 Thread 搞事。

只有那些短时间且符合用户操作目的的单任务（例如格式化一下文本，当用户按下快捷键时，他期望编辑器做一些工作，但是又不希望整个程序像卡死了一样）适合在 worker 线程工作。

### <samp>async await</samp> <span class="half-shrink-left">（</span>py3.7+）

Sublime Text 4 提供了 python3.8 给新的插件，这意味着你可以写 `if a := 1` 和 `async def` 了。说到 `async` 我就不困了，我立马搬出《[函数染色问题](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/)》。另外，在 sublime 里你总不能让一个 async 函数占着主线程，所以有了下面这段代码：

```py
# Run a callback (-> coroutine) in a new `threading.Thread()`. Refer to
# https://gist.github.com/dmfigol/3e7d5b84a16d076df02baa9f53271058
def run_in_new_thread(function, *args, **kwargs):

    # The "loop" holder.
    loop = asyncio.new_event_loop()

    # Kick start the event loop.
    def wrapper(loop):
        asyncio.set_event_loop(loop)
        loop.run_forever() # <- block current thread, until "loop.stop()"

    # Send wrapper to a new thread with the loop.
    t = threading.Thread(target=wrapper, args=(loop,))
    t.start()

    # Run the callback with the loop.
    coro = function(*args, **kwargs)
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    # `await future` to wait for it.

    return future
```

虽然他是 thread-safe 的，不过手操 thread 还是让我有点不爽。而且这抽象泄露也太严重了，直接给你一个 <samp>loop</samp> <span class="half-shrink-left">（</span>约等于 generator 函数给你的那个对象<span class="half-shrink-right">）</span>。

### <samp>subprocess.Popen</samp> 和僵尸进程

你可以在任何 python 环境下（包括 REPL）试试这段代码：

```py
import subprocess
# 启动一个子进程，只要能一直跑随便用啥都行
p = subprocess.Popen(['ruby', '-e', 'sleep 9999'])
exit()
```

你的 python 退出了，但是子进程还在跑！<span class="half-shrink-left">（</span>也就是所谓的僵尸进程<span class="half-shrink-right">）</span>。我以为是缺什么参数，结果他压根没有实现自动退出子进程的功能（隔壁 ruby、nodejs 可是默认行为，导致我都不知道还能这样<span class="half-shrink-right">）</span>。没有力量，所以只能找到 sublime 有个 <samp>on_exit</samp> 监听器，要在那里退出子进程。

### 异步触发修改

出于操作的同步性考虑，插件必须在一次 <samp>TextCommand</samp> 回调里同步地完成对 view 的修改。一旦这个回调执行的同步代码太多，编辑器就会卡住，体验很不好。那么如何实现异步的修改呢？这里有一个小技巧，就是在异步任务结束的时候再触发一遍 <samp>TextCommand</samp> 并且把必要的参数传进去。一旦有新的用户操作会打断这次异步任务的，就加个标记不去触发即可。
