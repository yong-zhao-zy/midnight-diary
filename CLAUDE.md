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
- `SUPABASE_SERVICE_ROLE_KEY`（仅本地迁移脚本使用，绕过 RLS）
- `DEEPSEEK_API_KEY`

Vercel 部署时需在 Dashboard 同步配置以上变量。

## 4. 数据库结构
**auth.users**：Supabase Auth 自动管理

**public.profiles**
- id (uuid, pk): 关联 auth.users.id
- module_config (jsonb): 维度配置 [{"id": "m1", "label": "工作", "isActive": true}, ...]

**public.diaries**
- diary_date (date): 唯一约束 (user_id + diary_date)
- content (jsonb): 以 mID 为 Key 的内容 { "m1": "...", "m2": "..." }
- chat_history (jsonb): 首条固定为 {"type": "reference", "label": "日记原文"}
- module_summaries (jsonb): AI 摘要，Key 需与 content 保持一致
- module_labels_snapshot (jsonb): 保存时的模块名快照，用于历史更名回溯展示

## 5. 核心业务逻辑
1. **一日一记**：点击"+"预检数据库，今日有记录则跳转 `/write?id=xxx`，否则新建
2. **双模式 UI**：首次填写为步骤引导卡片；再次编辑为全量表单
3. **AI 解读**：支持追问；收到"重新解读"时清空历史重新生成
4. **引导动画**：首访播放，含背景音乐、科学注脚（已修复）
5. **动态渲染**：写日记卡片、管理弹窗、报告表格必须通过遍历 module_config 生成
6. **深度合并保存**：执行 upsert 前必须先 Fetch 云端已有内容进行 Deep Merge，防止分次保存覆盖数据。
7. **语音混合输入**：VoiceTextInput 核心 Hooks（60s 倒计时、光标精准插入）禁止改动
8. **名称回溯**：若当前 label 与 snapshot 不符，UI 需展示为：当前名 (原名: 填写时名称)
9. **字母前缀**：所有模块展示时需自动根据索引添加 A. B. C. D. 前缀
10. **AI 摘要脱水精炼**（`src/app/api/summary/route.ts`）：
    - 角色：治愈系情绪观察员，自动过滤语音口水话（然后、就是、我觉得、那个等）
    - 字数：5-20 字严格限制
    - 格式 A（优先）：【事件】[极简概括] ｜ 【情绪】[精准情绪词]
    - 格式 B：因[极简事件]感到[核心情绪]
    - 返回 JSON Key 与 content 的 mID 严格一致，safety truncate 50 字符
    - **数据库保留完整结构**，前端通过 `extractEventText()` 解析仅展示纯净事件短句
11. **报告表格交互**：
    - 单元格摘要支持横向滑动（`overflow-x-auto whitespace-nowrap scrollbar-none cursor-ew-resize`）
    - 移动端手指横滑 / PC 端鼠标拖拽查看长文本
12. **模块专属彩色圆点**（莫兰迪色系）：
    - m1 柔和蓝 `bg-indigo-400` / m2 治愈粉 `bg-rose-400` / m3 温暖黄 `bg-amber-400` / m4 宁静绿 `bg-emerald-400`
    - 新增模块通过 `resolveDotColor()` 循环分配莫兰迪彩色池（purple/cyan/orange/red/teal），严禁灰色兜底
    - 统一应用于 ReportTable、ReportFilters、DiaryPreviewCard、DiaryCard
13. **写日记历史列表双重筛选**（`src/components/diary/DiaryFilters.tsx` + `DiaryCard.tsx`）：
    - 日期筛选：原生 date input（深色主题适配），支持选择单日或清除
    - 模块筛选：横向滚动莫兰迪彩色 Tag（仅展示 isActive 模块），点击切换选中
    - 无筛选 → 默认 ResponseLetter 卡片列表
    - 仅选日期 → 该天所有模块全量展开（无 line-clamp）
    - 仅选模块 → 仅保留含该模块内容的卡片，且仅展示该模块全量内容
    - 双重筛选 → 精准定位某天某模块
    - 无匹配结果 → 空状态提示"今天是一片安静的空白，去写一页吧..."

## 6. 已完成功能
- [x] PWA 配置与注册登录流程
- [x] 语音+文字混合输入（按住说话，光标插入，60s倒计时，iOS兼容）
- [x] 首访引导动画
- [x] 动态维度管理系统 (重命名、新增、软删除、字母前缀)
- [x] AI 解读 + 追问
- [x] 自动保存与深度合并 (解决状态丢失与覆盖问题) 
- [x] 日记报告（日/周/月表格视图、模块筛选、AI 摘要、预览卡片、localStorage 持久化）
- [x] AI 摘要 Prompt 脱水精炼（口水话过滤 + 骨架化格式 + 5-20字极致限字）
- [x] 全局背景视觉统一（fixed 全屏星空渐变，消除滚动颜色断层）
- [x] 报告表格横向滑动（移除 truncate，支持移动端手指/PC 鼠标拖拽）
- [x] 模块专属莫兰迪彩色圆点（resolveDotColor 统一分配，禁止灰色兜底）
- [x] 前端 extractEventText 解析（数据库保留完整结构，UI 仅显示事件短句）
- [x] 全量历史摘要重刷（scripts/rebuild-all-summaries.ts，26条全部更新为骨架化格式）
- [x] 写日记 Tab 双重筛选器（日期+模块，动态列表渲染切换，DiaryFilters + DiaryCard 组件）

## 7. 开发规范与 AI 行为准则
- 组件用 TypeScript，props 必须定义 interface
- 数据库操作封装在 lib/，区分 server.ts / client.ts
- 修改前：必须声明将要修改的文件列表。
- 修改中：禁止擅自调整样式、字号、颜色、间距。
- 修改后：告知哪些功能受影响，建议用户验证。

### git push 前回归检查（逐项确认，有未通过项禁止 push）
**动态维度与显示**
- [ ] 模块显示是否带字母前缀？m1/m2 内部 Key 是否已隐藏？
- [ ] 改维度名后，历史日记是否显示 (原名: xxx)？
- [ ] 停用维度后，写日记页隐藏，但报告页数据是否仍在？

**语音输入 (高风险项)**
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

**写日记筛选**
- [ ] 有日记时筛选器 UI 正常展示（日期 + 模块 Tag）
- [ ] 选择日期后列表仅保留该天日记，内容全量展开
- [ ] 选择模块后列表仅保留含该模块内容的日记，仅展示对应模块
- [ ] 双重筛选精准定位
- [ ] 清除筛选后回到默认 ResponseLetter 列表
- [ ] 无匹配结果显示空状态提示

**保存稳定性**
- [ ] 连续分次保存不同模块，前一次的内容是否被保留？（核心测试项）
- [ ] 数据库 module_labels_snapshot 是否成功写入？ 

**基础功能**
- [ ] 注册/登录正常
- [ ] 日记保存不重复创建
- [ ] AI 解读正常
- [ ] 历史记录正常展示
- [ ] 引导动画正常（首次访问）
- [ ] 移动端显示正常
- [ ] Tab 切换是否正常？

