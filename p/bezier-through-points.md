---
title: 过定点的贝塞尔曲线
date: 2024-03-08
---

> 原文：[&laquo;Constructing a cubic Bezier that passes through four points&raquo;](https://apoorvaj.io/cubic-bezier-through-four-points/)

<iframe src="/i/bezier-through-points.html" width="100%" height="300px"></iframe>

将折线变为曲线有很多种算法，一个常规的方法是使用二阶贝塞尔 (含有一个控制点)，取每个相邻顶点组成的线段的中点作为起始/结束点，取顶点作为控制点：

```js
// 先连接一条直线到第一个中点
M p0 L mid(p0, p1)
// 将下一个顶点作为控制点，连接到下一个中点
Q p1 mid(p0, p1)
...
Q p_n-2 mid(p_n-2, p_n-1)
// 最后连接一条直线到最后一个中点
L p_n-1
```

这个算法相当简单，而且注意到他是一个在线算法，即不需要等待所有输入都到达就能不断产生输出。但它有一个缺陷：几乎所有的顶点都不在曲线上。其实，只需要稍加修改即可让<q>在曲线上</q>这个条件成立一半：每次取两个顶点，一个作为控制点一个作为终点，这里就不贴代码了。不过这么一来其实曲线的精度损失了一部分，有没有更好的算法呢？

### 一个简单的思路

> 出处：[&laquo;Interpolation with Bezier Curves: A very simple method of smoothing polygons&raquo;](https://agg.sourceforge.net/antigrain.com/research/bezier_interpolation/index.html)\
> 不过这个方法太简单了估计很多人也能自行想到。

对于三阶贝塞尔，其实就是看是否能根据已有信息计算出最适合的控制点。假设我们有三个点形成一个角：

```
        A
       /
   ?. /
     B------C
      `?
```

其实就是看如何找到上图中的 `?` 的位置。显然，控制点似乎和 AC 有关，不妨取 BA、BC 的中点 D、E，连接 DE。

```js
D = mid(B, A)
E = mid(B, C)
```

接下来平移 DE 到使得 B 在 DE 上，如何平移呢？不妨按 BA、BC 的长度比例，使得 DB : BE = BA : BC。

```js
p = dis(B, A) / (dis(B, A) + dis(B, C))
O = D + (E - D) * p // 取 DE 上一点 O 符合比例
D = D + (O - B) // 平移 DO 到 DB
E = E + (O - B) // 平移 EO 到 EB
// 现在 D、E 就是我们要找的控制点了
```

### Centripetal Catmull&ndash;Rom spline 算法以及他的贝塞尔形式

贝塞尔曲线定义为两个顶点和一些控制点，而不是一列他需要经过的点 (我们最开始就是想要从一列输入点得到通过他们的曲线)，有没有一种曲线是定义为一组需要经过的点的呢？有，那就是 [Catmull-Rom 曲线](http://www.cemyuksel.com/research/catmullrom_param/catmullrom_cad.pdf)。贝塞尔曲线和 Catmull-Rom 曲线本质上都是用三次方程描述一条曲线，因此他们是可以互相转换的，下面就给出转换后的形式：

$$ T_1 = \frac{d_1^2 P_2 - d_2^2P_0 + (2 d_1^2 + 3 d_1 d_2 + d_2^2) P1}{3 d_1 (d_1 + d_2)} $$
$$ T_2 = \frac{d_2^3 P_1 - d_2^2P_3 + (2 d_3^2 + 3 d_3 d_2 + d_2^2) P2}{3 d_3 (d_3 + d_2)} $$

<!-- prettier-ignore -->
其中 $ d_i = |P_i - P_{i-1}|^\alpha $ 即和线段长度有关的一个值，$ \alpha $ 取 0.5。代码如下：

<!-- prettier-ignore -->
```js
function refit_bezier(p0, p1, p2, p3, t1, t2) {
  let d1 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), 0.5)
  let d2 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), 0.5)
  let d3 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), 0.5)
  /* modify t1 */ {
    let a = d1 * d1, b = d2 * d2, c = 2 * a + 3 * d1 * d2 + b, d = 3 * d1 * (d1 + d2)
    t1.x = (a * p2.x - b * p0.x + c * p1.x) / d
    t1.y = (a * p2.y - b * p0.y + c * p1.y) / d
  }
  /* modify t2 */ {
    let a = d3 * d3, b = d2 * d2, c = 2 * a + 3 * d3 * d2 + b, d = 3 * d3 * (d3 + d2)
    t2.x = (a * p1.x - b * p3.x + c * p2.x) / d
    t2.y = (a * p1.y - b * p3.y + c * p2.y) / d
  }
}
```

### Fit curve 离线算法

> 出处：&laquo;Algorithm for Automatically Fitting Digitized Curves&raquo; by Philip J. Schneider, "Graphics Gems", Academic Press, 1990.
> [JavaScript 实现](https://github.com/odiak/fit-curve/blob/master/packages/fit-curve/src/index.ts)、[另一个实现](https://github.com/soswow/fit-curve)

考虑到<q>拟合</q>目的，我们可以用牛顿二分法对原折线做切分，直到每个子折线都满足一定的误差要求。这个算法在 [Papar.js](http://paperjs.org/examples/path-simplification/) 里实现为一个路径简化算法。

这种算法算出的贝塞尔曲线是数据量最少且效果最好的，但是由于是离线算法，可能需要和别的算法结合使用。
