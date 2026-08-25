# Linux DO · JetBrains / Darcula 外观

油猴脚本：把 [linux.do](https://linux.do/) 换成 **JetBrains IDE / Darcula** 风格。

只换皮，不碰数据——内容、链接、按钮与交互全部保留。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）
2. 打开 [`linuxdo-idea.user.js`](./linuxdo-idea.user.js)，点 **Raw** 后安装
3. 访问 <https://linux.do/>；脚本更新后请硬刷新一次

Raw 直链（仓库公开后可用）：

```text
https://github.com/czm15053/linuxdo-idea-ui/raw/main/linuxdo-idea.user.js
```

## 功能

- **IDEA / PyCharm 切换**：点击顶栏品牌标，选择写入 `localStorage`
- **主页**：话题列表伪装为 **Git Log**（多泳道 SVG 图谱）
- **话题页**：帖子渲染为代码编辑器阅读区（随产品切换 Java / Python 风）
- **回帖**：混合语句模板；过短的回帖会补少量样板行
- **代码行内图片**：默认收起，悬停预览，点击固定
- **侧栏**：Project View 风格（路径栏、黄文件夹、箭头与选中色）
- **闪屏 / favicon / 菜单**：偏 IDE 壳层；通知区接近 Event Log
- **颜色模式**：跟随 linux.do 浅色 / 深色 / 自动；深色对齐 Darcula
- **SPA**：站内跳转与前进后退后自动重新套用样式

## 截图

| | |
| --- | --- |
| 闪屏 | ![Splash](./snapshot/splash.png) |
| 主页 Git Log | ![Home](./snapshot/home-git-log.png) |
| 话题 · IDEA | ![Topic IDEA](./snapshot/topic-idea.png) |
| 话题 · PyCharm | ![Topic PyCharm](./snapshot/topic-pycharm.png) |
| Hover 链接显示图片 | ![Image hover](./snapshot/image-hover.png) |

## License

MIT © czm15053

JetBrains、IntelliJ IDEA、PyCharm 均为 JetBrains s.r.o. 商标。本项目为非官方、非关联作品。

## 友链

- [linux.do](https://linux.do/)
