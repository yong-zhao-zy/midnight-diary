# Midnight Diary

深夜陪伴日记 — 以温柔理性的 AI 回响，陪你度过每个夜晚。

## 快速启动

```bash
# 1. 进入项目目录
cd midnight-diary

# 2. 安装依赖（如已安装可跳过）
npm install

# 3. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 DeepSeek API Key：
# DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# 4. 启动开发服务器
npm run dev
```

浏览器访问 http://localhost:3000

## 项目结构

```
src/
├── app/
│   ├── api/ai/route.ts         # DeepSeek AI 接口
│   ├── write/page.tsx          # 分步写作页
│   ├── page.tsx                # 首页（历史信件流）
│   ├── layout.tsx              # 全局布局 + 字体
│   └── globals.css             # 主题色板 + 渐变背景
├── components/diary/
│   ├── WritingSteps.tsx        # 5步引导写作组件
│   └── ResponseLetter.tsx      # 信件卡片组件
└── lib/
    ├── storage.ts              # localStorage 日记存储
    └── cn.ts                   # className 工具函数
```

## 技术栈

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Lucide Icons
- DeepSeek API

## 构建生产版本

```bash
npm run build
npm start
```
