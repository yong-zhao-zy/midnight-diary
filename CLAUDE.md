# Midnight Diary (深空回响) - 项目上下文

> ## 🚧 当前进度（2026-10-23 第八轮：每日好饭界面重构 + AI 报告快照）
>
> **定位升级**：从"日记应用"升级为"个人生活工作台"。顶部模块切换层（每日一记 / 每日好饭），两个模块平行、数据完全独立。日记模块所有表/service/store/API 未改动。  
> **第八轮（2026-10-21 ~ 10-23 已上线，最新 32704d6 / fea984d）**：【每日好饭】界面重构 + 报告快照 — ① Tab 重排为【菜谱、饮食、身体、分析】4 个（概览 Tab 删除）；② 【饮食】顶部概览卡升级为**四宫格**（左上热量环+宏量克数、右上宏量雷达、左下矿物质雷达、右下维生素雷达，`NutrientOverviewGrid` 饮食/分析两 Tab 共用）；③ 营养素雷达**弃用 recharts 改纯 SVG**（PolarAngleAxis 自定义 tick payload 形态不稳定，轴标签两轮修不好）；④ 【分析】页趋势图+四宫格**自动展示**，「生成报告」按钮只管 AI 文字（置于雷达图下方），默认当前自然周；⑤ AI 报告快照落 `ai_analysis_reports`，切日期/换范围再切回直接回放 + 「重新生成」；⑥ 分析数据截止最近已发生日期（未来是空不是 0）；⑦ AI 食物估算校验放宽支持补剂（鱼油/维D 等）；⑧ AI 报告瘦身（删深度复盘板块，「下餐/下期可执行行动指南」改名「下餐行动指南」）。详见规则 56-59。  
> **第七轮（已上线 push 1b8e950）**：【每日好饭】新增干燥症抗炎饮食分析 — 【饮食】Tab 底部「今日饮食分析」按钮（内联 markdown 展开：4 看板 + 8 大营养素达成表 + 复盘 + 行动指南）；【分析】Tab「AI 解读与建议」prompt 换干燥症抗炎抗糖视角（趋势图表不变）。新增 `analyzeDay()` + `diet-analysis` API + `DailyAnalysisCard` + 共享 `health-prompts.ts`；react-markdown + remark-gfm 渲染表格；globals.css 加 `.prose-food-analysis` 样式。Omega-3 foods 表无字段，AI 根据食材推算，零 DB 改动。  
> **第六轮（已上线 push 484f994）**：新增【每日好饭】模块 — 5 张新表 + DRI 配置 + 108 种食材种子 + 6 个 service + food-store + 15 个 API 路由 + 5 子 Tab 页面 + recharts 图表 + DeepSeek AI 营养解读。SQL migration `20260914_food_health_system.sql` 已执行、食物种子已导入（108 条）。验收通过。  
> **第五轮（已上线）**：手机端长按选字不流畅 → 放弃划选模型，改「点段落出菜单」。  
> **已完成 SQL**：✅ `20260721` ✅ `20260723_fix_cascade_delete.sql` ✅ `20260727_fix_notes_rls.sql` ✅ `20260914_food_health_system.sql`（每日好饭 5 表 + profiles.health_profile + 升级 delete_user_account RPC 覆盖 5 新表）✅ `20261019_fix_food_rls_update.sql`（v3，四张好饭表 SELECT 策略去掉 `is_deleted`）✅ `20261020_summary_overrides.sql`（摘要覆盖层，4 条 RLS 策略）✅ `20261020_period_summaries.sql`（周/月摘要缓存）✅ `20261022_ai_analysis_reports.sql`（AI 报告快照表，经 Management API 在线上执行）
>
> **2026-10-20 验收通过**：【每日好饭】菜谱 / 饮食记录 / 自定义食物「点删除短暂消失又出现、刷新后仍在」已修复 —— 删除后不再复现。根因与结论见「关键业务规则」第 52 条。
>
> **2026-10-20 P2 已实现**：【日记概览】周/月单元格弹窗 —— 每模块列出该周期内的日摘要（编辑过的优先）+ 周期 AI 摘要（可编辑 / 恢复 / 重新生成）。AI 周期摘要落 `period_summaries`，按内容指纹缓存，四模块一次生成。见「关键业务规则」第 54 条。

> ## 第五轮及之前进度（灵感系统）

> **已落地（代码 + tsc 通过）**：3 张新表 migration / 6 个 API 路由 / note-service + practice-service / inspiration-store / 灵感 Tab + 笔记 + 练习 + 日历 / LongPressText + LongPressMenu / ResponseLetter + WritingSteps 接入 / 升级版 `delete_user_account` RPC（覆盖 notes/practices/practice_logs）/ `soft_delete_practice` 原子性 RPC / `todayShanghaiStr()` 东八区日期 / LongPressMenu store 同步。  
> **第一轮 Bug 修复（adca3fd）**：① `removeNote`/`removePractice` 改走 DELETE API 路由；② `notesFetchedAt: Date.now()`（修复永久 skeleton）；③ `hasSelection` 字段 + 无选区只显示「复制」。  
> **第二轮 Bug 修复（0271e7e）**：① `removeNote` 改为等 API 确认后再从 store 移除（消除闪现）；② `ensureNotes`/`ensurePractices` fetch 完成时合并乐观添加项；③ `LongPressText` 移除 `WebkitUserSelect: "text"` 覆盖（已在第三轮撤回，见下）。  
> **第三轮 Bug 修复（7b8aa39）**：`LongPressText` 完全重写 — 放弃 500ms 计时器，改为监听 `selectionchange`（300ms debounce）；wrapper 设 `WebkitUserSelect: "text"` 允许 iOS 原生文字选择；选区稳定后自动弹出自定义菜单；`contextmenu` 兜底桌面右键无选区场景。  
> **第四轮 Bug 修复（当前）**：  
> ① **笔记删除改为物理删除**：notes 原走软删（UPDATE `is_deleted=true`），但 RLS + RETURNING 屡出问题 —— 先是 UPDATE USING 含 `is_deleted=false` 导致软删被 silently blocked；拆分 RLS 策略后又有 `.select("id")` 的 RETURNING 被 SELECT 策略（`is_deleted=false`）过滤，返回 0 行误判失败。**最终方案**：放弃软删，notes 删除改为 **物理 DELETE**（`deleteNote`，行直接从表中移除）。RLS DELETE 策略 `USING (user_id=auth.uid())` 放行，无 RETURNING 过滤问题。`20260727_fix_notes_rls.sql` 已执行（策略已拆分），但对硬删流程已非必须。  
> ② **iOS 选区后无法移动光标**：`LongPressMenu` backdrop 有 `onTouchStart={onClose}`，用户拖动选择句柄时 touchstart 命中 backdrop 立即关闭菜单并清空选区。**修复**：移除 `onTouchStart={onClose}`，保留 `onClick` 即可（拖动不触发 click）。  
> **第五轮（当前）**：手机端长按选字不流畅 → 放弃划选模型，改「点段落出菜单」。`LongPressText` 运行时 `matchMedia("(hover: none) and (pointer: coarse)")` 检测触屏 → 手机端在 AI 段落下方渲染「收藏」按钮（Sparkles 图标），一点即出菜单（复制/存为笔记/加入打卡，整段为操作对象），按钮 `stopPropagation` 防触发列表卡片 onClick；段落正文不绑点击，滚动/原生划选复制零干扰；`selectionchange` 菜单逻辑在 `isTouch` 时跳过（避免与 iOS 原生拷贝条双菜单）。桌面端完全保留划选 + 右键流程。  
> **已完成**：✅ SQL Migration `20260721` 已执行。✅ SQL Migration `20260723_fix_cascade_delete.sql` 已执行。✅ SQL Migration `20260727_fix_notes_rls.sql` 已执行（notes RLS 策略已拆分；现 notes 删除已改为物理 DELETE，此 migration 对删除流程已非必须）。  
> **剩余工作**（按顺序）：
>
> 1. **⚠️ 在 Supabase SQL Editor 执行 `20260727_fix_notes_rls.sql`** — 修复笔记删除 RLS。
> 2. **真机验收**：笔记删除 → 刷新后不复现；iOS 长按 AI 文字选区 → 可拖动句柄调整范围 → 菜单跟随新选区更新。
> 3. **端到端 E2E**：按本文「灵感系统」Push 前必检清单逐项打勾。
> 4. **注销流程覆盖新表**：新建测试账号 → 写日记 → 长按 AI 存笔记 + 加练习 + 打卡 → 注销 → SQL Editor 查 `notes` / `practices` / `practice_logs` 应无该 user_id 残留。

## 技术栈

- 前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + tw-animate-css + Zustand + 手写 SW
- 后端：Supabase (PostgreSQL + Auth) + DeepSeek API
- 部署：GitHub → Vercel → Cloudflare (diary.yongteam.com)
- 保活：Vercel Cron（`vercel.json` → `/api/cron/keepalive`，每日 01:00 UTC）+ GitHub Actions（`.github/workflows/supabase-keepalive.yml`）双链路，防 Supabase 免费计划 7 天无活动被暂停
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
- `src/lib/summary-override-service.ts` — 摘要覆盖层读写（fetch / save / delete / moveDayOverrides，上限按粒度 日20/周40/月60 字）
- `src/store/summary-override-store.ts` — 覆盖层 Zustand 缓存（`{ scope:periodKey: { moduleId: content } }`，5min stale，独立于 diary-store）
- `src/app/api/summary-overrides/route.ts` — GET(按 scope) / PUT(保存，空 content = 删除) / DELETE(恢复 AI)
- `src/lib/period-summary-service.ts` — 周期 key / 日期区间纯函数（周一起算；客户端可用）
- `src/lib/period-summary-server.ts` — 周/月 AI 摘要生成 + 指纹缓存 + `refreshWeekForDate()`（server-only）
- `src/app/api/period-summary/route.ts` — POST 取周期摘要（指纹一致读缓存，否则生成）
- `src/lib/module-text.ts` — 正文 / AI 摘要取值封装（新 key 与历史 key 回落统一在这里）
- `src/components/report/DiaryPreviewCard.tsx` — 概览日单元格弹窗：模块正文 + 摘要行（AI / 已编辑 / 编辑 / 恢复 AI）
- `src/components/report/PeriodPreviewCard.tsx` — 概览周/月单元格弹窗：各日摘要列表 + 周期摘要（可编辑 / 恢复 AI / 重新生成）
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
- `supabase/migrations/20260723_fix_cascade_delete.sql` — `soft_delete_practice` 原子性 RPC（SECURITY DEFINER + 事务内级联软删，⚠️ 需在 Supabase SQL Editor 手动执行）
- `src/lib/date-utils.ts` — `todayShanghaiStr()` / `minusOneDay()` 东八区日期工具（`Intl.DateTimeFormat` 显式 `Asia/Shanghai`）
- `src/lib/note-service.ts` — 珍藏碎片 CRUD（browser 单例）
- `src/lib/practice-service.ts` — 心灵练习 CRUD + 打卡幂等 + 连续天数计算（JS 端向前遍历）+ `softDeletePractice` 走 RPC
- `src/lib/clipboard.ts` — `copyText()` 跨环境复制（navigator.clipboard + textarea/execCommand 兜底）
- `src/store/inspiration-store.ts` — Zustand（notes / practicesActive / practicesCompleted / todayCheckedIds: Set / 5min staleTime / in-flight 去重 / ensureNotes 合并乐观项 / removeNote 非乐观等 API 确认）
- `src/app/api/notes/route.ts` + `[id]/route.ts` — GET/POST + PATCH/DELETE
- `src/app/api/practices/route.ts` + `[id]/route.ts` + `[id]/checkin/route.ts` — GET/POST + PATCH/DELETE + POST 打卡（返回 `{ total_days, consecutive_days }`）
- `src/components/inspiration/InspirationContainer.tsx` — 嵌套子 Tabs（珍藏碎片 / 心灵练习）
- `src/components/inspiration/common/LongPressText.tsx` — 双交互模型：手机端「收藏」按钮一点出菜单（整段）；桌面端 selectionchange 划选 + contextmenu 右键
- `src/components/inspiration/common/LongPressMenu.tsx` — 复制 / 存为笔记 / 加入打卡 三项浮层 + POST 成功后 `useInspirationStore.setState()` 同步
- `src/components/inspiration/common/SourceBadge.tsx` / `GotoDiaryButton.tsx` / `Toast.tsx` — 来源标签 / 跳日记浏览按钮（`/diary?id=`）/ 轻量 toast
- `src/app/diary/page.tsx` + `DiaryBrowseContent.tsx` — 日记浏览页（只读，`?id=` 加载 + 渲染 `DiaryDetail`，`isLatest={false}` 隐藏编辑按钮）
- `src/components/inspiration/notes/NoteListPanel.tsx` / `NoteItem.tsx` / `NoteEmptyState.tsx` / `NoteListSkeleton.tsx` / `NoteEditorSheet.tsx`
- `src/components/inspiration/practices/PracticeTabs.tsx` / `TodayPracticeList.tsx` / `HistoryPracticeList.tsx` / `PracticeItem.tsx` / `PracticeListForCalendar.tsx` / `PracticeCalendarView.tsx` / `PracticeEmptyState.tsx` / `PracticeEditorSheet.tsx` / `PracticeListSkeleton.tsx`
- `src/components/diary/ResponseLetter.tsx` — 列表卡片 AI 预览 + 详情抽屉 AI 文字均已包 `<LongPressText>`
- `src/components/diary/WritingSteps.tsx` — 提交后 AI 对话也已包 `<LongPressText>`

**Supabase 客户端**

- `src/lib/supabase/client.ts` — 浏览器端单例 client
- `src/lib/supabase/middleware.ts` — auth + 内测码守卫

**每日好饭模块（第 6 轮 — 健康饮食+身体数据追踪，与日记模块平行）**

- `supabase/migrations/20260914_food_health_system.sql` — 5 张新表 + profiles.health_profile JSONB + RLS + 索引 + 升级版 `delete_user_account` RPC（覆盖 5 新表，⚠️ 已在 Supabase SQL Editor 执行）
- `src/config/dri-config.ts` — DRI 膳食营养素参考摄入量配置：`NUTRIENT_KEYS`（20 项 = 5 宏量 + 15 微量）+ `NUTRIENT_LABELS`/`NUTRIENT_UNITS` + `DRI_TABLE`（性别 × 8 年龄段，约 180 个数值）+ `ACTIVITY_FACTORS` + `calcAge`/`resolveAgeGroup`/`calcBMR`（Mifflin-St Jeor）/`calcTDEE`/`getPersonalizedDRI`
- `scripts/data/foods-seed.json` — 108 种常见食材（12 大类，含完整微量营养素）
- `scripts/seed-foods.ts` — 幂等导入脚本（`npx tsx scripts/seed-foods.ts`，查重后只插新增，不依赖 onConflict/unique 约束）
- `src/lib/food-service.ts` — 食物库 CRUD（searchFoods 搜 system+user / fetchUserFoods / getFoodById / **fetchFoodsByIds**（in 批量，覆盖 system+user，周期微量计算用）/ createFood / updateFood / softDeleteFood；system 食物不可改删）
- `src/lib/ai-food-service.ts` — AI 拍照/描述估营养（DeepSeek）。**校验边界已放宽支持补剂**（2026-10-21，eeaae17）：energy 允许 [0,950] kcal（鱼油/维D 片近 0 能量不被拒）、份量 ≥0.1g（胶囊/粒）、energy<20 时宏量守恒用绝对容差 20 kcal、营养素总和 0.5 浮点容差；prompt 含膳食补剂说明（按 100g 输出、份量按粒/片/勺）
- `src/lib/recipe-service.ts` — 菜谱 CRUD + `calculateRecipeNutrition`（**核心计算**：`Σ(food.nutrient × qty/100)/servings`，微量任一食材为 null 则整体 null）
- `src/lib/diet-log-service.ts` — 饮食记录 CRUD + 创建/更新时**冻结营养素快照**（food 按 quantity_g/100 算，recipe 按 per_serving×servings 算，防后续食物/菜谱修改影响历史）
- `src/lib/body-metric-service.ts` — 身体数据 CRUD（upsert 靠 `UNIQUE(user_id, log_date)` 约束覆盖；物理 DELETE）
- `src/lib/health-profile-service.ts` — 健康画像读写（profiles.health_profile JSONB）
- `src/lib/nutrition-analysis.ts` — 纯 JS 营养分析（`analyzePeriod`/`analyzeDay`/`calculateEnergyNeeds`/`rateNutrient`；钠反向 >120% 过量，其他正向 ≥80% 充足 / 50-80% 临界 / <50% 不足；无数据评级 `no_data`、`has_data` 区分「真 0 摄入」与「无数据库值」；`analyzeDay` 另出与周期同口径的 `assessments` 20 项评估供四宫格雷达；周期/单日均支持 `opts.refWeight` 体重兜底）
- `src/store/food-store.ts` — Zustand（dietLogsByDate / bodyMetrics / recipes / userFoods / foodSearchCache / healthProfile + 5min staleTime + in-flight 去重 + 乐观更新+回滚 + `reset()`）
- `src/app/api/foods/route.ts` + `[id]/route.ts` — 搜索/创建 + 改/删 user 食物
- `src/app/api/recipes/route.ts` + `[id]/route.ts` — 列表/创建(含食材+算营养) + 详情/更新/软删
- `src/app/api/diet-logs/route.ts` + `[id]/route.ts` — 查(?date= 或 ?start=\&end=)/创建(冻结营养) + 改(重算)/软删
- `src/app/api/body-metrics/route.ts` + `[id]/route.ts` — 查/upsert + 删
- `src/app/api/health-profile/route.ts` — 读写健康画像
- `src/app/api/health-analysis/route.ts` — 周期 AI 分析（analyzePeriod → DeepSeek，AI 不重算只解读）。`GET ?startDate=&endDate=` 只读缓存（未命中现算 analysis 回给图表，不调 LLM）；`POST {startDate, endDate, force}` 生成并封存；**周期内无饮食记录直接 400 不封存**；`resolveDataEnd()` = min(endDate, 今天) 内最后一条有饮食记录的日期（未来/未记录天不进坐标不参与日均），快照 key 用 `start_dataEnd` 跨天自然失效
- `src/app/api/diet-analysis/route.ts` — 今日饮食分析 API（批量 JOIN foods → analyzeDay → DeepSeek，干燥症 prompt 出 4 看板+8 营养素表+下餐行动指南）。`GET ?date=` 有快照回放快照；无快照**现算 analyzeDay 只回 analysis**（供四宫格雷达，不调 LLM；⚠️ `computeDayAnalysis` 返回 `{analysis, profile}` 包装对象，调用处必须解构，曾因整包返回导致雷达全「暂无数据」，fea984d 修复）；`?fresh=1` 绕过快照现算（饮食记录变化后雷达实时刷新）；`POST {date, force}` 生成 AI 报告并封存
- `src/lib/analysis-report-service.ts` + 表 `ai_analysis_reports` — AI 报告快照（scope=`day`/`period`，key=日期 或 `start_dataEnd`），切日期/换范围再切回直接回放（chart 用 payload、文案用 report），带「重新生成」（force=true）；`isUsableReport()` 拦截 AI 占位文案（「AI 解读暂不可用…」）不落库
- `src/lib/day-analysis-client.ts` — 【饮食】Tab 专用单日分析客户端缓存（内存 Map + inflight 去重）：`peek`（切日期渲染期同步）/ `load`（GET）/ `refresh`（?fresh=1 现算）/ `generate`（POST）；`DietLogPanel`（四宫格雷达）与 `DailyAnalysisCard`（AI 报告）共用同一份
- `src/components/food/diet/DailyAnalysisCard.tsx` — 【饮食】Tab 底部「今日饮食分析」展开卡：**只放 AI 报告**（react-markdown + remark-gfm），不放雷达（雷达已在四宫格常驻）；有报告时按钮变「展开/收起」+ 生成时间 + 「重新生成」；重新生成失败保留旧报告
- `src/components/food/FoodHealthContainer.tsx` — 模块容器（**4 子 Tab：【菜谱、饮食、身体、分析】**（2026-10-21 重排，概览 Tab 已删除）+ forceMount + prefetchAll；`next/dynamic + ssr:false` 独立 chunk；【分析】接收 `active` prop，切到该 tab 才拉数据）
- `src/components/food/diet/DietLogPanel.tsx` / `DietLogItem.tsx` / `AddDietLogSheet.tsx` — 顶部 WeekDateBar + **概览四宫格**（雷达数据来自 `day-analysis-client`，饮食记录增删自动刷新）+ 按餐次行式分组（行尾 + 直开录入抽屉，点行下拉展开明细）
- `src/components/food/common/WeekDateBar.tsx` — 周一~周日周条 + 周日旁单日期 DayPicker（mode=single，未来禁用；【饮食】【身体】共用）
- `src/lib/health-prompts.ts` — 干燥症抗炎抗氧化专家 system prompt（饮食今日分析 + 分析Tab 周期解读共享）。**2026-10-22 瘦身（9731784）**：删除「🔍 深度复盘：优势与潜在隐患」板块；「🎯 下餐/下期可执行行动指南」改名「🎯 下餐行动指南」，现结构 = 📊 饮食核心看板 → 🧪 8 大营养素达成看板 → 🎯 下餐行动指南
- `src/components/food/body/BodyMetricPanel.tsx` / `BodyMetricEditorSheet.tsx` — 身体数据列表 + WeekDateBar（高亮选中日期记录）+ 各指标 upsert
- `src/components/food/recipe/RecipePanel.tsx` / `RecipeEditorSheet.tsx` — 菜谱列表 + 食材明细管理+实时预览每份营养
- `src/components/food/common/FoodSearchSheet.tsx` — 食物搜索（300ms 防抖 + 5min 缓存）+ `HealthProfileSheet.tsx` — 健康画像设置
- `src/components/food/analysis/HealthAnalysis.tsx` — 【分析】页：DateRangePicker（**默认当前自然周**）→ 热量体重趋势图 + 概览四宫格（**自动展示**：GET 现算或回放缓存，均不调 LLM；会话内 rangeCache 秒切）→ 「生成报告/重新生成」按钮（**置于四宫格下方**，只管 AI 文字）→ AI 解读与建议。已删自动生成 AI 逻辑（`active` prop 控制切 tab 才拉数据）
- `src/components/food/analysis/CalorieTrendChart.tsx` — recharts 双 Y 轴：热量左主轴（显式 ticks、≥1000 显示 k 单位）+ 体重右次轴（绿色，可选）
- `src/components/food/analysis/NutrientRadarChart.tsx` — **纯 SVG 手写雷达**（2026-10-22 弃用 recharts Radar：PolarAngleAxis 自定义 tick payload 形态不稳定，轴标签修不好）。极坐标换算、0 号轴朝上、MAXV=120 顶格绘制（标签显真实值）、100% 白虚线基准多边形、轴旁两行标签（名称 + 评级着色达成率）、size lg/md/sm 三档
- `src/components/food/analysis/NutrientOverviewGrid.tsx` — **概览四宫格（饮食/分析两 Tab 共用）**：2×2 = 左上热量环（剩余/超出 kcal + 目标/摄入 + 宏量克数三行超标变红）+ 右上宏量雷达（金）+ 左下矿物质雷达（绿）+ 右下维生素雷达（蓝）；周期口径 intakeLabel=日均摄入（日均达成率 = 总摄入/总目标）；assessments 为 null 显示「暂无数据」
- ~~`src/components/food/overview/DailyOverview.tsx` / `BodyTrendChart.tsx` / `NutrientRadarSection.tsx`~~ — **已删除**（概览 Tab 移除 / 并入双轴图 / 并入四宫格），勿再引用
- `src/app/page.tsx` — 顶部新增模块切换层（每日一记/每日好饭），日记 Tabs 包在 `activeModule==="diary"` 条件内；FAB 仅 diary 模块显示；`handleLogout` 追加 `useFoodStore.getState().reset()`

**网络 & 认证链路（2026-10-19 起）**

- `src/lib/supabase/config.ts` — 统一导出真实地址 / anon key / `SUPABASE_STORAGE_KEY`（会话键名），浏览器端 URL 由 `browserSupabaseUrl()` 动态拼 `window.location.origin + /api/supabase`
- `src/app/api/supabase/[...path]/route.ts` — 同域透明转发到真实 Supabase（浏览器不再直连 `*.supabase.co`）
- `src/app/auth/confirm/route.ts` — 邮件链接落地（`token_hash` + `type` → 服务端 `verifyOtp` → 跳 `/update-password` 或 `/login?verified=1`）
- `src/app/api/cron/keepalive/route.ts` + `vercel.json` — 每日保活（200 / 503 即后端健康状态），供外部监控轮询
- `src/lib/supabase/errors.ts` — `isNetworkError()` / `toFriendlyError()`，区分「网络故障」与「密码错误」

## 数据库（18 张表：10 日记 + 5 每日好饭 + 1 摘要覆盖层 + 1 周期摘要缓存 + 1 AI 报告快照）

| 表                    | 关键字段                                                                                                                            | 说明                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `profiles`           | module_config, expert_style, custom_expert_tags, role, invite_code_id, **health_profile**                                       | 用户配置（health_profile JSONB 存健康画像：height_cm/birth_date/gender/activity_level/calorie_goal/target_weight_kg） |
| `diaries`            | content, chat_history, module_summaries, module_labels_snapshot, diary_date, created_at                                         | 日记主体（created_at DB 触发器保护）                                                                                 |
| `reports`            | theme, content, is_public, expert_style                                                                                         | AI 报告                                                                                                     |
| `user_memories`      | mental_baseline, recurring_patterns, active_events                                                                              | 动态记忆档案                                                                                                    |
| `prompt_configs`     | type, version_number, name, content, is_active                                                                                  | 提示词版本管理                                                                                                   |
| `invite_codes`       | code, used_by, used_at, deleted_at, is_deleted                                                                                  | 内测码                                                                                                       |
| `deletion_logs`      | user_id, status, error_message                                                                                                  | 注销审计日志                                                                                                    |
| `notes`              | user_id, content, source_type, source_diary_id, source_diary_date, deleted_at, is_deleted                                       | 珍藏碎片（**物理删除** + RLS `user_id=auth.uid()`；`deleted_at`/`is_deleted` 列已废弃不再写入）                              |
| `practices`          | user_id, title, source_type, source_diary_id, source_diary_date, status(active/completed), completed_at, deleted_at, is_deleted | 心灵练习（软删 + 状态机）                                                                                            |
| `practice_logs`      | user_id, practice_id, practiced_at, deleted_at, is_deleted                                                                      | 打卡日志（UNIQUE(user_id, practice_id, practiced_at)，软删后可复活）                                                   |
| `foods`              | user_id(NULL=system), name, source(system/user), category, 宏量5(NOT NULL)+微量15(可NULL), default_serving_g/name                    | 食物库（system 全局可见 + user 仅本人可见；system 食物不可改删；pg_trgm 模糊搜索 + 部分唯一索引）                                         |
| `recipes`            | user_id, name, description, servings, instructions, *\_per_serving 营养缓存                                                         | 菜谱（由 recipe_ingredients 汇总后写入每份营养缓存）                                                                      |
| `recipe_ingredients` | recipe_id, food_id, user_id, quantity_g, note                                                                                   | 菜谱食材明细（ON DELETE RESTRICT food，ON DELETE CASCADE recipe）                                                  |
| `diet_logs`          | user_id, log_date, meal_type(breakfast/lunch/dinner/snack), food_id XOR recipe_id, servings, quantity_g, 冻结营养5项, note           | 每日饮食记录（创建时冻结营养快照，防后续食物/菜谱修改影响历史）                                                                          |
| `body_metrics`       | user_id, log_date, weight_kg, waist/hip/chest/arm/thigh_cm, body_fat_pct, note                                                  | 身体数据（**UNIQUE(user_id, log_date)** 一天一条 upsert；物理 DELETE）                                                 |
| `summary_overrides`  | user_id, scope(day/week/month), period_key, module_id, content, updated_at                                                      | 用户手动编辑的摘要覆盖层（**UNIQUE(user_id, scope, period_key, module_id)**；优先级高于 AI 摘要；`user_id` 外键 CASCADE，注销自动清理，无需改 RPC） |
| `period_summaries`   | user_id, scope(week/month), period_key, module_id, content, source_fingerprint, generated_at, updated_at                          | AI 生成的周/月摘要缓存（**UNIQUE(user_id, scope, period_key, module_id)**；`source_fingerprint` = 周期内日记内容哈希，指纹不符才重算；与覆盖层分离，AI 永不覆盖用户编辑） |
| `ai_analysis_reports` | user_id, scope(day/period), period_key, report, payload, generated_at, updated_at                                               | AI 分析报告快照（**UNIQUE(user_id, scope, period_key)** upsert；`report`=AI 文案、`payload`=analyzeDay/analyzePeriod 确定性结果供图表回放；RLS 4 条只按归属，SELECT 策略不写任何过滤条件；迁移 `20261022_ai_analysis_reports.sql` 已线上执行） |


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
24. **灵感系统 · 软删级联（原子性 RPC）**：删 practice 通过 `soft_delete_practice` SECURITY DEFINER RPC 在单个 Postgres 事务内级联软删 `practice_logs` + `practices`，浏览器端两步 UPDATE 已废弃（网络中断会产生脏数据）；RPC 校验 `auth.uid()` 归属，service_role 跳过校验（信任服务端调用方已自行鉴权）。**store 端**：`removePractice` / `removeNote` 通过 `fetch DELETE /api/practices/:id` / `fetch DELETE /api/notes/:id` 走 API 路由（server-side auth）。`removeNote` 使用非乐观模式 — 等 API 返回 OK 后再从 store 过滤，消除闪现 race condition；`removePractice` 保持乐观删除（因 `soft_delete_practice` RPC 更稳定，极少失败）。**notes 删除方式**：notes **不走软删**，删除即 **物理 DELETE**（`deleteNote`，`src/lib/note-service.ts`）—— 曾用软删（UPDATE `is_deleted=true`），但 RLS UPDATE 的 USING 与 RETURNING 的 SELECT 策略（`is_deleted=false`）反复冲突导致"删成功却报失败"，最终放弃软删。`fetchNotes` 仍带 `.eq("is_deleted", false)` 作为无害兜底（物理删除后无 `is_deleted=true` 行）。
25. **灵感系统 · 打卡幂等**：`toggleCheckin` 命中已软删记录时必须复活（UPDATE is_deleted=false, deleted_at=null）而非 INSERT，以绕开 `UNIQUE(user_id, practice_id, practiced_at)` 约束；uncheckin = 软删对应日期的 log。
26. **灵感系统 · 连续天数算法**：`consecutive_days` 在 JS 端向前遍历 — 若今日已打卡则从今日开始数；否则从昨日开始数；遇到首个无打卡日立即停止。`total_days` 用 COUNT(`is_deleted=false`)。"今日"基准统一使用 `todayShanghaiStr()`（`src/lib/date-utils.ts`，`Intl.DateTimeFormat` 显式 `Asia/Shanghai` 时区），禁止裸 `new Date()` 本地方法。
27. **灵感系统 · AI 文字收藏菜单（桌面划选 / 手机点按钮）**：`<LongPressText>` 只包 AI 消息（`msg.type === "ai"`），用户文字与日记原文均不包；空 text 不弹菜单。**双交互模型**（运行时 `matchMedia("(hover: none) and (pointer: coarse)")` 区分）：① **手机端**：AI 文字按 `\n{2,}`（空行）拆成多段，每段独立 `<p>` + 独立「收藏」按钮（Sparkles 图标），点按钮只存该段文字（`handleSaveTap(e, paraText)`）；按钮 `onClick` 必须 `stopPropagation`（防列表卡片 `article.onClick` 打开详情）；菜单 anchorX 用 `Math.max(16, Math.min(centerX, innerWidth - 120 - 16))` 水平 clamp 防右溢出。**传 `children` 时**（列表预览，需 line-clamp 作用于单块）走整段模式：渲染 children + 整段一个按钮；**不传 `children` 时**（详情抽屉 / WritingSteps 对话）走分段模式。调用点须去掉 children 才能分段：`<LongPressText text={msg.content} sourceDiaryId={...} />`（自闭合）。② **桌面端**：拖选文字 → `document.selectionchange`（300ms debounce）→ `isSelectionInside(containerRef)` 检测 → `hasSelection=true` 弹全部三项；右键无选区走 `contextmenu` → `hasSelection=false` 只显示「复制」。**关键**：手机端 `selectionchange` effect 在 `isTouch` 时整体跳过（不再 hook 选区变化），避免与 iOS 原生拷贝条双菜单；`handleClose` 在 `isTouch` 时不清空选区。**CSS**：wrapper 恒设 `WebkitUserSelect:"text", userSelect:"text", WebkitTouchCallout:"none"` — 前两者让用户随时可原生划选复制，最后一项抑制长按 callout 弹条。**禁止**把 wrapper `WebkitUserSelect` 设为 `"none"`（iOS 无法选字）。
28. **灵感系统 · 跳转日记浏览（非编辑）**：珍藏碎片 / 心灵练习卡片的「原文」按钮统一用 `<Link href={'/diary?id=' + sourceDiaryId}>` → 进入 `/diary` 浏览页（只读，渲染 `DiaryDetail`，`isLatest={false}` 不显示编辑/重新解读）；**禁止**跳 `/write?id=`（那是编辑页）。手动添加的笔记/练习 `sourceDiaryId` 缺省 → 按钮置灰 disabled。`/diary` 路由需登录 + 内测码（middleware 非 public path）。
29. **灵感系统 · source_diary_date 冗余**：创建 note/practice 时若带 `source_diary_id`，server 端必须查 diaries 表校验 `user_id` 归属 + 读 `diary_date` 写入 `source_diary_date`（避免列表再 JOIN）。
30. **灵感系统 · 5 Tab 常驻 DOM**：第 5 个 TabsContent「灵感」同样 `forceMount + data-[state=inactive]:hidden`；子 Tabs（珍藏碎片 / 心灵练习 + 打卡 / 打卡查看）同样常驻；`InspirationContainer` 用 `next/dynamic + ssr: false` 独立 chunk。
31. **灵感系统 · LongPressMenu store 同步**：长按菜单「存为笔记 / 加入打卡」POST 成功后，必须 `useInspirationStore.setState()` 将返回的 note/practice 前插到数组头部 + 置 `notesFetchedAt`/`practicesFetchedAt = Date.now()`（标记已加载，列表立即显示新项）。**禁止设为 null**：null 触发骨架屏，而 `InspirationContainer` 是 forceMount 永不卸载，`ensureNotes` 的 useEffect 只在 mount 时跑一次，null 后永远不再触发，导致灵感 Tab 永久 skeleton 白屏。**在途 fetch 竞争**：`page.tsx` `init()` 中调用 `inspirationPrefetchAll` 同时发起 `ensureNotes` fetch；若用户在 fetch 完成前就通过 LongPressMenu 存了新笔记，fetch 结果（不含新笔记）会覆盖 store。解法：`ensureNotes`/`ensurePractices` fetch 完成后用 `currentNotes.filter(n => !fetchedIds.has(n.id))` 合并乐观新增项（已在 store 实现）。
32. **每日好饭 · 模块隔离**：`page.tsx` 顶部 `activeModule: ModuleKey("diary"|"food")` state，默认 `"diary"`。日记 Tabs 包在 `{activeModule === "diary" && (...)}` 条件内；FoodHealthContainer 在 `{activeModule === "food" && (...)}`。FAB 仅 `activeModule === "diary" && activeTab === "write"` 时显示。`handleLogout` 追加 `useFoodStore.getState().reset()`。切换模块零请求（FoodHealthContainer mount 时 prefetchAll；diary Tabs forceMount 永不卸载）。**硬约束**：绝不修改日记模块的任何表/service/store/API，新模块完全独立。
33. **每日好饭 · 营养素冻结快照**：`diet_logs` 创建时由 `calcFrozenNutrition` 算出 5 项宏量营养冻结写入（food: `food.nutrient × quantity_g / 100`；recipe: `recipe.xxx_per_serving × servings`）。更新份数/重量时重算冻结。**禁止**查询 diet_logs 时 JOIN foods/recipes 现值 — 历史记录用冻结值，不受后续食物/菜谱修改影响。
34. **每日好饭 · 菜谱营养计算**：`calculateRecipeNutrition(ingredients, servings)` = `Σ(food.nutrient × quantity_g / 100) / servings`。宏量 food 一定有值（NOT NULL）直接求和；微量任一食材为 null 则整体 null（不按 0 计算）。创建/更新菜谱后自动算营养缓存写回 `recipes.*_per_serving` 字段。
35. **每日好饭 · DRI 个性化**：`getPersonalizedDRI(profile, weightKg)` 先从 `DRI_TABLE[gender][ageGroup]` 取基准，再按体重修正蛋白质（男 0.84g/kg、女 0.80g/kg），有身高时用 Mifflin-St Jeor BMR × 活动系数修正能量。`profile.calorie_goal` 优先于 TDEE。无性别/出生日期时返回 null（概览页显示"完善画像"引导）。营养素达成率 = 实际摄入 / DRI × 100；评级：钠反向(>120% 过量)，其他 ≥80% 充足 / 50-80% 临界 / <50% 不足。
36. **每日好饭 · 食物库 RLS**：foods SELECT 策略 `source='system' OR user_id=auth.uid()`（**不带 `is_deleted` 条件**，原因见第 52 条）— system 食物全局可见，user 食物仅本人可见；已删行由查询层 `.eq("is_deleted", false)` 过滤。INSERT/UPDATE/DELETE 只 `user_id=auth.uid()` — system 食物不可改删（API 层 + service 层双重校验 source）。部分唯一索引：system 按 name 全局唯一，user 按 (user_id, name) 唯一（软删后可重建）。
37. **每日好饭 · 身体数据 upsert**：`body_metrics` 有 `UNIQUE(user_id, log_date)` 约束，同天第二次保存靠 `upsert(onConflict: "user_id,log_date")` 覆盖。`deleteBodyMetric` 是物理 DELETE（不走软删）。store 端 `saveBodyMetric` 成功后替换同日期记录并按日期倒序排列。
38. **每日好饭 · Zustand 空数组陷阱**：`useFoodStore((s) => s.dietLogsByDate[date] ?? [])` 会**每次渲染创建新 `[]` 引用** → Zustand `Object.is` 比较 → 无限重渲染（Maximum update depth exceeded）。**解法**：模块级常量 `const EMPTY_DIET_LOGS: DietLogWithNames[] = []`，selector 返回 `s.dietLogsByDate[date] ?? EMPTY_DIET_LOGS`，空值永远同一引用。所有 `Record<key, T[]>` selector 均须用稳定空常量。
39. **每日好饭 · 食物搜索防抖**：`FoodSearchSheet` 300ms 防抖 + 5min 缓存（`foodSearchCache: Record<query, {results, fetchedAt}>`）。store `searchFoods` 先查缓存命中直接返回，否则 fetch API 并写缓存。搜索查 system + user 食物（`or` 过滤），按 source 排序（system 优先）。
40. **每日好饭 · AI 营养解读分工**：JS 端 `analyzePeriod`（周期）/ `analyzeDay`（单日）算出各营养素达成率/评级/趋势后，把结构化结论交给 DeepSeek 做自然语言解读。System prompt 指令："数据中的评级和达成率已由系统计算完成，你只需解读数据并给出可操作建议，不要重新计算数值。"两入口共享 `src/lib/health-prompts.ts` 的干燥症抗炎专家 prompt：①【分析】Tab 周期解读（`api/health-analysis`，趋势图表不变仅 AI 文本换 prompt）；②【饮食】Tab 今日分析（`api/diet-analysis`，出 4 看板+8 营养素达成表+复盘+行动指南，`DailyAnalysisCard` 内联 markdown 展开）。markdown 渲染用 `react-markdown` + `remark-gfm`（支持 GFM 表格），样式类 `.prose-food-analysis`（globals.css，深色背景适配）。
41. **每日好饭 · 干燥症 8 大营养素与 Omega-3 处理**：`analyzeDay` 算 8 大靶向微量（维A/维D/硒/纤维/钾/B12/铁 + Omega-3）。前 7 项 foods 表有字段，实时 JOIN 按 `food.nutrient × quantity_g/100` 累加；**Omega-3 foods 表无字段**（零 DB 改动），`intake=null` 交 AI 根据食材清单推算并标注（参考 DRI `OMEGA3_DRI_G=1.6g`）。recipe 类型无食材明细时微量置 null 标记"含菜谱记录"。`diet_logs` 只冻结 5 宏量，微量靠分析时 JOIN foods 现值（与冻结快照原则不冲突——微量未冻结）。
42. **Supabase 免费计划会被自动暂停**：连续 7 天无数据库活动 → 项目暂停，域名变 **NXDOMAIN**，现象是「站点页面能打开、但登录报 `Failed to fetch`」（页面是 Vercel 预渲染，不依赖后端）。**恢复**：Supabase Dashboard → Resume project（数据完好，保留期约 1 年）。**保活**：`vercel.json` 的 crons 每日打 `/api/cron/keepalive`。**诊断**：`dig <ref>.supabase.co`（NXDOMAIN = 已暂停或已删除）。
43. **`*.supabase.co` 在中国大陆被 SNI 定向阻断**：TCP 可连，TLS ClientHello 阶段即被 RST（curl 报 `Connection reset by peer`）。**国内/本机链路必须走代理**（Clash `127.0.0.1:7897`）才能访问 Supabase Auth/REST；Vercel 与 GitHub runner 在境外可直连。凡本地验证登录、跑直连 Supabase 的脚本，均须先开代理。
44. **Service Worker 不缓存 HTML**：`public/sw.js` 的 navigate 分支**直接走网络**（`CACHE_VERSION = midnight-static-v3`，activate 时清理旧 `midnight-page-*`）。登录态应用缓存 HTML 会让 iOS Safari 长期停在旧页面 + 旧 chunk（表现为「显示老版本、像新账号」）。**历史教训**：曾缓存 HTML 且未校验 `response.ok`，Cloudflare 504 错误页被固化成首页（commit `9f233a6`）——若将来又要缓存 HTML，必须先加 `response.ok` 守卫。
45. **middleware 必须放行 public/ 静态资源**：`src/middleware.ts` 的 matcher 只排除 `_next/static`、`favicon.ico`、图片后缀时，`/sw.js`、`/manifest.json`、`/bgm.mp3` 会被 307 重定向到 `/login` → 未登录时 SW 无法注册/更新、PWA 清单失效。另注：`src/lib/supabase/middleware.ts` 的 `publicPaths` 前缀白名单（`/login`、`/api`、…）是第二道放行，故 `/api/*` 路由天然免鉴权，新增 cron/健康端点无需改鉴权配置。
46. **网络拓扑（2026-10-19 定型，勿回退）**：Cloudflare 里 `diary` 记录是**灰云（仅 DNS）**，CNAME → `dd9abff986a5e9e4.vercel-dns-017.com`，落 Vercel **sin1 新加坡**（首页 0.31~0.63s）。**不要点回橙云**：免费版 anycast 无法选 POP，用户家宽会把 `104.21.x` 路由到 **LAX**，首字节 3.5~6.5s。Vercel 侧证书已签发（Let's Encrypt，`CN=diary.yongteam.com`），灰云切换不影响 HTTPS；回滚成本 = 点回橙云。
47. **浏览器端禁止直连 `*.supabase.co`**：一律走同域 `/api/supabase/*`，由 `src/app/api/supabase/[...path]/route.ts` 透明转发（剥逐跳头与 `Set-Cookie` 的 `Domain`，20s 超时，强制 `no-store`）。地址、anon key、会话键名统一从 `src/lib/supabase/config.ts` 取，别处不要再用 `NEXT_PUBLIC_SUPABASE_URL` 拼浏览器端 URL。服务端（`server.ts`/`middleware.ts`/`admin.ts`）仍直连真实地址 —— 机器在境外，直连更快。
48. **会话键名两端必须一致**：`@supabase/ssr` 默认按 URL 主机名推导 `sb-<host>-auth-token`；浏览器改用代理地址后会推成 `sb-diary-auth-token`，与 middleware 读的 `sb-wbyxcyefhtpcwcykeegk-auth-token` 不一致 → 反复踢回登录页、像「登不上」。browser / server / middleware 三处都必须显式传 `cookieOptions: { name: SUPABASE_STORAGE_KEY }`。
49. **邮件链接一律走 `/auth/confirm`**：`src/app/auth/confirm/route.ts` 接 `token_hash` + `type`，服务端 `verifyOtp()` 换会话后跳转。模板写成 `https://diary.yongteam.com/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`（注册用 `type=signup`，页码自动回 `/login?verified=1`）。Supabase 默认的 `{{ .ConfirmationURL }}` 指向 `*.supabase.co/auth/v1/verify`，国内打不开。**`/auth` 必须在 middleware `publicPaths` 内** —— 点链接进来时还没有会话，被 `updateSession` 拦下会直接跳登录页、token 白作废（最容易漏的一步）。
50. **Supabase 后台配置只能走 Management API**：`PATCH https://api.supabase.com/v1/projects/<ref>/config/auth`（`service_role` key 无权）。细分令牌只给 `Auth Config = Read-write` 会返回 403 `Missing required permission(s): project_admin_write`，必须同时给 **Project → Project Settings = Read-write**；令牌权限创建后不可修改，只能撤销重建（建议 Expires 7 天）。Site URL 现为生产域名，但邮件模板仍**硬编码**域名，不要依赖 `{{ .SiteURL }}` 兜底。
51. **网络错误不得静默降级**：数据层失败时不要 `return []`（会被渲染成「空账号 / 像新号」），页面需用 `loadError` 状态区分「真空账号」与「拉取失败」；错误文案统一过 `toFriendlyError()`（`src/lib/supabase/errors.ts`）。Safari 报 `Load failed`、Chrome 报 `Failed to fetch`，都不是密码错误，禁止提示用户检查密码。
52. **软删表的 SELECT 策略里禁止写 `is_deleted = false`**（2026-10-19，踩了 4 轮）：PostgreSQL 启用 RLS 时，**UPDATE 产生的新行必须同时满足 SELECT 策略**。软删是把 `is_deleted` 改成 `true`，若 SELECT 策略含 `is_deleted = false`，新行必然违反 → `42501 new row violates row-level security policy` → API 500 → 前端乐观删除回滚 → 表现为「删了短暂消失又出现、刷新后还在」。这不是策略写错，是 PG 机制；用一张同结构新表可稳定复现，与触发器/RULE/FOR ALL 策略无关（`pg_trigger`、`pg_rewrite` 均为空也照样拦）。
    - 正确做法：SELECT 策略只按归属过滤（`user_id = auth.uid()`），`is_deleted = false` 由**查询层**加（本仓库 31 处读取已全部显式过滤）。这样软删与「恢复」（`is_deleted` 改回 false）都能用，且不影响租户隔离。
    - 受影响表：`recipes` / `recipe_ingredients` / `diet_logs` / `foods`。修复脚本 `supabase/migrations/20261019_fix_food_rls_update.sql`（v3，已在线上执行）。
    - **代码侧同步加固（commit `2c159ef`）**：`softDeleteRecipe` / `softDeleteDietLog` / `softDeleteFood` 的 UPDATE 一律追加 `.select("id")` 并校验返回行数。被 RLS 拦住时 PostgREST **不报 error、只返回 0 行**，原实现只看 `error` → API 返回成功、store 不触发回滚 → 用户看到的就是「删了又回来」。现在 0 行即 `return false`，由 store 回滚乐观删除并提示失败。**新写软删一律照此写法**。
    - **验收（2026-10-20 用户真机确认）**：菜谱 / 饮食记录点删除 → 立刻消失 → 刷新、切 Tab 均不复现；库中行 `is_deleted=true` 留档（软删，非物理删除）。
    - 排查手法：不要只 dump `pg_policies` 猜；用 `begin; set local role authenticated; set_config('request.jwt.claims',...)` 在库里跑真实 UPDATE，再逐个变量做对照实验（改普通字段 ✅ / 改 `is_deleted` ❌ 即为本症）。
    - 同类残留：`notes`、`body_metrics` 的 SELECT 策略仍带 `is_deleted = false`，目前代码未做软删所以没暴露；将来给它们加软删功能前必须先改策略。
    - **管理 API 批量删除数据时不要用 `like.__%`**：PostgREST 的 `_` 是通配符，会命中全表。（本轮就因此误删了 `茄子鸡蛋`、`三文鱼` 两条菜谱。）删除脚本一律按 id 精确过滤。

53. **AI 热量评估必须对照个人热量目标，禁止泛化人群对比**（2026-10-20）：【饮食】Tab「今日饮食分析」曾出现「热量赤字（1275 kcal 对多数成人属偏低）」——根因是 `diet-analysis` API 给 DeepSeek 的摘要只给热量绝对值、没传健康画像的「每日热量目标」，AI 只能拿泛化成人标准对比。修复（commit `1b94e2c`）：
    - `diet-analysis/route.ts` 用 `calculateEnergyNeeds(profile, target_weight_kg ?? 65)` 算目标（`calorie_goal` 优先 → BMR×活动水平推算 → 默认 2000），摘要新增「个人热量目标」段落（目标值 + 来源标注 + 今日达成率/缺口），系统约束第 4 条禁止「对多数成人」类对比。
    - `health-prompts.ts`（今日分析 + 周期分析共用）：「能量与控糖状态」输出规范改为必须对照「每日热量目标」并标注差距；无目标时才可用通用参考且须明确标注。注意周期分析 `health-analysis` 本来就传了 `calorie_trend[0].target`，只有单日接口曾漏传。
    - 口径与 `analyzeDay` 一致：体重用 `target_weight_kg ?? 65` 估算，仅影响 TDEE 推算，不影响用户设定值。

54. **摘要可编辑（覆盖层）—— 日/周/月三级**（2026-10-20，P1 已实现日摘要）：AI 摘要不一定准，用户要能改。
    - **存储**：`summary_overrides`（scope + period_key + module_id + content）。AI 原文仍留在 `diaries.module_summaries`，**覆盖层独立存储**；读取规则统一为 `显示 = override ?? AI 摘要`。覆盖层为空 = 没编辑，因此历史数据零迁移。
    - **period_key 约定**：day = `diary_date`；week = 该周周一日期；month = `YYYY-MM`。
    - **铁律（产品决策）**：① AI 重新生成只更新自己的值，**永不改写 override**；② 用户编辑过的周/月摘要永不被自动刷新覆盖；③ 编辑长度上限按粒度区分：日 **20 字**（沿用 AI 摘要 5–20 字规则）、周 **40 字**、月 **60 字**（`OVERRIDE_MAX_LEN_BY_SCOPE` / `overrideMaxLen()`，`src/lib/summary-override-service.ts`）；④ 删除 override = 恢复 AI（弹窗里的「恢复」按钮）。
    - **触发关系**：日记正文变化 / AI 摘要重生成 → 触发周/月摘要重算；**用户编辑日摘要不触发重算**（否则改个措辞就烧一次 LLM），但周/月弹窗内展示的日摘要用编辑后的版本。
    - **改日期**：摘要跟着日记走。`PATCH /api/diaries/[id]` 改 `diary_date` 时会调 `moveDayOverrides()` 把旧日期的覆盖迁到新日期（先清目标日期防唯一冲突；失败只记日志，不回滚日记更新）。
    - **文件**：`supabase/migrations/20261020_summary_overrides.sql`（⚠️ 需在 SQL Editor 手动执行）、`src/lib/summary-override-service.ts`、`src/store/summary-override-store.ts`（独立 store，不碰 diary-store）、`src/app/api/summary-overrides/route.ts`（GET/PUT/DELETE，PUT 传空 content = 删除）、`src/components/report/DiaryPreviewCard.tsx`（摘要行 + 编辑 + 恢复）、`ReportTable.tsx`（单元格优先显示覆盖值）。
    - **顺带修的 bug**：`ReportTable` 的日/周/月分组原先用 `new Date(created_at)`，但 `created_at` 受 DB 触发器保护、改日期后不同步 → 改过日期的日记在概览里还挂在旧位置。现统一改用 `getDiaryEffectiveDate()`（按 `diary_date` 分组）。
    - **P2（2026-10-20 已实现周模式）**：周/月 AI 摘要存 `period_summaries`，与覆盖层分工（AI 值 / 用户值分离）。生成逻辑 `src/lib/period-summary-server.ts` → `ensurePeriodSummaries()`：
      - 指纹 `source_fingerprint` = sha256(id + diary_date + content + module_summaries 排序后)，**内容/摘要/日期任一变化即失效重算**；指纹一致直接读缓存，不调 LLM
      - 一次 LLM 调用生成该周期所有模块（DeepSeek `response_format: json_object`），失败或漏模块 → 清掉旧指纹行，下次重试
      - 月摘要素材优先用该月**已有周摘要**（承接周摘要提炼），无周摘要回落日摘要
    - **生成时机**：① 打开周/月弹窗时按指纹检查（懒生成）；② 日摘要生成成功后 `/api/summary` 用 `after()` **后台刷新**该日所属周摘要（不阻塞响应，失败只记日志）；③ 弹窗右上角刷新按钮 = `force: true` 强制重算。
    - **P2 文件**：`supabase/migrations/20261020_period_summaries.sql`（⚠️ 需在 SQL Editor 手动执行）、`src/lib/period-summary-server.ts`（生成/缓存/指纹）、`src/lib/period-summary-service.ts`（周期 key/区间纯函数，客户端可用）、`src/lib/module-text.ts`（正文/AI 摘要取值统一封装）、`src/app/api/period-summary/route.ts`（POST）、`src/components/report/PeriodPreviewCard.tsx`（周/月弹窗：周=每模块日摘要列表 + 周摘要可编辑；月=每模块各周摘要可下钻 + 日摘要折叠 + 月摘要可编辑）、`ReportTable.tsx`（周/月格子显示周期摘要、点击开该周期弹窗；`CellData.periodKey` 携带周期 key；月格可下钻周并返回）。
    - **P3（2026-10-20 已实现月模式分层）**：
      - 月弹窗按「月 → 该月各周摘要」分层：每模块先列 `第N周` 的周摘要（用户编辑金色 / AI 灰色 / 未生成显示 `N 天 · 待生成`），点某周**下钻**到该周弹窗（`onDrillWeek`），周弹窗左上角可返回本月；日摘要默认折叠，点「每日摘要（N 篇）」展开。周弹窗仍按日列出。
      - 月摘要素材改为 `fetchMonthWeekMaterial()`：按该月涉及的自然周逐周取「用户编辑的周摘要 > AI 周摘要」，某周没有周摘要时回落该周的日摘要行（旧实现只要有一个周摘要就整月只用周摘要，会丢掉没有周摘要的周）。
      - **月摘要指纹含周摘要快照**（`computeFingerprint(diaries, weekFp)`）：周摘要新增/改写后，月摘要下次打开自动重算，实现「月承接周」的逐级精化。不传 `extra` 时指纹算法与旧版完全一致，**周摘要历史指纹继续命中，不会成批重算**。
      - 概览月格同步改为显示**月摘要**（`PeriodCellContent scope="month"`），未生成显示 `N 篇 · 待生成`。

55. **概览表格：三层递归展开，格子粒度 = 模式名**（2026-10-20 重构，勿再退回旧结构）
    - **日模式**：行 = 周一~周日（**固定 7 行**），列 = 自然周 `2026(1013–1019)`，格 = **一天**。固定行位让纵向同一行永远是同一个星期，所以「我每周三怎样」要在日模式看，不要塞进周模式。
    - **周模式**：行 = 月内第 1~N 周，列 = `2026年10月`，格 = **一整周**，格内显示 AI 周摘要（用户编辑过的优先），**不按天拆**。
    - **月模式**：行 = 1~12 月，列 = 年，格 = 一个月，格内显示 AI **月摘要**（用户编辑过的优先），不按天拆；点开月弹窗按「各周摘要」分层，可逐周下钻。
    - **周归属按「周一的月份」**：自然周不可劈开，这样 1 格 = 1 个 `periodKey` = 1 份周摘要，与 `period_summaries` / `summary_overrides` 的 key 完全对齐。用「月内 1-7/8-14 切割」会把自然周劈成两半，周摘要立刻对不上。
    - **点击语义**：看到什么就打开什么 —— 日格 → `DiaryPreviewCard`，周格/月格 → `PeriodPreviewCard`（原先周格点一下取整列打开整周，视觉与行为错位，已废）。
    - **表格只读缓存，渲染不触发 AI**：整 scope 一次性拉 `period_summaries`（`src/lib/period-summary-client.ts` + `src/store/period-summary-store.ts`）；未生成过的周显示 `N 篇 · 待生成`，点开弹窗才生成，生成完 `setSummaries()` 回写，格子即时刷新。
    - **废弃结构**：旧周模式是「行 = 星期一~日、列 = 周」，格实际是「某周某一天」，粒度退化成日——不要再改回去。

56. **每日好饭 · 概览四宫格统一布局（2026-10-23，32704d6）**：【饮食】单日与【分析】周期共用 `NutrientOverviewGrid`：2×2 = 左上热量环（剩余/超出 kcal、目标/摄入、蛋白/碳水/脂肪**克数三行**超标变红）+ 右上宏量雷达（金）+ 左下矿物质雷达（绿）+ 右下维生素雷达（蓝，`NutrientRadarChart` size=md）。原来的三个宏量百分比小环已删（与宏量雷达重复，克数信息降级为文字行）。**「今日饮食分析」展开区不放雷达**（四宫格已常驻，同一天出现两遍属重复），只放 AI 报告。
57. **营养素雷达必须纯 SVG，勿改回 recharts**（2026-10-22，2ebc69f）：recharts `PolarAngleAxis` 自定义 tick 的 payload 形态不稳定（有时 `{value, payload}`、有时是展开的数据项），轴旁「名称+达成率」标签连续两轮修不好；热量轴刻度也出现乱标。最终 `NutrientRadarChart` 手写 SVG：极坐标换算（0 号轴朝上）、MAXV=120 顶格绘制但标签显真实值、100% 白虚线基准多边形、标签按 cos 三档 anchor。改雷达一律在这份纯 SVG 上改。
58. **AI 报告快照（`ai_analysis_reports`）**：分析报告是**按 key 封存的快照**，不是实时计算——`scope` day/period，`period_key` 单日 = 日期、周期 = `start_dataEnd`（含数据截止日，跨天自动失效）。两个入口：`GET` 只读缓存（`/api/diet-analysis` 未命中还会现算 analyzeDay 回 analysis 给雷达，不调 LLM；`?fresh=1` 强制绕过快照现算）；`POST {force}` 生成/重新生成，成功即 upsert 封存。`isUsableReport()` 拦截 AI 占位文案不落库；空周期（无饮食记录）POST 直接 400 不封存（防止 AI 对空数据编报告被永久缓存）。前端：会话内另有内存缓存（`day-analysis-client.ts` / `HealthAnalysis` 的 rangeCache）做到来回切零请求。⚠️ `computeDayAnalysis`/`computePeriodAnalysis` 返回**包装对象**（`{analysis, profile}` 等），GET 处必须显式解构再放响应——曾因整包返回导致【饮食】雷达全「暂无数据」（fea984d）。
59. **分析数据截止规则（未来是空不是 0）**（2026-10-23）：【分析】的结束日自动裁到 `resolveDataEnd()` = min(endDate, 今天) 范围内**最后一条有饮食记录的日期**——未来和还没记录的天不进趋势坐标、不参与日均（日均 = 总量/已发生天数，不是 /7）；选整个自然周时图表止于最近有记录的那天。快照 key 带上 dataEnd，新增一天的记录后旧快照自然失效重算。【饮食】单日雷达数据来自服务端 analyzeDay（纯 JS 不烧 LLM），添加/删除食物后走 `?fresh=1` 自动刷新；DRI 参考体重兜底链 = 周期内体重 → 全局最近一条 `fetchRecentBodyMetrics(1)` → 画像 `target_weight_kg`（9771c17，缺身体记录不再导致目标全 0）。


**网络排障速查**

```bash
# 是否还经过 Cloudflare 代理（正常应无 cf-ray，且 server: Vercel）
curl -sI https://diary.yongteam.com/ | grep -iE "cf-ray|^server"
# 落点：看 x-vercel-id 前缀，sin1 = 新加坡
curl -sI https://diary.yongteam.com/ | grep -i x-vercel-id
# 后端健康：200 = 正常，503 = Supabase 异常
curl -s https://diary.yongteam.com/api/cron/keepalive
# 域名是否被暂停（NXDOMAIN = 项目已暂停/删除）
dig +short wbyxcyefhtpcwcykeegk.supabase.co
```

## 开发规范

- 修改前声明涉及文件列表。
- 组件必须定义 TypeScript props interface。
- 修改后说明影响范围，引导验证。
- 禁止擅自调整视觉样式。
- **Push 命令**：`~/.gitconfig` 对 github.com 设了专用代理（`http.https://github.com.proxy=http://127.0.0.1:7897`），代理软件未开时直接 push 会失败。临时绕过代理 push（不开代理软件）：
  ```bash
  git -c http.https://github.com.proxy= -c https.https://github.com.proxy= push origin main
  ```
- **GitHub PAT 需含 `workflow` scope**：否则推送 `.github/workflows/**` 会被拒（`refusing to allow a Personal Access Token to create or update workflow`）。classic token 在 Settings → Developer settings → Personal access tokens 里编辑 scope；**改 scope 不改变 token 值，keychain 无需重配**。
- 上条的代理仅影响 git：GitHub 网页/API **直连可用**，关代理只影响 push/pull。

## Push 前必检（按模块）

**核心数据**

- [ ] 模块字母前缀、名称回溯、停用维度数据保留
- [ ] 语音录音、倒计时、光标插入、多次追加正常
- [ ] 分次保存不覆盖、module_labels_snapshot 写入
- [ ] 编辑页自动保存：输入→~1s 后"已自动保存"→刷新→内容已更新
- [ ] 编辑页切后台/关标签→重新进入→内容已保存（visibilitychange + beforeunload keepalive）
- [ ] 编辑页"取消"按钮→触发 flush→不丢变更；断网→"保存失败"提示→恢复→自动补存
- [ ] 新增页行为无回归：localStorage 草稿恢复 + "下一步"云端同步正常；chat_history 不被覆盖

**日记概览 · 摘要编辑（P1）**

- [ ] 点某日单元格 → 弹窗日期正确（改过日期的日记显示**新日期**）→ 每个有内容的模块下方都有摘要行
- [ ] 摘要行默认显示 AI 摘要，标注"· AI 生成"；无摘要时提示可手写
- [ ] 编辑 → 改字 → 保存 → 行内立即变新文案并标"· 已编辑"；刷新后仍是编辑版
- [ ] 概览表格单元格同步显示编辑后的摘要（不是 AI 原文）
- [ ] 点「恢复」→ 回到 AI 摘要，表格也跟着回退
- [ ] 超 20 字无法继续输入（maxLength + 服务端 400 双保险）
- [ ] 断网保存 → 行内「保存失败，请重试」→ 恢复网络后重试成功
- [ ] 编辑摘要后把该日记改到别的日期 → 新日期显示编辑版摘要，旧日期消失

**日记概览 · 周/月摘要（P2）**

- [ ] 点周表任一格 → 弹窗显示「周一 - 周日」日期范围 + 该周日记篇数
- [ ] 每个模块下按 `MM-DD 摘要` 列出该周每天摘要；编辑过的日摘要显示编辑版
- [ ] 模块底部是「周摘要」，首次打开显示"正在提炼…"→ 生成后落库；**第二次打开秒开（指纹一致不重复调用 LLM）**
- [ ] 编辑周摘要 → 保存 → 标「· 已编辑」→ 刷新后仍在 → 点「恢复」回 AI 版
- [ ] 改某天日记正文并重新生成日摘要 → 再打开周弹窗 → 周摘要已刷新（指纹变化）
- [ ] 用户已编辑过周摘要后，即使周内日记变动 → 编辑版不被覆盖（只有 AI 值变）
- [ ] 月表格点单元格 → 月弹窗按「各周摘要」列出（第N周 / 用户编辑金色 / 未生成 `N 天 · 待生成`），点某周下钻到周弹窗，左上角「←」返回本月
- [ ] 月弹窗的「每日摘要（N 篇）」默认折叠，展开后按 `MM-DD` 列出
- [ ] 月格显示月摘要；未生成 → `N 篇 · 待生成`；生成后关闭弹窗格子即时出现摘要
- [ ] 月摘要承接周：写好某周摘要 → 重开该月 → 月摘要按新周摘要重算（指纹含周摘要快照），用户编辑过的月摘要不被覆盖

**日记概览 · 表格结构（2026-10-20 重构，见规则 55）**

- [ ] 日模式：行固定周一~周日、列 `2026(1013–1019)`，格 = 一天；纵向同一行永远是同一个星期
- [ ] 周模式：行 = 第1~N周、列 `2026年10月`，格 = 一整周；格内是该周 AI 摘要（用户编辑过的显示为金色）
- [ ] 周格从未生成过 → 显示 `N 篇 · 待生成`（打开表格不调 LLM）
- [ ] 点周格 → 打开该周弹窗并生成 → 关闭后格子里直接出现摘要（不用刷新页面）
- [ ] 点日格 → 只打开那一天，不是整周
- [ ] 跨月周归属：10 月第 1 周 = `09.28–10.04` 这种完整周，不出现「半周」
- [ ] 月格显示 AI 月摘要（用户编辑过的显示为金色），不是一堆日摘要堆叠

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
- [x] SQL migration `20260723_fix_cascade_delete.sql` 已在 Supabase SQL Editor 手动执行（`soft_delete_practice` 原子性 RPC + 授权）
- [x] SQL migration `20260727_fix_notes_rls.sql` 已在 Supabase SQL Editor 手动执行（notes RLS 策略拆分；现 notes 删除已改为物理 DELETE，此 migration 对删除流程已非必须）
- [ ] 顶部第 5 Tab「灵感」切 Tab 零请求（forceMount + hidden 生效）
- [ ] 笔记：手动添加 → 列表渲染 → 编辑覆盖原文 → 物理删除 → 来源标签正确 → 跳转日记浏览页 `/diary?id=`（只读，非编辑页；手动置灰）→ 空状态引导
- [ ] 练习：今日待完成↔今日已完成 AnimatePresence 实时移入移出 → 勾选失败回滚 → 完结进历史 → 删除软删 + 级联软删 practice_logs
- [ ] 打卡查看 Tab：点练习进入日历 → 当月已打卡日期绿色小圆点 → 切月加载 `fetchPracticeLogsByMonth`
- [ ] **手机端**：AI 段落下方出现「收藏」按钮 → 一点即出菜单（复制/存为笔记/加入打卡整段）→ 点按钮不触发列表卡片打开详情；滚动段落不误触；仍可长按原生划选复制（不弹自定义菜单）
- [ ] **桌面端**：拖选 AI 文字 → 300ms 后出菜单；右键无选区 → 只出「复制」
- [ ] 手机/桌面分别验证：列表卡片 AI 预览、详情抽屉 AI 文字、WritingSteps 对话 AI 文字 三处入口均可出菜单 → 存为笔记 → 切灵感 Tab 看到新项
- [ ] 复制写入剪贴板（iOS Safari + Android Chrome 真机验证；桌面 Chrome 验证）
- [ ] 累计天数 + 连续天数在勾选后即时刷新

**每日好饭模块（Phase 6 — SQL 已执行 + 种子已导入 + 验收通过）**

- [x] SQL migration `20260914_food_health_system.sql` 已在 Supabase SQL Editor 手动执行（5 表 + profiles.health_profile + RLS + 索引 + 升级 delete_user_account RPC）
- [x] 食物种子已导入（`npx tsx scripts/seed-foods.ts`，108 条，微量填充率 81%）
- [ ] 顶部模块切换「每日一记 / 每日好饭」切模块零请求；日记模块零回归
- [ ] 健康画像：填性别/出生日期/身高/活动水平 → 保存 → 概览页显示 DRI 进度条
- [ ] 食物库：搜索系统食物有结果；新建 user 食物只填宏量可保存；system 食物不可改删
- [ ] 菜谱：创建+加食材 → 每份营养自动算出；微量任一食材缺则整体 null
- [ ] 饮食记录：选菜谱/食物记到某天某餐 → 冻结营养正确；改份数重算；删某条
- [x] 删除不复现：菜谱 / 饮食记录 / 自定义食物点删除 → 立即消失 → 刷新、切 Tab 均不再出现（2026-10-20 验收通过）
- [ ] 身体数据：同天第二次保存 = 覆盖(upsert)；体重/围度趋势曲线渲染
- [ ] 分析报告：周/月热量趋势图 + 营养雷达图 + 体重曲线 + AI 文字建议；达成率三档评级正确
- [ ] 注销覆盖：新测试账号 → 录数据 → 注销 → SQL 查 5 张新表无该 user_id 残留

**每日好饭 · 界面重构与报告快照（2026-10-21 ~ 10-23，规则 56-59）**

- [ ] 【饮食】Tab 顺序为【菜谱、饮食、身体、分析】，无概览 Tab
- [ ] 【饮食】顶部四宫格：热量环（超标显示负数「超出」）+ 宏量克数三行 + 三张雷达有数据（有饮食记录的日期不再全「暂无数据」）
- [ ] 添加/删除食物后雷达自动刷新（?fresh=1 现算，不烧 LLM）
- [ ] 雷达轴旁有「名称 + 达成率」两行标签、100% 白虚线基准可见（纯 SVG）
- [ ] 【饮食/身体】日期为周一~周日周条，周日旁单日期日历可选
- [ ] 「今日饮食分析」展开只有 AI 报告，无雷达；生成过报告的日期切走再切回立即回放；有报告时出现「重新生成」
- [ ] 【分析】默认当前自然周；趋势图 + 四宫格切进 tab 自动出现（不点按钮）；「生成报告」按钮在四宫格下方，只管 AI 文字
- [ ] 【分析】换日期范围先出缓存秒开，无缓存自动算图表（不调 AI）；AI 报告需点按钮
- [ ] 范围结束日裁到最近有饮食记录的日期：未来/未记录天是空白不是 0；日均只按已发生天平均
- [ ] 周期内完全无饮食记录时点「生成报告」→ 提示「该周期暂无饮食记录」，不生成不封存
- [ ] 补剂录入：AI 估算「鱼油」「维生素 D」等近 0 能量食物不被校验拦截

**保活 & 可观测**

- [ ] `curl -s https://diary.yongteam.com/api/cron/keepalive` 返回 200 `{"ok":true,"supabase":"up",...}`；后端异常时返回 503
- [ ] Vercel 项目 Settings → Cron Jobs 能看到 `/api/cron/keepalive` 及下次运行时间
- [ ] UptimeRobot 监控 `https://diary.yongteam.com/api/cron/keepalive` 为 Up（间隔 30 分钟，已开失败告警）
- [ ] 注意：**Vercel Cron 失败不重试、不告警**（官方行为），兜底告警只能靠 UptimeRobot；若日后设置 `CRON_SECRET`，须同步给监控工具加 `Authorization: Bearer` 头，否则会被误判为故障

**构建**

- [ ] npx tsc --noEmit 零报错

后续开发中，如果你需要某条规则的具体实现细节（如 forceMount 配合 hidden 的写法、Zustand ensure 的生命周期、consume-invite-code 的原子锁逻辑），直接读取对应源码文件，而非依赖本文档的展开描述。
