---
title: 一行实现暗色模式
date: 2022-11-20
---

<!-- prettier-ignore -->
```css
body { filter: invert(0.875) hue-rotate(180deg) }
```

脚本（可以放到收藏夹<br>`javascript:var s=document.body.style;s.background='#000';s.filter="invert(0.875) hue-rotate(180deg)";void 0`<br>）

```js
document.body.style.filter = "invert(0.875) hue-rotate(180deg)";
```

分析：设原始颜色为 `Color(h,s,l)`，经过以下运算，

| 运算     | Hue 色相            | Saturation 饱和度 | Lightness 亮度 |
| -------- | ------------------- | ----------------- | -------------- |
| 取反     | 旋转到对面 (180 度) | 不变              | 取 100 - L     |
| 旋转色相 | 旋转 180 度         | 不变              | 不变           |

可以看到最终结果为色相不变（也就是说<span style=color:red>红色</span>不会变成<span style=color:cyan>青色</span>），亮度取反。例如黑色的文字在亮度取反时就会变成白色。

这种投机取巧的办法会让阴影色变亮，是错误的。因此只适合在样式简单的网站或者仅仅给 SVG 图片使用（这样一来就不需要准备两份 SVG 图片了）。
