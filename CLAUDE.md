# Midnight Diary (深空回响) - 项目上下文

## 技术栈
- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API
- 部署：GitHub → Vercel → Cloudflare (diary.yongteam.com)
- 环境变量在 `.env.local`，禁止硬编码，禁止询问用户 Key 值

## 核心文件
- `src/components/my/MySettings.tsx` — 【我的】Tab（维度管理卡片 + 专家选择入口）
- `src/config/experts-config.ts` — AI 专家配置（6 预设 + 自定义）
- `src/app/api/ai/route.ts` — 每日解读（含角色扮演强化指令）
- `src/app/api/report/route.ts` — 叙事报告生成（含角色扮演强化指令）
- `src/app/api/summary/route.ts` — AI 摘要精炼
- `src/app/api/cron/consolidate-memory/route.ts` — 异步记忆合并器（日记保存后增量更新用户记忆档案）
- `src/lib/memory-service.ts` — 记忆档案类型定义 + 浏览器端 fetchUserMemory()
- `src/components/my/MemoryCard.tsx` — 【我的】Tab 只读展示 AI 活跃记忆卡片
- `src/components/diary/ResponseLetter.tsx` — 日记详情 + 对话回响展示
- `src/components/diary/WritingSteps.tsx` — 日记撰写流程
- `src/components/narrative-report/ReportDetailView.tsx` — 报告详情页
- `src/components/narrative-report/NarrativeReport.tsx` — 报告生成/列表容器
- `src/lib/diary-service.ts` — 日记 CRUD + ChatMessage 类型定义
- `src/lib/narrative-report-service.ts` — 报告 CRUD + ReportRow 类型定义

## 数据库（4张核心表）
- `profiles`：用户配置，module_config（JSONB）/ expert_style / custom_expert_tags（JSONB）
- `diaries`：日记主体，含 content / chat_history / module_summaries / module_labels_snapshot（均为 JSONB）
- `reports`：AI 报告，含 theme / content / is_public / expert_style，已配置 RLS
- `user_memories`：用户动态记忆档案（user_id PK），含 mental_baseline（TEXT）/ recurring_patterns（JSONB 数组，≤5）/ active_events（JSONB ActiveEvent[]，≤3），已配置 RLS

## 关键业务规则
1. **一日一记**：点击"+"预检，有则跳转编辑，无则新建
2. **深度合并保存**：upsert 前必须 fetch 云端做 Deep Merge，严禁直接覆盖
3. **模块维度**：固定 4 个（身心觉知/人际链接/高光瞬间/感恩与愿景），顺序不可变，展示时带 A. B. C. D. 前缀
4. **名称回溯**：label 变更后展示"当前名 (原名: 填写时名称)"
5. **莫兰迪色点**：m1-m4 固定色，新增模块循环分配，禁止灰色兜底
6. **语音输入**：60s 倒计时 + 光标精准插入，核心 Hooks 禁止改动
7. **AI 摘要**：5-20 字，骨架化格式"【事件】｜【情绪】"或"因...感到..."
8. **报告生成**：temperature 0.6，max_tokens 2000，最大跨度 180 天
9. **公开分享**：`/share/report/[id]` 免登录访问，白名单放行
10. **AI 角色扮演强化**：System Prompt 含【硬性角色扮演指令】header，末尾声明"不限制输出长度"
11. **专家签名前端渲染**：不依赖 AI 输出签名，由前端读取快照数据渲染标签
12. **角色标签快照化**：
    - 每日解读：生成时将 expertStyle/expertName 写入 chat_history 首条 AI 消息，前端从快照读取
    - 日记报告：生成时将 expert_style 写入 reports 表，前端从 report.expert_style 读取
    - 历史无快照数据的记录不显示标签，不强行回填
13. **解读篇幅保障**：各专家 prompt 含"每段2-3句"（单段要求）+"整体不少于4-6段"（全文要求）；max_tokens 初次解读 800、追问 600
14. **动态记忆档案**：
    - AI 解读前从 `user_memories` 查询用户档案，隐形注入 System Prompt（严禁暴露"档案"字眼）
    - 日记保存后 fire-and-forget 调用 `/api/cron/consolidate-memory` 异步合并记忆
    - 合并器由 DeepSeek（temperature 0.3）执行增量更新，输出纯 JSON
    - 容量控制：recurring_patterns ≤ 5、active_events ≤ 3
    - 无记忆时优雅降级：跳过注入，不影响解读流程
15. **注意力权重金字塔 (80/15/5)**：
    - 80% 今日日记：解读篇幅和落脚点必须聚焦用户今天写的内容
    - 15% 长期记忆：仅作"潜意识滤镜"拿捏分寸，禁止主动列举历史事件
    - 5% 近期连续性：仅当今日内容明确是昨天事情的"续集"时才提及
    - 若今日话题全新，记忆必须保持绝对静默，不强行硬蹭过往焦虑

## 开发规范
- 修改前声明涉及文件列表
- 组件必须定义 TypeScript props interface
- 修改后说明影响范围，引导验证
- 禁止擅自调整视觉样式

## Push 前必检
- [ ] 模块字母前缀、名称回溯、停用维度数据保留
- [ ] 语音录音触发、倒计时、光标插入、多次追加
- [ ] 分次保存不覆盖（核心）、module_labels_snapshot 写入
- [ ] 报告生成完整流程、分享、移动端适配
- [ ] 双重筛选器（日期范围 + 模块）4种组合状态
- [ ] 移动端安全区域适配（灵动岛）
- [ ] 专家标签快照：新生成解读标签来自 chat_history 快照，切换专家后历史不变
- [ ] 报告专家标签：来自 reports.expert_style 字段，切换专家后历史不变
- [ ] 记忆档案：新用户首次日记正常（无注入）、合并后 user_memories 有数据、MemoryCard 渲染正确
- [ ] npx tsc --noEmit 零报错

