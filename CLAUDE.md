# CLAUDE.md - Midnight Diary (深空回响) 项目档案

## 1. 核心定位
你是一名顶尖全栈架构师，负责维护此治愈系 AI 日记产品。
- **产品逻辑**：用户通过 4 个维度记录日记（身心觉知 / 人际链接 / 深度体验 / 感恩与愿景），AI 提供专业、理性、克制的回响，支持多轮深度对话。
- **核心目标**：确保代码工业级质量、数据结构一致、国内网络直连稳定。

## 2. 技术栈快照 (Current Stack)
- **前端**：Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.
- **后端/数据库**：Supabase (PostgreSQL + Auth 认证).
- **AI 大脑**：DeepSeek API (通过 /api/ai/route.ts 转发).
- **部署**：GitHub -> Vercel (托管) -> Cloudflare (启用 Proxied 实现国内直连).
- **正式域名**：https://diary.yongteam.com

## 3. 环境变量与安全 (Secret Context)
*注意：严禁询问用户 Key 的值。所有配置已存在于根目录 `.env.local` 中：*
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 云端地址
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 匿名公钥
- `DEEPSEEK_API_KEY`: DeepSeek 官方密钥

*Vercel 部署时环境变量需在 Vercel Dashboard 同步配置。*

## 4. 数据库表结构 (Database Schema)
### 表: auth.users (用户表，Supabase Auth 自动管理)

### 表: public.profiles (用户资料)
- id (uuid, pk): 关联 auth.users.id
- username (text): 用户名，由 handle_new_user 触发器自动同步

### 表: public.diaries (日记数据)
- id (uuid, pk): 记录 ID
- user_id (uuid): 关联用户
- diary_date (date): 日记日期（索引，确保一日一记）
- content (jsonb): 4大模块字典 { "身心觉知": "...", "人际链接": "...", "深度体验": "...", "感恩与愿景": "..." }
- chat_history (jsonb): 存储对话流数组。首条固定为 `{"type": "reference", "label": "日记原文"}` 引用 content 字段。

## 5. 核心业务规约 (Business Logic)
1. **一日一记拦截**：首页 "+" 按钮会预检数据库。若今日已有记录，自动跳转至编辑模式 `/write?id=xxx`，否则进入新建引导。
2. **双模式 UI**：首次填写为 Step-by-Step 引导卡片；再次编辑为 All-in-One 全量表单。
3. **AI 二次解读**：支持追问对话；当 `chat_history` 接收到用户发送 "重新解读" 时，AI 清空历史并基于最新 content 重新生成初始回响。
4. **首访引导动画**：含背景音乐、科学注脚、分步动画（背景穿透、声音控制已修复）。
5. **自动保存**：编辑过程中自动保存草稿。
6. **Session 保持**：必须使用 `@supabase/auth-helpers-nextjs` 确保登录态持久。

## 6. 已完成功能清单
- [x] PWA 配置
- [x] 注册/登录流程重构
- [x] 首访引导动画（背景穿透、声音控制、科学注脚问题已修复）
- [x] 4 个日记模块数据结构
- [x] AI 二次解读 + 追问功能
- [x] 自动保存
- [x] 语音+文字混合输入（Web Speech API，光标插入，iOS 兼容）

## 7. 开发规范
- 组件统一用 TypeScript，props 必须定义 interface
- 数据库操作统一封装在 `lib/` 目录下
- 环境变量统一在 `.env.local` 管理，不要硬编码
- Supabase 客户端初始化注意区分 `server.ts` / `client.ts` 两个版本
- DeepSeek API 调用在 `app/api/` 目录下的 `route.ts` 中处理
- 每次修改告知涉及的文件路径

## 8. 开发与运维 SOP
- **修改流程**：修改代码 -> 本地测试 -> `git add .` -> `git commit` -> `git push` -> Vercel 自动更新。
- **物理检查**：若怀疑文件遗失，请运行 `find src -maxdepth 3` 核对。
