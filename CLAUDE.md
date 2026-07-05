# Midnight Diary (深空回响) - 项目上下文

## 技术栈
- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API
- 部署：GitHub → Vercel → Cloudflare (diary.yongteam.com)
- 环境变量在 `.env.local`，禁止硬编码，禁止询问用户 Key 值

## 核心文件
- `src/components/my/MySettings.tsx` — 【我的】Tab（维度管理卡片 + 专家选择入口 + 用户档案库入口）
- `src/config/experts-config.ts` — AI 专家配置（6 预设 + 自定义）
- `src/app/api/ai/route.ts` — 每日解读（含角色扮演强化指令）
- `src/app/api/ai/guide-questions/route.ts` — 动态引导提问生成（千人千面 + 时空共鸣）
- `src/app/api/report/route.ts` — 叙事报告生成（含角色扮演强化指令）
- `src/app/api/summary/route.ts` — AI 摘要精炼
- `src/app/api/cron/consolidate-memory/route.ts` — 异步记忆合并器（日记保存后增量更新用户记忆档案）
- `src/lib/memory-service.ts` — 记忆档案类型定义 + 浏览器端 fetchUserMemory()
- `src/components/my/MemoryCard.tsx` — 【我的】Tab 用户档案库入口卡片（点击跳转 /my/archive）
- `src/app/my/archive/page.tsx` — 用户档案库详情页（心智基线 + 行为模式 + 事件时间线）
- `src/components/diary/ResponseLetter.tsx` — 日记列表卡片 + 详情抽屉（含日期修改 PATCH 调用）
- `src/components/diary/WritingSteps.tsx` — 日记撰写流程（含动态引导提问渲染 + diaryDate 传递）
- `src/app/write/WriteContent.tsx` — 新建/编辑日记页面路由分流（新建模式含日期选择器）
- `src/app/api/diaries/[id]/route.ts` — 日记日期修改 PATCH API（鉴权 + 一日一记校验 + diary_date 更新）
- `src/components/narrative-report/ReportDetailView.tsx` — 报告详情页
- `src/components/narrative-report/NarrativeReport.tsx` — 报告生成/列表容器
- `src/lib/diary-service.ts` — 日记 CRUD + ChatMessage 类型定义 + getDiaryEffectiveDate()/getDiaryDateStr() 日期辅助函数 + getDiaryByDate() 日期查重
- `src/lib/narrative-report-service.ts` — 报告 CRUD + ReportRow 类型定义
- `src/lib/prompt-defaults.ts` — 4 套默认黄金 Prompt 模板（{{var}} 占位符）+ 类型定义，客户端可 import
- `src/lib/prompt-templates.ts` — Server-only getActivePrompt() 查询服务，优先读 prompt_configs 表 fallback 到默认
- `src/app/api/prompts/route.ts` — 提示词管理 API 网关（GET 防呆自愈 / POST 保存·另存为 / PATCH 切换生效）
- `src/components/my/PromptLabCard.tsx` — 【我的】Tab 提示词实验坊折叠卡片入口（4 子选项跳转）
- `src/app/my/prompts/page.tsx` — 提示词实验坊控制台（双栏分屏：版本流 + 编辑器）

## 数据库（5张核心表）
- `profiles`：用户配置，module_config（JSONB）/ expert_style / custom_expert_tags（JSONB）
- `diaries`：日记主体，含 content / chat_history / module_summaries / module_labels_snapshot（均为 JSONB）/ diary_date（DATE，日记归属日期）/ created_at（TIMESTAMPTZ，创建时间戳，DB 触发器禁止修改）
- `reports`：AI 报告，含 theme / content / is_public / expert_style，已配置 RLS
- `user_memories`：用户动态记忆档案（user_id PK），含 mental_baseline（TEXT）/ recurring_patterns（JSONB 数组，≤5）/ active_events（JSONB ActiveEvent[]，≤3），已配置 RLS
- `prompt_configs`：用户自定义提示词版本管理（type: guide/analysis/summary/report），含 version_number / name / content / is_active，唯一索引确保同用户同类型仅一个 is_active=true，已配置 RLS

## 关键业务规则
1. **一日一记**：点击"+"预检，有则跳转编辑，无则新建；新建模式下可通过日期选择器切换到其他历史日期（切换前调 getDiaryByDate 校验，已有日记则 Toast 拦截）
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
16. **动态引导提问（千人千面 + 时空共鸣）**：
    - API：`/api/ai/guide-questions`，结合当前日期 + 用户档案（user_memories）动态生成
    - 结构：每维度 2~3 问（第1问专属定制结合档案，第2~3问极简随机）
    - 字数死线：6~10 字/问，绝对禁止超过 12 字
    - 预加载：主页登录后静默 fetch 写入 sessionStorage，写日记页秒开
    - 缓存 Key：`guide_questions_${YYYY-MM-DD}_${userId}`（含日期+用户ID，次日自动失效）
    - 维度漂移拦截：缓存对象含 `dimensions` 指纹，维度列表变更时自动失效重新请求
    - 无档案时优雅降级为通用提问，不影响撰写流程
17. **用户档案库详情页**：
    - 路由：`/my/archive`，从【我的】Tab 的 MemoryCard 入口跳转
    - 三模块展示：长期心智画像 + 行为与情绪模式 + 活跃事件时间线
    - 页面含 session refresh 鉴权守卫，Token 过期跳转登录
18. **提示词实验坊（Prompt Lab）**：
    - 路由：`/my/prompts?type=guide|analysis|summary|report`，从【我的】Tab 的 PromptLabCard 折叠卡片入口跳转
    - 数据库：`prompt_configs` 表，每用户每类型可维护多版本，同时仅一个 is_active=true（唯一索引保护）
    - API 网关：`/api/prompts` — GET（含防呆自愈：无记录时自动 INSERT v1.0 系统自带默认 Prompt）/ POST（保存修改·另存为新版本，事务切换 is_active）/ PATCH（切换生效版本）
    - 占位符方案：模板使用 `{{var}}` 格式（如 {{persona}}、{{moduleDesc}}、{{dateStr}}、{{expectedKeys}}），运行时由 applyPromptVars 注入动态值
    - 4 大 AI 接口适配：guide-questions / ai(每日解读) / summary / report 均通过 getActivePrompt() 优先读库，无记录或未登录时优雅降级到 DEFAULT_PROMPTS
    - analysis 类型仅管控初始解读模板（buildSystemPromptInitial），追问对话（buildSystemPromptFollowup）保持硬编码默认
    - 系统自带 v1.0 模板禁止直接修改，必须"另存为新版本"后编辑
    - "恢复系统默认"按钮一键载入代码中硬编码的 DEFAULT_PROMPTS，需另存为新版本才生效
    - 控制台页面含 session refresh 鉴权守卫，Token 过期跳转登录
19. **日记日期字段分层（diary_date vs created_at）**：
    - `diary_date`（DATE）：日记归属日期，用户可编辑（PATCH API 更新此字段）
    - `created_at`（TIMESTAMPTZ）：记录创建时间戳，DB 触发器禁止修改（PATCH 尝试更新但不生效，不报错）
    - 前端展示/过滤统一使用 `getDiaryEffectiveDate(entry)`（diary_date 优先 + created_at 兜底旧数据）和 `getDiaryDateStr(entry)`（YYYY-MM-DD 格式）
    - 涉及文件：ResponseLetter 列表/详情、DiaryCard、page.tsx 日期范围过滤
    - 一日一记检测（findDiaryIdByDate / getTodayDiary / getDiaryByDate）均基于 `diary_date` 精确匹配
20. **新建日记日期选择**：
    - 入口：WriteContent.tsx 新建模式 header，隐形 `<input type="date">` 覆盖 Calendar 图标 + 日期文本
    - 默认当天（YYYY-MM-DD），max 锁定今天（禁止未来日期）
    - 切换时调用 `getDiaryByDate(newDate)` 校验：已有日记 → Toast "该日期已有日记，请直接编辑" + 不切换；无日记 → 更新 diaryDate state
    - diaryDate 通过 prop 传递给 WritingSteps → upsertDraftToCloud / saveDiaryToCloud，作为 `diary_date` 写入 DB
    - 编辑模式（`?id=xxx`）不含日期选择器，日期修改走 ResponseLetter 详情页的 PATCH 流程
21. **日记日期显示格式**：列表卡片和详情页统一显示"YYYY年M月D日"（无时分秒），DiaryCard 已是纯日期格式

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
- [ ] 用户档案库：MemoryCard 入口跳转 /my/archive，详情页三模块渲染正确
- [ ] 引导提问：主页预加载命中缓存、维度漂移时自动重 fetch、字数 6~10 字、平铺全部问题
- [ ] 提示词实验坊：PromptLabCard 折叠展开动画 + 4 子选项跳转、控制台双栏版本流与编辑器、另存为新版本事务切换 is_active、系统自带 v1.0 禁止保存修改、4 大 AI 接口 getActivePrompt 降级正常
- [ ] 日记日期修改：PATCH 后 DB 的 diary_date 更新、前端列表/详情/过滤均显示新日期、created_at 保持不变
- [ ] 新建日记日期选择：默认当天、切换到无日记日期成功、切换到已有日记日期被拦截、保存后日记列表中显示所选日期
- [ ] npx tsc --noEmit 零报错

