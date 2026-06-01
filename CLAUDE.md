# CLAUDE.md - Midnight Diary (深空回响)

## 1. 角色与定位
顶尖全栈架构师，维护治愈系 AI 日记产品。
- 4个模块维度：身心觉知 / 人际链接 / 高光瞬间 / 感恩与愿景（顺序固定，禁止改变）
- AI 提供专业、理性、克制的回响，支持多轮深度对话

## 2. 技术栈
- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API (`app/api/ai/route.ts`)
- 部署：GitHub → Vercel → Cloudflare → https://diary.yongteam.com

## 3. 环境变量
存于 `.env.local`，禁止询问用户 Key 值，禁止硬编码：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DEEPSEEK_API_KEY`

Vercel 部署时需在 Dashboard 同步配置以上变量。

## 4. 数据库结构
**auth.users**：Supabase Auth 自动管理

**public.profiles**
- id (uuid, pk)：关联 auth.users.id
- username (text)：由触发器自动同步

**public.diaries**
- id (uuid, pk)
- user_id (uuid)
- diary_date (date)：唯一约束 (user_id + diary_date)
- content (jsonb)：`{ "身心觉知": "", "人际链接": "", "高光瞬间": "", "感恩与愿景": "" }`
- chat_history (jsonb)：首条固定为 `{"type": "reference", "label": "日记原文"}`
- module_summaries (jsonb)：AI 生成的模块摘要 `{ "mind_body": "...", "connection": "...", ... }`

## 5. 核心业务逻辑
1. **一日一记**：点击"+"预检数据库，今日有记录则跳转 `/write?id=xxx`，否则新建
2. **双模式 UI**：首次填写为步骤引导卡片；再次编辑为全量表单
3. **AI 解读**：支持追问；收到"重新解读"时清空历史重新生成
4. **引导动画**：首访播放，含背景音乐、科学注脚（已修复）
5. **自动保存**：同一用户同一日期执行 upsert，禁止重复 insert

## 6. 已完成功能
- [x] PWA 配置
- [x] 注册/登录流程
- [x] 首访引导动画
- [x] 4个日记模块
- [x] AI 解读 + 追问
- [x] 自动保存（upsert 防重复）
- [x] 语音+文字混合输入（按住说话，光标插入，60s倒计时，iOS兼容）
- [x] 日记报告（日/周/月表格视图、模块筛选、AI 摘要、预览卡片、localStorage 持久化）

## 7. 开发规范
- 组件用 TypeScript，props 必须定义 interface
- 数据库操作封装在 `lib/` 目录
- Supabase 客户端区分 `server.ts` / `client.ts`
- 每次修改告知涉及的文件路径
- 运维检查：`find src -maxdepth 3`

## 8. AI 行为准则（每次任务强制执行）

### 修改前
- 声明将要修改的文件列表
- 未在列表中的文件，未经用户同意不得修改

### 修改中
- 只改与需求直接相关的代码
- 禁止顺手调整样式、字号、颜色、间距、文案、数组顺序

### 修改后
- 声明实际修改的文件列表，与修改前列表对比说明差异
- 告知哪些已有功能可能受影响，建议用户验证哪些功能

### git push 前回归检查（逐项确认，有未通过项禁止 push）
**模块**
- [ ] 模块名称正确：身心觉知 / 人际链接 / 高光瞬间 / 感恩与愿景
- [ ] 填写与展示顺序一致：身心觉知 → 人际链接 → 高光瞬间 → 感恩与愿景
- [ ] 模块标题字号未被改动

**语音输入**
- [ ] 每个模块输入框显示麦克风按钮
- [ ] 按住触发录音，显示60秒倒计时进度条
- [ ] 松开后文字插入光标位置，不覆盖已有内容
- [ ] 多次语音正确追加
- [ ] 实时灰色预览正常（非iOS）/ iOS降级正常

**日记报告**
- [ ] Tab 切换正常，不跳转路由
- [ ] 颗粒度切换（日/周/月）数据正确
- [ ] 模块筛选器多选/单选生效
- [ ] 单元格点击弹出预览卡片
- [ ] 筛选状态 localStorage 持久化

**基础功能**
- [ ] 注册/登录正常
- [ ] 日记保存不重复创建
- [ ] AI 解读正常
- [ ] 历史记录正常展示
- [ ] 引导动画正常（首次访问）
- [ ] 移动端显示正常

