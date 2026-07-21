# Midnight Diary (深空回响) - 项目上下文

> ## 🚧 当前进度（2026-07-21 灵感系统 Phase 1-4 已完成；SQL Migration 已执行；待真机 + E2E 验收）
> **已落地（代码 + tsc 通过）**：3 张新表 migration / 6 个 API 路由 / note-service + practice-service / inspiration-store / 灵感 Tab + 笔记 + 练习 + 日历 / LongPressText + LongPressMenu / ResponseLetter + WritingSteps 接入 / 升级版 `delete_user_account` RPC（覆盖 notes/practices/practice_logs）。
> **已完成**：✅ SQL Migration 在 Supabase SQL Editor 执行（3 张表 + RLS + 索引 + 升级版 RPC）。
> **剩余工作**（按顺序）：
> 1. **真机长按验收（iOS Safari + Android Chrome）**：500ms 触发 / 不与原生 callout 冲突 / 菜单位置 / 滚动不误触发。
> 2. **端到端 E2E**：按本文「灵感系统」Push 前必检清单逐项打勾。
> 3. **注销流程覆盖新表**：新建测试账号 → 写日记 → 长按 AI 存笔记 + 加练习 + 打卡 → 注销 → SQL Editor 查 `notes` / `practices` / `practice_logs` 应无该 user_id 残留。
> 4. **若需部署**：push 到 main → Vercel 自动构建 → diary.yongteam.com 验证。
> **已 commit 记录**：feature commit（代码） + docs commit（本文件）。

## 技术栈
- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + tw-animate-css + Zustand + 手写 SW
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API
- 部署：GitHub → Vercel → Cloudflare (diary.yongteam.com)
- 环境变量：`.env.local`，禁止硬编码，禁止询问 Key

## 核心文件（按功能域）
**Store & 基础**
- `src/store/diary-store.ts` — Zustand 全局数据缓存（entries 分页 / diariesForReport 全量 / reports 三路 + 5min staleTime + 空闲预加载）
- `src/components/ui/skeleton.tsx` / `DiaryListSkeleton.tsx` / `ReportSkeleton.tsx` / `ReportListSkeleton.tsx` — 骨架屏

**Hooks**
- `src/hooks/use-diary-autosave.ts` — 日记自动保存 hook（800ms 防抖 + visibilitychange + beforeunload keepalive + flush；通过 diaryId 区分 localStorage 草稿 / 云端 PATCH）

**日记读写**
- `src/lib/diary-service.ts` — 日记 CRUD + 日期辅助函数 + 分页 + `deepMergeContent` 导出
- `src/components/diary/ResponseLetter.tsx` — 列表卡片 + 详情抽屉 + PATCH 日期修改 + chat_history 懒加载
- `src/components/diary/WritingSteps.tsx` — 撰写流程 + 引导提问渲染 + diaryDate 传递 + useDiaryAutoSave 接入（localStorage 草稿模式）
- `src/components/diary/DiaryEditView.tsx` — 编辑页 + useDiaryAutoSave 接入（云端 PATCH 模式）+ 状态条 + flush 兜底
- `src/app/write/WriteContent.tsx` — 新建/编辑路由分流（新建含日期选择器）
- `src/app/api/diaries/[id]/route.ts` — PATCH 接受 `{ diaryDate }` 和/或 `{ content, labelsSnapshot }`（deep merge，不碰 chat_history）

**导出**
- `src/components/diary/DiaryExportButton.tsx` — Excel/Word 导出弹窗
- `src/components/diary/DateRangePicker.tsx` — 日期范围选择器（列表页 + 导出弹窗共用）

**报告 & 摘要**
- `src/lib/narrative-report-service.ts` — 报告 CRUD
- `src/components/narrative-report/NarrativeReport.tsx` / `ReportDetailView.tsx` — 报告容器 + 详情

**AI & 记忆**
- `src/app/api/ai/route.ts` — 每日解读
- `src/app/api/ai/guide-questions/route.ts` — 动态引导提问（千人千面 + 时空共鸣）
- `src/app/api/report/route.ts` — 叙事报告生成
- `src/app/api/summary/route.ts` — AI 摘要精炼
- `src/app/api/cron/consolidate-memory/route.ts` — 异步记忆合并器
- `src/lib/memory-service.ts` — 记忆档案类型 + 浏览器 fetch
- `src/app/my/archive/page.tsx` — 用户档案库详情页

**提示词实验坊**
- `src/lib/prompt-defaults.ts` — 4 套默认 Prompt 模板（{{var}} 占位符）
- `src/lib/prompt-templates.ts` — getActivePrompt() Server 查询服务
- `src/app/api/prompts/route.ts` — 提示词管理 API（GET 自愈 / POST 另存为 / PATCH 切换）
- `src/app/my/prompts/page.tsx` — 双栏控制台
- `src/components/my/PromptLabCard.tsx` — 入口折叠卡片

**用户 & 我的 Tab**
- `src/components/my/MySettings.tsx` — 维度管理 + 专家选择 + 档案库入口
- `src/components/my/MemoryCard.tsx` — 档案库入口卡片
- `src/config/experts-config.ts` — 6 预设专家 + 自定义

**Service Worker**
- `public/sw.js` — 纯手写 SW（StaleWhileRevalidate + NetworkFirst + navigationPreload）
- `src/components/ServiceWorkerRegister.tsx` — 生产环境 window-load 后注册

**内测码 & 管理员**
- `src/app/invite-required/page.tsx` — 内测码验证页（useRef 锁 + mount 预检 + 硬跳转）
- `src/app/admin/invite-codes/page.tsx` — 管理员后台
- `src/app/api/validate-invite-code/route.ts` / `consume-invite-code/route.ts` / `admin/invite-codes/route.ts` — 码校验 / 消费 / CRUD
- `src/app/api/account/delete/route.ts` — 账号注销 API

**灵感系统（第 5 Tab）**
- `supabase/migrations/20260721_inspiration_system.sql` — 3 张表 + RLS + 索引 + 升级版 `delete_user_account` RPC（⚠️ 需在 Supabase SQL Editor 手动执行）
- `src/lib/note-service.ts` — 珍藏碎片 CRUD（browser 单例）
- `src/lib/practice-service.ts` — 心灵练习 CRUD + 打卡幂等 + 连续天数计算（JS 端向前遍历）
- `src/lib/clipboard.ts` — `copyText()` 跨环境复制（navigator.clipboard + textarea/execCommand 兜底）
- `src/store/inspiration-store.ts` — Zustand（notes / practicesActive / practicesCompleted / todayCheckedIds: Set / 5min staleTime / in-flight 去重 / 乐观更新 + 回滚）
- `src/app/api/notes/route.ts` + `[id]/route.ts` — GET/POST + PATCH/DELETE
- `src/app/api/practices/route.ts` + `[id]/route.ts` + `[id]/checkin/route.ts` — GET/POST + PATCH/DELETE + POST 打卡（返回 `{ total_days, consecutive_days }`）
- `src/components/inspiration/InspirationContainer.tsx` — 嵌套子 Tabs（珍藏碎片 / 心灵练习）
- `src/components/inspiration/common/LongPressText.tsx` — 500ms 长按 + 右键 + 点击阻断（长按后阻止后续 click 冒泡到父 onClick）
- `src/components/inspiration/common/LongPressMenu.tsx` — 复制 / 存为笔记 / 加入打卡 三项浮层
- `src/components/inspiration/common/SourceBadge.tsx` / `GotoDiaryButton.tsx` / `Toast.tsx` — 来源标签 / 跳日记按钮（`/write?id=`）/ 轻量 toast
- `src/components/inspiration/notes/NoteListPanel.tsx` / `NoteItem.tsx` / `NoteEmptyState.tsx` / `NoteListSkeleton.tsx` / `NoteEditorSheet.tsx`
- `src/components/inspiration/practices/PracticeTabs.tsx` / `TodayPracticeList.tsx` / `HistoryPracticeList.tsx` / `PracticeItem.tsx` / `PracticeListForCalendar.tsx` / `PracticeCalendarView.tsx` / `PracticeEmptyState.tsx` / `PracticeEditorSheet.tsx` / `PracticeListSkeleton.tsx`
- `src/components/diary/ResponseLetter.tsx` — 列表卡片 AI 预览 + 详情抽屉 AI 文字均已包 `<LongPressText>`
- `src/components/diary/WritingSteps.tsx` — 提交后 AI 对话也已包 `<LongPressText>`

**Supabase 客户端**
- `src/lib/supabase/client.ts` — 浏览器端单例 client
- `src/lib/supabase/middleware.ts` — auth + 内测码守卫

## 数据库（10 张核心表）
| 表 | 关键字段 | 说明 |
|---|---|---|
| `profiles` | module_config, expert_style, custom_expert_tags, role, invite_code_id | 用户配置 |
| `diaries` | content, chat_history, module_summaries, module_labels_snapshot, diary_date, created_at | 日记主体（created_at DB 触发器保护） |
| `reports` | theme, content, is_public, expert_style | AI 报告 |
| `user_memories` | mental_baseline, recurring_patterns, active_events | 动态记忆档案 |
| `prompt_configs` | type, version_number, name, content, is_active | 提示词版本管理 |
| `invite_codes` | code, used_by, used_at, deleted_at, is_deleted | 内测码 |
| `deletion_logs` | user_id, status, error_message | 注销审计日志 |
| `notes` | user_id, content, source_type, source_diary_id, source_diary_date, deleted_at, is_deleted | 珍藏碎片（软删 + RLS 单条 `FOR ALL`） |
| `practices` | user_id, title, source_type, source_diary_id, source_diary_date, status(active/completed), completed_at, deleted_at, is_deleted | 心灵练习（软删 + 状态机） |
| `practice_logs` | user_id, practice_id, practiced_at, deleted_at, is_deleted | 打卡日志（UNIQUE(user_id, practice_id, practiced_at)，软删后可复活） |

## 关键业务规则（易踩坑索引）
1. **一日一记**：`diary_date` 精确匹配，新建/切换日期前调 `getDiaryByDate` 校验，有则拦截。
2. **深度合并保存**：upsert 前必须 fetch 云端 Deep Merge，严禁直接覆盖。
3. **日期字段分层**：展示/过滤用 `getDiaryEffectiveDate()`（diary_date 优先），检测用 `diary_date`。
4. **模块维度**：固定 4 个（身心觉知 / 人际链接 / 高光瞬间 / 感恩与愿景），顺序不可变，带 A. B. C. D. 前缀。
5. **名称回溯**：label 变更后显示"当前名 (原名: …)"。
6. **莫兰迪色点**：m1–m4 固定色，新增循环分配，禁止灰色兜底。
7. **语音输入**：60s 倒计时，核心 Hooks 禁止改动。
8. **AI 摘要**：5–20 字，骨架格式"【事件】｜【情绪】"或"因…感到…"。
9. **注意力权重 (80/15/5)**：80% 今日 / 15% 记忆仅作滤镜 / 5% 近期连续性。
10. **引导提问预加载**：主页静默 fetch 写 sessionStorage，次日 / 维度漂移自动失效。
11. **提示词 v1.0 只读**：系统自带模板禁止直接修改，必须"另存为新版本"后编辑。
12. **专家标签快照化**：解读标签来自 chat_history 首条 AI 消息；报告标签来自 reports.expert_style。
13. **记忆档案注入**：System Prompt 隐形注入，严禁暴露"档案"字眼；无记忆时优雅降级。
14. **Tab 常驻 DOM**：4 个 `<TabsContent>` 均加 `forceMount + data-[state=inactive]:hidden`，切 Tab 零请求。
15. **性能 - 轻量 select**：列表严禁 `select("*")`，排除 chat_history / module_summaries；详情抽屉懒加载单行全量。
16. **性能 - 首屏分页**：entries 默认 limit=10，底部「加载更多」追加；diariesForReport + reports 空闲预加载。
17. **性能 - 动态导入**：xlsx/docx 用 `await import("@/lib/export-utils")`；DiaryReport / NarrativeReport 用 `next/dynamic + ssr: false`。
18. **字体**：Noto_Serif_SC 仅 weight 400/600，全项目禁止 `font-bold`。
19. **SW 按需缓存**：install 仅 `skipWaiting()`，不预缓存；静态资源 StaleWhileRevalidate，API NetworkFirst。
20. **内测码消费**：幂等检查 → `.is("used_by", null)` 原子乐观锁 → 绑 profile；失败回滚码标记。
21. **注销流程**：RPC 返回 TEXT('ok'/'error: ...')，业务表物理删除 → 删 auth.users；内测码 UPDATE 回收（非 DELETE）。
22. **内测码验证页**：useRef 提交锁；成功用 `window.location.href = "/"` 硬跳转；409 兜底重查 profile。
23. **自动保存 hook**：`useDiaryAutoSave` 通过 `diaryId` 区分目标 — 提供 → PATCH `/api/diaries/[id]`（编辑页，deep merge，不碰 chat_history）；缺省 → localStorage 草稿（新增页，与原内联逻辑等价）。800ms 防抖 + visibilitychange（PWA 切后台）+ beforeunload（keepalive 关标签）+ flush（返回按钮/提交前）。编辑页"取消"按钮必须先 flush 再跳转，禁止静默丢弃变更。
24. **灵感系统 · 软删级联**：删 practice 必须先软删 `practice_logs`（UPDATE is_deleted=true WHERE practice_id=id），再软删 practice 本身（两步浏览器端事务，无 DB 级 FK 级联）。
25. **灵感系统 · 打卡幂等**：`toggleCheckin` 命中已软删记录时必须复活（UPDATE is_deleted=false, deleted_at=null）而非 INSERT，以绕开 `UNIQUE(user_id, practice_id, practiced_at)` 约束；uncheckin = 软删对应日期的 log。
26. **灵感系统 · 连续天数算法**：`consecutive_days` 在 JS 端向前遍历 — 若今日已打卡则从今日开始数；否则从昨日开始数；遇到首个无打卡日立即停止。`total_days` 用 COUNT(`is_deleted=false`)。
27. **灵感系统 · 长按仅 AI 文字**：`<LongPressText>` 只包 AI 消息（`msg.type === "ai"`），用户文字（`type: "user"`）与日记原文均不包；空 text 不弹菜单；长按触发后用 `longPressTriggeredRef` 阻断后续 click 事件冒泡（防止父 onClick 打开日记详情）。
28. **灵感系统 · 跳转日记复用 `/write?id=`**：来源日记跳转按钮统一用 `<Link href={'/write?id=' + sourceDiaryId}>`；手动添加的笔记/练习 `sourceDiaryId` 缺省 → 按钮置灰 disabled。
29. **灵感系统 · source_diary_date 冗余**：创建 note/practice 时若带 `source_diary_id`，server 端必须查 diaries 表校验 `user_id` 归属 + 读 `diary_date` 写入 `source_diary_date`（避免列表再 JOIN）。
30. **灵感系统 · 5 Tab 常驻 DOM**：第 5 个 TabsContent「灵感」同样 `forceMount + data-[state=inactive]:hidden`；子 Tabs（珍藏碎片 / 心灵练习 + 打卡 / 打卡查看）同样常驻；`InspirationContainer` 用 `next/dynamic + ssr: false` 独立 chunk。

## 开发规范
- 修改前声明涉及文件列表。
- 组件必须定义 TypeScript props interface。
- 修改后说明影响范围，引导验证。
- 禁止擅自调整视觉样式。

## Push 前必检（按模块）
**核心数据**
- [ ] 模块字母前缀、名称回溯、停用维度数据保留
- [ ] 语音录音、倒计时、光标插入、多次追加正常
- [ ] 分次保存不覆盖、module_labels_snapshot 写入
- [ ] 编辑页自动保存：输入→~1s 后"已自动保存"→刷新→内容已更新
- [ ] 编辑页切后台/关标签→重新进入→内容已保存（visibilitychange + beforeunload keepalive）
- [ ] 编辑页"取消"按钮→触发 flush→不丢变更；断网→"保存失败"提示→恢复→自动补存
- [ ] 新增页行为无回归：localStorage 草稿恢复 + "下一步"云端同步正常；chat_history 不被覆盖

**AI & 报告**
- [ ] 每日解读 / 报告 / 摘要生成完整、专家标签快照正确
- [ ] 引导提问预加载命中缓存、字数 6–10 字、维度漂移自动重 fetch
- [ ] 记忆档案：新用户首次正常、合并后有数据、档案库渲染正常

**提示词实验坊**
- [ ] 双栏控制台渲染、另存为新版本事务切换、v1.0 只读保护、4 大 AI 接口降级正常

**日期**
- [ ] PATCH 后 diary_date 更新、展示/过滤使用新日期、created_at 不变
- [ ] 新建默认当天、未来日期锁定、已有日期拦截

**性能 & 架构**
- [ ] 首页 / Tab 切换 < 3s；列表查询排除 chat_history / module_summaries
- [ ] 详情抽屉 chat_history 懒加载、追问 input disabled={!historyLoaded}
- [ ] 导出动态加载 xlsx/docx chunk；Tab forceMount + 隐藏正确
- [ ] 首屏 limit=10 + 加载更多；DiaryReport/NarrativeReport 独立 chunk
- [ ] SW 激活、静态资源从 cache 返回；middleware 公开路径跳过 getUser()
- [ ] Supabase client 单例；字体 woff2 数量正确；无 font-bold

**内测码 & 注销**
- [ ] 新用户注册 → 登录 → /invite-required → 有效码 → 进入
- [ ] 无效码 / 已使用码 / 被他人使用码 错误文案正确
- [ ] admin 入口可见、批量生成 / 筛选 / 删除正常、非 admin 403
- [ ] 乐观锁并发只有一个成功；已绑码返回 already_bound
- [ ] 注销后 auth.users / profiles / diaries 无残留；内测码 used_by 恢复 NULL
- [ ] 注销 RPC 失败时 500 + deletion_logs failed 记录
- [ ] 验证页首次点击 loading + 禁用；连点只发 1 次请求；mount 预检自动跳转
- [ ] **灵感系统覆盖**：注销后 `notes` / `practices` / `practice_logs` 三表无该 user_id 残留（升级版 RPC `20260721` 已建表 + 注销覆盖）

**灵感系统（Phase 5 — SQL 已执行，待真机 + E2E 验收）**
- [x] SQL migration `20260721_inspiration_system.sql` 已在 Supabase SQL Editor 手动执行（3 张表 + RLS + 索引 + 升级版 `delete_user_account` RPC）
- [ ] 顶部第 5 Tab「灵感」切 Tab 零请求（forceMount + hidden 生效）
- [ ] 笔记：手动添加 → 列表渲染 → 编辑覆盖原文 → 软删 → 来源标签正确 → 跳转日记（手动置灰 / AI 跳 `/write?id=`）→ 空状态引导
- [ ] 练习：今日待完成↔今日已完成 AnimatePresence 实时移入移出 → 勾选失败回滚 → 完结进历史 → 删除软删 + 级联软删 practice_logs
- [ ] 打卡查看 Tab：点练习进入日历 → 当月已打卡日期绿色小圆点 → 切月加载 `fetchPracticeLogsByMonth`
- [ ] 长按列表卡片 AI 预览（若有）→ 菜单弹出 → 存为笔记 → 切回灵感 Tab 看到该笔记
- [ ] 长按详情抽屉 AI 文字 → 同流程；长按用户文字无反应；长按日记原文无反应
- [ ] 长按 WritingSteps 提交后 AI 对话 → 同流程
- [ ] 复制写入剪贴板（iOS Safari + Android Chrome 真机验证 500ms 触发、不与原生 callout 冲突、滚动时不误触发）
- [ ] 累计天数 + 连续天数在勾选后即时刷新

**构建**
- [ ] npx tsc --noEmit 零报错

后续开发中，如果你需要某条规则的具体实现细节（如 forceMount 配合 hidden 的写法、Zustand ensure 的生命周期、consume-invite-code 的原子锁逻辑），直接读取对应源码文件，而非依赖本文档的展开描述。