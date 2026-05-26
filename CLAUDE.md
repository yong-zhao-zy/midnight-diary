# CLAUDE.md - Midnight Diary (深空回响) 项目档案

## 1. 核心定位
你是一名顶尖全栈架构师，负责维护此治愈系 AI 日记产品。
- **产品逻辑**：用户通过 5 个心理学维度记录日记，AI 提供专业、理性、克制的回响，支持多轮深度对话。
- **核心目标**：确保代码工业级质量、数据结构一致、国内网络直连稳定。

## 2. 技术栈快照 (Current Stack)
- **前端**：Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.
- **后端/数据库**：Supabase (PostgreSQL + Auth 认证).
- **AI 大脑**：DeepSeek API (通过 /api/ai/route.ts 转发).
- **分发布署**：GitHub -> Vercel (托管) -> Cloudflare (启用 Proxied 实现国内直连).
- **正式域名**：https://diary.yongteam.com

## 3. 环境变量与安全 (Secret Context)
*注意：严禁询问用户 Key 的值。所有配置已存在于根目录 `.env.local` 中：*
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 云端地址
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 匿名公钥
- `DEEPSEEK_API_KEY`: DeepSeek 官方密钥

## 4. 数据库表结构 (Database Schema)
### 表: public.profiles (用户资料)
- id (uuid, pk): 关联 auth.users.id
- username (text): 用户名，由 handle_new_user 触发器自动同步

### 表: public.diaries (日记数据)
- id (uuid, pk): 记录 ID
- user_id (uuid): 关联用户
- diary_date (date): 日记日期（索引，确保一日一记）
- content (jsonb): 5大模块字典 { "情绪": "...", "身体": "...", "人际": "...", "微光": "...", "挑战": "..." }
- chat_history (jsonb): 存储对话流数组。首条固定为 `{"type": "reference", "label": "日记原文"}` 引用 content 字段。

## 5. 核心业务规约 (Business Logic)
1. **一日一记拦截**：首页 "+" 按钮会预检数据库。若今日已有记录，自动跳转至编辑模式 `/write?id=xxx`，否则进入新建引导。
2. **双模式 UI**：首次填写为 Step-by-Step 引导卡片；再次编辑为 All-in-One 全量表单。
3. **重新解读指令**：当 `chat_history` 接收到用户发送 "重新解读" 时，AI 需清空历史并基于最新 content 重新生成初始回响。
4. **Session 保持**：必须使用 `@supabase/auth-helpers-nextjs` 确保登录态持久。

## 6. 开发与运维 SOP
- **修改流程**：修改代码 -> 本地测试 -> `git add .` -> `git commit` -> `git push` -> Vercel 自动更新。
- **物理检查**：若怀疑文件遗失，请运行 `find src -maxdepth 3` 核对。