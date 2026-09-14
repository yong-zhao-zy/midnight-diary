# Midnight Diary (深空回响) - 项目上下文

> ## 🚧 当前进度（2026-09-14 第六轮：新增【每日好饭】模块 — 饮食/菜谱/身体数据/营养分析）
> **定位升级**：从"日记应用"升级为"个人生活工作台"。顶部模块切换层（每日一记 / 每日好饭），两个模块平行、数据完全独立。日记模块所有表/service/store/API 未改动。
> **第六轮（已上线 push 484f994）**：新增【每日好饭】模块 — 5 张新表 + DRI 配置 + 108 种食材种子 + 6 个 service + food-store + 15 个 API 路由 + 5 子 Tab 页面 + recharts 图表 + DeepSeek AI 营养解读。SQL migration `20260914_food_health_system.sql` 已执行、食物种子已导入（108 条）。验收通过。
> **第五轮（已上线）**：手机端长按选字不流畅 → 放弃划选模型，改「点段落出菜单」。
> **已完成 SQL**：✅ `20260721` ✅ `20260723_fix_cascade_delete.sql` ✅ `20260727_fix_notes_rls.sql` ✅ `20260914_food_health_system.sql`（每日好饭 5 表 + profiles.health_profile + 升级 delete_user_account RPC 覆盖 5 新表）

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
> 1. **⚠️ 在 Supabase SQL Editor 执行 `20260727_fix_notes_rls.sql`** — 修复笔记删除 RLS。
> 2. **真机验收**：笔记删除 → 刷新后不复现；iOS 长按 AI 文字选区 → 可拖动句柄调整范围 → 菜单跟随新选区更新。
> 3. **端到端 E2E**：按本文「灵感系统」Push 前必检清单逐项打勾。
> 4. **注销流程覆盖新表**：新建测试账号 → 写日记 → 长按 AI 存笔记 + 加练习 + 打卡 → 注销 → SQL Editor 查 `notes` / `practices` / `practice_logs` 应无该 user_id 残留。

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
- `src/lib/food-service.ts` — 食物库 CRUD（searchFoods 搜 system+user / fetchUserFoods / getFoodById / createFood / updateFood / softDeleteFood；system 食物不可改删）
- `src/lib/recipe-service.ts` — 菜谱 CRUD + `calculateRecipeNutrition`（**核心计算**：`Σ(food.nutrient × qty/100)/servings`，微量任一食材为 null 则整体 null）
- `src/lib/diet-log-service.ts` — 饮食记录 CRUD + 创建/更新时**冻结营养素快照**（food 按 quantity_g/100 算，recipe 按 per_serving×servings 算，防后续食物/菜谱修改影响历史）
- `src/lib/body-metric-service.ts` — 身体数据 CRUD（upsert 靠 `UNIQUE(user_id, log_date)` 约束覆盖；物理 DELETE）
- `src/lib/health-profile-service.ts` — 健康画像读写（profiles.health_profile JSONB）
- `src/lib/nutrition-analysis.ts` — 纯 JS 营养分析（`analyzePeriod`/`calculateEnergyNeeds`/`rateNutrient`；钠反向 >120% 过量，其他正向 ≥80% 充足 / 50-80% 临界 / <50% 不足）
- `src/store/food-store.ts` — Zustand（dietLogsByDate / bodyMetrics / recipes / userFoods / foodSearchCache / healthProfile + 5min staleTime + in-flight 去重 + 乐观更新+回滚 + `reset()`）
- `src/app/api/foods/route.ts` + `[id]/route.ts` — 搜索/创建 + 改/删 user 食物
- `src/app/api/recipes/route.ts` + `[id]/route.ts` — 列表/创建(含食材+算营养) + 详情/更新/软删
- `src/app/api/diet-logs/route.ts` + `[id]/route.ts` — 查(?date= 或 ?start=&end=)/创建(冻结营养) + 改(重算)/软删
- `src/app/api/body-metrics/route.ts` + `[id]/route.ts` — 查/upsert + 删
- `src/app/api/health-profile/route.ts` — 读写健康画像
- `src/app/api/health-analysis/route.ts` — AI 分析（服务端算 analyzePeriod → DeepSeek 解读，AI 不重算只解读）
- `src/components/food/FoodHealthContainer.tsx` — 模块容器（5 子 Tab forceMount + prefetchAll；`next/dynamic + ssr:false` 独立 chunk）
- `src/components/food/overview/DailyOverview.tsx` — 日期选择 + 宏量进度条 vs DRI + 餐次分布
- `src/components/food/diet/DietLogPanel.tsx` / `DietLogItem.tsx` / `AddDietLogSheet.tsx` — 按餐次分组 + 选食物/菜谱+份数+实时预览营养
- `src/components/food/body/BodyMetricPanel.tsx` / `BodyMetricEditorSheet.tsx` — 身体数据列表 + 各指标 upsert
- `src/components/food/recipe/RecipePanel.tsx` / `RecipeEditorSheet.tsx` — 菜谱列表 + 食材明细管理+实时预览每份营养
- `src/components/food/common/FoodSearchSheet.tsx` — 食物搜索（300ms 防抖 + 5min 缓存）+ `HealthProfileSheet.tsx` — 健康画像设置
- `src/components/food/analysis/HealthAnalysis.tsx` — 时间范围+生成报告+图表+AI建议；`CalorieTrendChart.tsx`(LineChart) / `NutrientRadarChart.tsx`(RadarChart) / `BodyTrendChart.tsx`(LineChart)
- `src/app/page.tsx` — 顶部新增模块切换层（每日一记/每日好饭），日记 Tabs 包在 `activeModule==="diary"` 条件内；FAB 仅 diary 模块显示；`handleLogout` 追加 `useFoodStore.getState().reset()`

## 数据库（15 张表：10 日记 + 5 每日好饭）
| 表 | 关键字段 | 说明 |
|---|---|---|
| `profiles` | module_config, expert_style, custom_expert_tags, role, invite_code_id, **health_profile** | 用户配置（health_profile JSONB 存健康画像：height_cm/birth_date/gender/activity_level/calorie_goal/target_weight_kg） |
| `diaries` | content, chat_history, module_summaries, module_labels_snapshot, diary_date, created_at | 日记主体（created_at DB 触发器保护） |
| `reports` | theme, content, is_public, expert_style | AI 报告 |
| `user_memories` | mental_baseline, recurring_patterns, active_events | 动态记忆档案 |
| `prompt_configs` | type, version_number, name, content, is_active | 提示词版本管理 |
| `invite_codes` | code, used_by, used_at, deleted_at, is_deleted | 内测码 |
| `deletion_logs` | user_id, status, error_message | 注销审计日志 |
| `notes` | user_id, content, source_type, source_diary_id, source_diary_date, deleted_at, is_deleted | 珍藏碎片（**物理删除** + RLS `user_id=auth.uid()`；`deleted_at`/`is_deleted` 列已废弃不再写入） |
| `practices` | user_id, title, source_type, source_diary_id, source_diary_date, status(active/completed), completed_at, deleted_at, is_deleted | 心灵练习（软删 + 状态机） |
| `practice_logs` | user_id, practice_id, practiced_at, deleted_at, is_deleted | 打卡日志（UNIQUE(user_id, practice_id, practiced_at)，软删后可复活） |
| `foods` | user_id(NULL=system), name, source(system/user), category, 宏量5(NOT NULL)+微量15(可NULL), default_serving_g/name | 食物库（system 全局可见 + user 仅本人可见；system 食物不可改删；pg_trgm 模糊搜索 + 部分唯一索引） |
| `recipes` | user_id, name, description, servings, instructions, *_per_serving 营养缓存 | 菜谱（由 recipe_ingredients 汇总后写入每份营养缓存） |
| `recipe_ingredients` | recipe_id, food_id, user_id, quantity_g, note | 菜谱食材明细（ON DELETE RESTRICT food，ON DELETE CASCADE recipe） |
| `diet_logs` | user_id, log_date, meal_type(breakfast/lunch/dinner/snack), food_id XOR recipe_id, servings, quantity_g, 冻结营养5项, note | 每日饮食记录（创建时冻结营养快照，防后续食物/菜谱修改影响历史） |
| `body_metrics` | user_id, log_date, weight_kg, waist/hip/chest/arm/thigh_cm, body_fat_pct, note | 身体数据（**UNIQUE(user_id, log_date)** 一天一条 upsert；物理 DELETE） |

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

36. **每日好饭 · 食物库 RLS**：foods SELECT 策略 `source='system' AND is_deleted=false OR (user_id=auth.uid() AND is_deleted=false)` — system 食物全局可见，user 食物仅本人可见。INSERT/UPDATE/DELETE 只 `user_id=auth.uid()` — system 食物不可改删（API 层 + service 层双重校验 source）。部分唯一索引：system 按 name 全局唯一，user 按 (user_id, name) 唯一（软删后可重建）。

37. **每日好饭 · 身体数据 upsert**：`body_metrics` 有 `UNIQUE(user_id, log_date)` 约束，同天第二次保存靠 `upsert(onConflict: "user_id,log_date")` 覆盖。`deleteBodyMetric` 是物理 DELETE（不走软删）。store 端 `saveBodyMetric` 成功后替换同日期记录并按日期倒序排列。

38. **每日好饭 · Zustand 空数组陷阱**：`useFoodStore((s) => s.dietLogsByDate[date] ?? [])` 会**每次渲染创建新 `[]` 引用** → Zustand `Object.is` 比较 → 无限重渲染（Maximum update depth exceeded）。**解法**：模块级常量 `const EMPTY_DIET_LOGS: DietLogWithNames[] = []`，selector 返回 `s.dietLogsByDate[date] ?? EMPTY_DIET_LOGS`，空值永远同一引用。所有 `Record<key, T[]>` selector 均须用稳定空常量。

39. **每日好饭 · 食物搜索防抖**：`FoodSearchSheet` 300ms 防抖 + 5min 缓存（`foodSearchCache: Record<query, {results, fetchedAt}>`）。store `searchFoods` 先查缓存命中直接返回，否则 fetch API 并写缓存。搜索查 system + user 食物（`or` 过滤），按 source 排序（system 优先）。

40. **每日好饭 · AI 营养解读分工**：JS 端 `analyzePeriod` 算出各营养素达成率/评级/趋势后，把结构化结论交给 DeepSeek 做自然语言解读。System prompt 指令："数据中的评级和达成率已由系统计算完成，你只需解读数据并给出可操作建议，不要重新计算数值。"输出：总体评价/重点关注项/体重趋势解读/下周建议。复刻 `api/report/route.ts` 的 DeepSeek 调用模式。

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
- [ ] 身体数据：同天第二次保存 = 覆盖(upsert)；体重/围度趋势曲线渲染
- [ ] 分析报告：周/月热量趋势图 + 营养雷达图 + 体重曲线 + AI 文字建议；达成率三档评级正确
- [ ] 注销覆盖：新测试账号 → 录数据 → 注销 → SQL 查 5 张新表无该 user_id 残留

**构建**
- [ ] npx tsc --noEmit 零报错

后续开发中，如果你需要某条规则的具体实现细节（如 forceMount 配合 hidden 的写法、Zustand ensure 的生命周期、consume-invite-code 的原子锁逻辑），直接读取对应源码文件，而非依赖本文档的展开描述。