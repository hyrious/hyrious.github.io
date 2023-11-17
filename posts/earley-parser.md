---
title: Earley 算法
date: 2017-09-27
---

- [Earley parser - Wikipedia](https://en.wikipedia.org/wiki/Earley_parser)
- [模式识别之 Earley 算法入门详讲 - bitpeach](https://www.cnblogs.com/bitpeach/p/3602522.html)

Earley parser 是一个可以在最坏 $O(n^3)$ 的复杂度下解析任何 CFG 文法的产生式的算法，它是支持左递归的。

```js
new EarleyParser({ CFG }).parse(str) //=> AST
```

设某条 CFG 是 $X \to \alpha \beta$，我们引入一个 $\cdot$ 代表解析位置，例如 $X \to \alpha \cdot \beta$ 代表当前正在匹配 $X$ 规则，已经匹配成功了 $\alpha$，下一步是匹配 $\beta$。

设 $i$ 是输入序列的第 $i$ 个 token 所在的位置，对于每个 $i$，Earley 算法都要产生一个 State 集合。每个 State 形如 $(X \to \alpha \cdot \beta, i)$，代表我从 $i$ 位置开始匹配的 $X$ 规则，已经匹配成功了 $\alpha$，下一步是匹配 $\beta$。设 $k$ 位置对应的 State 集合为 $S(k)$。

首先，生成 $S(0)$；接下来重复执行以下操作：

- 预测：如果 $\cdot$ 后面是一个非终结符如 $(X \to \alpha \cdot Y \beta, j)$，我们把 $Y$ 开头的规则添加到 $S(k)$（$k$ 是当前位置，$j$ 是刚才匹配 $X$ 的起始位置）
- 扫描：如果 $\cdot$ 后面是一个终结符如 $(X \to \alpha \cdot a \beta, j)$，我们把 $(X \to \alpha a \cdot \beta, j)$ 添加到 $S(k + 1)$
- 规约：对于 $S(k)$ 中的每个 State，如果它的 $\cdot$ 到达该规则的末尾，如 $(X \to y \cdot, j)$，说明我们已经匹配完成了这个（子）规则，在 $S(j)$ 中找到所有 $\cdot$ 后面是 $X$ 的如 $(Y \to \alpha \cdot X \beta, i)$，将小圆点后移一位 $(Y \to \alpha X \cdot \beta, i)$ 添加到 $S(k)$

注意：$S(k)$ 是一个 **集合**，里面没有重复的 State。

设输入有 n 个 token，我们在 $S(n)$ 中找到所有 $i$ 是 $0$ 的，说明我们已经匹配完成了全部的规则，找到的都是合法的生成树。

#### 简单实现

```ruby
class Earley
  def initialize rules = []
    @rules = rules
  end
  def lazy_each_with_index arr, i = 0
    yield arr[i], (i += 1) - 1 while arr[i]
  end
  def uniq_bfs start = [], i = 0
    yield start[(i += 1) - 1], -> x { start.push(x).uniq!; x } while start[i]
  end
  def parse str, &lex
    s = [[[@rules[0], 0, 0]]]
    lazy_each_with_index(s) { |set, k|
      s.push [] if token = lex.(str)
      uniq_bfs(set) { |((n, rule), i, j), u|
        if rule.size == i
          s[j].select { |(_, rule), i, _| rule[i] == n }.each { |e, i, j| u.([e, i + 1, j]) }
        elsif rule[i].is_a? Symbol
          @rules.select { |e, _| rule[i] == e }.each { |e| u.([e, 0, k]) }
        elsif match rule[i], token
          s[k + 1].push [[n, rule], i + 1, j]
        end
      }
    }
    s[-1].any? { |(n, rule), i, j| n == @rules[0][0] && rule.size == i && j.zero? }
  end
  def match pattern, token
    case pattern
    when String then token == pattern
    when Regexp then token =~ pattern
    else false
    end
  end
end

p Earley.new([
  [:P, [:S]],
  [:S, [:S, '+', :M]],
  [:S, [:S, '-', :M]],
  [:S, [:M]],
  [:M, [:M, '*', :T]],
  [:M, [:M, '/', :T]],
  [:M, [:T]],
  [:T, [/^\d+$/]],
]).parse('2 + 3 - 4') { |s|
  s.slice!(/^\s+/)
  s.slice!(/^\d+|\+|\-|\*|\//)
}
```

#### 最后

Earley parser 是一个自顶向下的算法，有一个与之类似的操作叫 [CYK 算法](https://en.wikipedia.org/wiki/CYK_algorithm) 是自下而上的。
