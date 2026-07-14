# Midnight Diary (深空回响) - 项目上下文

## 技术栈
- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion（仅详情抽屉等复杂交互动画）+ tw-animate-css（列表卡片入场动画）+ Zustand（全局数据缓存）+ 自定义 Service Worker（`public/sw.js` 运行时缓存）
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API
- 部署：GitHub → Vercel → Cloudflare (diary.yongteam.com)
- 环境变量在 `.env.local`，禁止硬编码，禁止询问用户 Key 值

## 核心文件
- `public/sw.js` — Service Worker（StaleWhileRevalidate 静态资源 + NetworkFirst API/HTML + skipWaiting + clientsClaim + navigationPreload）
- `src/components/ServiceWorkerRegister.tsx` — SW 注册组件（仅 production，window load 后注册）
- `src/store/diary-store.ts` — Zustand 全局 store（entries 分页 / diariesForReport 全量 / reports 三路数据缓存 + 5min staleTime + in-flight 去重 + 首屏优先 prefetchAll + 空闲预加载 prefetchIdleData + 变更原地更新）
- `src/components/ui/skeleton.tsx` — shadcn Skeleton 基础组件（animate-pulse）
- `src/components/diary/DiaryListSkeleton.tsx` — 写日记 Tab 骨架屏
- `src/components/report/ReportSkeleton.tsx` — 概览 Tab 骨架屏
- `src/components/narrative-report/ReportListSkeleton.tsx` — 报告 Tab 骨架屏
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
- `src/components/diary/ResponseLetter.tsx` — 日记列表卡片 + 详情抽屉（含日期修改 PATCH 调用 + chat_history 懒加载）
- `src/components/diary/WritingSteps.tsx` — 日记撰写流程（含动态引导提问渲染 + diaryDate 传递）
- `src/components/diary/DiaryExportButton.tsx` — 导出弹窗（复用 DateRangePicker，xlsx/docx 动态 import）
- `src/components/diary/DateRangePicker.tsx` — 自包含日期范围下拉组件（列表页 + 导出弹窗共用）
- `src/app/write/WriteContent.tsx` — 新建/编辑日记页面路由分流（新建模式含日期选择器）
- `src/app/api/diaries/[id]/route.ts` — 日记日期修改 PATCH API（鉴权 + 一日一记校验 + diary_date 更新）
- `src/components/narrative-report/ReportDetailView.tsx` — 报告详情页
- `src/components/narrative-report/NarrativeReport.tsx` — 报告生成/列表容器
- `src/lib/diary-service.ts` — 日记 CRUD + ChatMessage 类型定义 + getDiaryEffectiveDate()/getDiaryDateStr() 日期辅助函数 + getDiaryByDate() 日期查重 + fetchDiaries() 分页（limit/offset）
- `src/lib/narrative-report-service.ts` — 报告 CRUD + ReportRow 类型定义
- `src/lib/prompt-defaults.ts` — 4 套默认黄金 Prompt 模板（{{var}} 占位符）+ 类型定义，客户端可 import
- `src/lib/prompt-templates.ts` — Server-only getActivePrompt() 查询服务，优先读 prompt_configs 表 fallback 到默认
- `src/app/api/prompts/route.ts` — 提示词管理 API 网关（GET 防呆自愈 / POST 保存·另存为 / PATCH 切换生效）
- `src/components/my/PromptLabCard.tsx` — 【我的】Tab 提示词实验坊折叠卡片入口（4 子选项跳转）
- `src/app/my/prompts/page.tsx` — 提示词实验坊控制台（双栏分屏：版本流 + 编辑器）
- `src/app/invite-required/page.tsx` — 内测码输入落地页（输入框 + 验证并进入按钮）
- `src/app/admin/invite-codes/page.tsx` — 管理员内测码后台（统计卡片 + 筛选 Tabs + 码列表 + 批量生成弹窗 + 删除二次确认）
- `src/app/api/validate-invite-code/route.ts` — 内测码校验 API（查存在性 + 使用状态）
- `src/app/api/consume-invite-code/route.ts` — 内测码消费 API（原子标记 used_by + profiles 绑定）
- `src/app/api/admin/invite-codes/route.ts` — 管理员内测码 CRUD（GET 列表 / POST 批量生成 / DELETE 删除未使用）
- `supabase/migrations/20260711_invite_codes.sql` — 内测码系统 migration（invite_codes 表 + profiles 扩展 + RLS）

## 数据库（6张核心表）
- `profiles`：用户配置，module_config（JSONB）/ expert_style / custom_expert_tags（JSONB）/ role（TEXT, 'user'|'admin'）/ invite_code_id（UUID FK → invite_codes）
- `diaries`：日记主体，含 content / chat_history / module_summaries / module_labels_snapshot（均为 JSONB）/ diary_date（DATE，日记归属日期）/ created_at（TIMESTAMPTZ，创建时间戳，DB 触发器禁止修改）
- `reports`：AI 报告，含 theme / content / is_public / expert_style，已配置 RLS
- `user_memories`：用户动态记忆档案（user_id PK），含 mental_baseline（TEXT）/ recurring_patterns（JSONB 数组，≤5）/ active_events（JSONB ActiveEvent[]，≤3），已配置 RLS
- `prompt_configs`：用户自定义提示词版本管理（type: guide/analysis/summary/report），含 version_number / name / content / is_active，唯一索引确保同用户同类型仅一个 is_active=true，已配置 RLS
- `invite_codes`：内测码表，code（TEXT UNIQUE）/ created_by / used_by（UUID FK → auth.users）/ used_at / created_at / note，RLS 策略：admin 全权限（profiles.role = 'admin'）/ 普通用户仅查看自己消耗的码（used_by = auth.uid()）

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
22. **Tab 切换无感加载（forceMount + Zustand 缓存 + 骨架屏 + 分页 + 空闲预加载 + 动态导入）**：
    - **forceMount + CSS 隐藏**：4 个 `<TabsContent>` 均加 `forceMount` + `data-[state=inactive]:hidden`，组件常驻 DOM 不卸载，切 Tab 零重挂零请求
    - **⚠️ forceMount 必须配合隐藏**：Radix `forceMount` 不会自动设置 `hidden` 属性（`hidden={!present && !isSelected}` 中 `present` 恒为 `true`），必须手动加 `data-[state=inactive]:hidden`，否则所有 Tab 同时渲染堆叠覆盖
    - **Zustand 全局 store**（`src/store/diary-store.ts`）：entries（fetchDiaries 分页）/ diariesForReport（fetchDiariesForReport 全量）/ reports（fetchReports）三路数据全局缓存
    - **首屏分页**：`fetchDiaries(userId, { limit, offset })` 默认 limit=10，首屏只拉 10 篇；底部「加载更多」按钮调 `loadMoreEntries()` 追加下 10 篇；store 维护 `entriesHasMore` / `entriesOffset` / `entriesLoadingMore` 分页状态
    - **首屏优先 + 空闲预加载**：`prefetchAll(userId)` 仅 fetch entries（首屏 10 篇）；entries 加载完成后 `requestIdleCallback` → `prefetchIdleData()` 异步预加载 diariesForReport + reports（非阻塞）；用户在预加载完成前切到对应 Tab 走 `ensure*` 正常加载
    - **5 分钟 staleTime**：`ensure*` 函数检查 `Date.now() - *FetchedAt < STALE_MS`，新鲜则跳过；in-flight 去重（模块级 Promise 变量）
    - **数据失效策略**：新建日记 → `invalidateDiaries()`（两路 timestamp 置 null + 分页状态重置，不清数据避免闪烁）；日期 PATCH / 内容编辑 → `updateEntry()`（原地更新 + diariesForReport 失效）；报告 CRUD → `addReport()` / `updateReport()` / `removeReport()`（原地，不失效）；登出 → `reset()`（全清含分页状态）
    - **diaryDates 合并派生**：从 `entries` + `diariesForReport` 合并去重派生（`Set` 去重），空闲预加载完成后覆盖全部日期；导出按钮接收 `allDiariesForExport`（entries + diariesForReport 合并去重），确保分页下也能导出全部日记
    - **骨架屏策略**：`*FetchedAt === null && data.length === 0` 时显示骨架屏（仅首次加载）；重 fetch 时保留旧数据不闪烁
    - **组件数据来源**：page.tsx 从 store 读 entries + diariesForReport；DiaryReport 从 store 读 diariesForReport；NarrativeReport 从 store 读 reports + entries（派生 diaryDates）；各 Tab `useEffect` 监听 `*FetchedAt` 变 null 时触发 `ensure*` 静默刷新
    - **非首屏 Tab 动态导入**：DiaryReport / NarrativeReport 用 `next/dynamic` + `ssr: false` 代码分割，独立 chunk 不进主 bundle；写日记 Tab（MySettings）保持静态导入
    - **WritingSteps 保存后失效**：`saveDiaryToCloud` 后调 `useDiaryStore.getState().invalidateDiaries()`，用户回首页时 prefetchAll 检测 stale 自动刷新（重置分页，重新拉首 10 篇）
23. **性能优化（列表查询 + 传输体积 + 客户端复用 + 动画）**：
    - **轻量 select**：列表/报告场景严禁 `select("*")`，按消费端实际字段裁剪
      - `fetchDiaries(userId, { limit?, offset? })` → `"id, content, diary_date, created_at, module_labels_snapshot"`（排除 `chat_history`、`module_summaries` 两个大 JSONB）；默认 limit=10 分页，用 `.range(offset, offset+limit-1)`
      - `fetchDiariesForReport(userId)` → `"id, content, module_summaries, diary_date, created_at, module_labels_snapshot"`（排除 `chat_history`）
      - `fetchDiariesInRange(userId, ...)` → `"id, content, created_at"`（报告生成只需 content + created_at）
      - `getDiaryById(id)` 保持 `select("*")`（单行全量懒加载，详情页追问需要 chat_history）
    - **userId 参数化**：service 层函数接收 `userId`，禁止在内部重复调用 `supabase.auth.getUser()`；由调用方（页面 init）一次性获取 user 后向下传递
    - **并行初始化**：页面 init 用 `Promise.all` 并行查询（如 profile + entries 首页），禁止顺序串行；overview/report 数据延迟到 `requestIdleCallback` 空闲预加载
    - **派生优于查询**：能从已拉取数据派生的不再单独查询（`diaryDates` 从 `entries` + `diariesForReport` 合并派生；`showIntro` 从 `entries.length === 0` 派生，不调 `getDiaryCount`）
    - **chat_history 懒加载**：列表查询不返回 chat_history，详情抽屉打开时若 `entry.chat_history` 缺失则 `getDiaryById(entry.id)` 单行拉取，`historyLoaded` 守卫防追问竞态（input/button `disabled={!historyLoaded}`）
    - **重库动态 import**：xlsx/docx（~600KB）用 `await import("@/lib/export-utils")` 按需加载，禁止顶部静态 import
    - **非首屏组件动态导入**：DiaryReport / NarrativeReport 用 `next/dynamic` + `ssr: false` 代码分割，独立 chunk 不进主 bundle；写日记 Tab（MySettings）保持静态导入
    - **Supabase 浏览器客户端单例**：`src/lib/supabase/client.ts` 模块级缓存 `browserClient`，多次 `createClient()` 返回同一实例
    - **列表卡片动画 CSS 化**：DiaryCard / ResponseLetter 列表卡片用 `animate-in fade-in slide-in-from-bottom-*`（tw-animate-css）替代 framer-motion，减少 JS bundle；详情抽屉保留 framer-motion spring 动画
    - **DiaryRow.chat_history 可选**：类型定义 `chat_history?: ChatMessage[]`，列表项访问时 `|| []` 兜底
24. **Service Worker 运行时缓存**：
    - **`public/sw.js`**：纯手写 SW，零依赖零 Turbopack 兼容风险
    - **缓存策略**：静态资源（JS/CSS/字体/图片）→ StaleWhileRevalidate（缓存优先，后台更新）；API 请求（`/api/*`）→ NetworkFirst（网络优先，离线降级缓存）；导航请求（HTML）→ NetworkFirst + navigationPreload
    - **不预缓存**：install 阶段仅 `skipWaiting()`，所有资源按需缓存，避免 install 阻塞
    - **Cache 命名**：`midnight-static-v1` / `midnight-api-v1` / `midnight-page-v1`，版本升级时改 v2 并在 activate 清理旧版本
    - **注册时机**：`ServiceWorkerRegister` 组件仅 production 环境，`window load` 事件后注册（不与首屏渲染竞争）
25. **Middleware auth + 内测码守卫**：
    - `src/lib/supabase/middleware.ts` 中公开路径检查（`/login`, `/api`, `/auth/callback`, `/update-password`, `/share`, `/invite-required`）在 `getUser()` 之前执行
    - 公开路径直接 `return NextResponse.next()`，跳过 `supabase.auth.getUser()` 网络往返
    - 非公开路径执行 `getUser()` 鉴权 + 未登录跳转 `/login`
    - 已登录用户查 `profiles.role` + `profiles.invite_code_id`：admin 放行 / invite_code_id 非空放行 / 否则跳转 `/invite-required`
26. **客户端 auth 简化**：
    - `src/app/page.tsx` init 函数：`getSession()` → 直接用 `session.user.id`，不再调 `refreshSession()`（死代码）和 `getUser()`（middleware 已验证）
    - 依据：middleware 在服务端验证了用户身份（未登录会 302 到 `/login`），客户端 `getSession()` 是本地 cookie 读取（无网络）
27. **字体体积优化**：
    - `Noto_Serif_SC` 仅加载 weight `["400", "600"]`（删除 700，省 ~1.8MB woff2）
    - 全项目禁止使用 `font-bold`（weight 700），用 `font-semibold`（weight 600）替代
    - `Geist` 保持不变（latin 字体，体积小）
28. **内测码系统（邀请码准入 + 管理员后台）**：
    - **数据库**：`invite_codes` 表（code UNIQUE / created_by / used_by / used_at / note）+ `profiles` 扩展（role: 'user'|'admin' / invite_code_id FK）
    - **RLS 策略**：admin 全权限（`profiles.role = 'admin'`）/ 普通用户仅查看自己消耗的码（`used_by = auth.uid()`）
    - **初始 admin**：手动在 SQL Editor 执行 `update profiles set role = 'admin' where id = 'YOUR_USER_ID'`
    - **Middleware 守卫**：已登录但无 invite_code_id 且非 admin → 跳转 `/invite-required`
    - **内测码格式**：`MD-XXXX-XXXX-XXXX`，大写字母+数字，去除易混淆字符（O/0/I/1）
    - **消费流程**：幂等检查（profile 已绑码 / 用户已占码 → 返回 already_bound）→ 查码 → 原子 update（`.is('used_by', null)` 乐观锁防并发）→ admin 客户端更新 `profiles.invite_code_id`（profile 不存在时 upsert 创建；失败则回滚内测码标记）
    - **管理员 API**：统一 `checkAdmin()` 权限检查（getUser → 查 profiles.role → 非 admin 返回 403）
    - **管理后台**：`/admin/invite-codes` — 统计卡片（总码数/已使用/剩余）+ 筛选 Tabs（全部/未使用/已使用）+ 批量生成弹窗（1-100）+ 复制码 + 删除未使用码（二次确认）
    - **admin 入口**：MySettings 接收 `userRole` prop，admin 角色底部显示「内测码管理」卡片入口
29. **账号注销 + 内测码回收**：
    - RPC `delete_user_account(UUID)` 返回 TEXT（`'ok'` / `'error: ...'`），BEGIN/EXCEPTION/END 容错
    - 内测码回收：注销时 `UPDATE invite_codes SET used_by=NULL, used_at=NULL` 而非 DELETE，码可复用
    - `deletion_logs` 表含 `error_message` 列，失败时写入 `status='failed'` + 错误信息
    - API 路由 `/api/account/delete` 检查 RPC 返回值，非 `'ok'` 时返回 500
    - consume-invite-code 幂等保护：profile 已绑有效码 → 返回 `already_bound: true`；用户已占码但未绑 → 自动补绑

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
- [ ] 性能：首页/列表 Tab 切换加载 < 3s、Supabase 客户端单例（多次 createClient 返回同一实例）
- [ ] 性能：列表查询不含 chat_history/module_summaries（DevTools Network 检查响应体积）
- [ ] 性能：详情抽屉打开旧日记时 chat_history 懒加载正常、追问输入框在 historyLoaded 前禁用
- [ ] 性能：导出弹窗点击导出后 xlsx/docx 才动态加载（Network 可见 chunk 请求）
- [ ] 性能：列表卡片入场动画正常（CSS animate-in，无 framer-motion JS 报错）
- [ ] 性能：首屏 diary list 接口只返回 10 条、底部「加载更多」按钮点击追加 10 条、无更多时按钮消失
- [ ] 性能：构建产物中 DiaryReport/NarrativeReport 为独立 chunk（`_next/static/chunks` 可见），主包不含概览/报告代码
- [ ] 性能：字体 woff2 文件数量减少（删除 weight 700 后从 ~106 减到 ~79）、全项目无 `font-bold` 使用
- [ ] SW：DevTools → Application → Service Workers 可见已激活、Cache Storage 可见 `midnight-static-v1` 等
- [ ] SW：首次加载后刷新，静态资源从 SW cache 返回（Network 面板 Size 列显示 `(ServiceWorker)`）
- [ ] Auth：`/api/*` 请求不再触发 middleware `getUser()` 网络往返（Network 面板无 auth 相关请求）
- [ ] Auth：首页 init 仅有 `getSession()`（无 `getUser()`/`refreshSession()` 网络请求）
- [ ] Tab 切换：4 个 Tab 点击即时切换无白屏、反复横跳各 Tab 状态保持（筛选/滚动位置不丢失）、Tab 内点击不被覆盖层拦截
- [ ] Tab 缓存：首次进入 Network 可见 1 个 entries 请求（limit=10）+ profile 请求；空闲后可见 diariesForReport + reports 预加载请求；5min 内反复切 Tab 无新请求；新建日记后回首页列表含新日记
- [ ] npx tsc --noEmit 零报错
- [ ] 内测码：新用户注册 → 邮箱验证 → 登录 → 被拦截到 /invite-required → 输入有效码 → 进入应用
- [ ] 内测码：无效码 / 已使用的码 → 显示对应错误文案
- [ ] 内测码：admin 在「我的」看到「内测码管理」入口 → 跳转 /admin/invite-codes
- [ ] 内测码：批量生成（1-100）、筛选（全部/已使用/未使用）、复制码、删除未使用码（二次确认）
- [ ] 内测码：非 admin 访问 /admin/invite-codes → 显示「无权访问」
- [ ] 内测码：同一码被两个用户同时提交 → 只有一个成功（乐观锁）
- [ ] 注销+重注册：注销后 auth.users / profiles / diaries 均无残留 → 重新注册同邮箱 → 登录 → 输入内测码 → 第1次点击成功进入（无"第1次无反应、第2次已被使用"）
- [ ] 注销+内测码回收：注销后该账号关联的内测码 used_by 恢复为 NULL（码可复用）
- [ ] 内测码幂等：已绑码用户再次调用 consume-invite-code → 返回 already_bound: true（不重复消费）
- [ ] 注销 RPC 容错：RPC 失败时 API 返回 500 + deletion_logs 有 failed 记录 + error_message 有值

