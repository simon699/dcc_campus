# 数字员工管理平台

一个具有科技感的数字员工管理界面，使用 Next.js + Anime.js + Tailwind CSS 构建。

## 功能特点

- 深色科技感主题设计，渐变黑 + 蓝紫色点缀
- 状态指示灯与动态UI元素
- 响应式网格布局展示数字员工卡片
- 精美动画效果（浮动、点击反馈、发光效果）
- 模态框任务管理系统

## 技术栈

- **Next.js** - React 框架
- **Tailwind CSS** - 样式工具
- **Anime.js** - JavaScript 动画库

## 安装与运行

1. 安装依赖
```bash
npm install
# 或
yarn install
```

2. 启动开发服务器
```bash
npm run dev
# 或
yarn dev
```

3. 打开浏览器访问 http://localhost:3000

## 项目结构

```
/src
  /app             # Next.js App Router
  /components      # 组件目录
    Header.tsx     # 页面顶部导航栏
    RobotCard.tsx  # 数字员工卡片组件 
    RobotGrid.tsx  # 数字员工卡片网格
    TaskModal.tsx  # 任务管理模态框
```

## 动画实现

- 使用 Anime.js 实现卡片悬浮效果
- 使用 Tailwind CSS 实现状态指示灯的呼吸效果
- 模态框出现与消失的平滑过渡
- 卡片点击时的脉冲动画效果

## 自定义主题

Tailwind 配置中包含了科技感专用颜色：
- `cyberblue`: #00f3ff 
- `deeppurple`: #6a00ff
- `darkbg`: #0a0a10
- `darkerbg`: #050508 