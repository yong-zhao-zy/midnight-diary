import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env.local
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Prefer service role key (bypasses RLS) for admin operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL");
  console.error("   需要 SUPABASE_SERVICE_ROLE_KEY（推荐）或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("⚠️  未设置 SUPABASE_SERVICE_ROLE_KEY，使用 anon key（受 RLS 限制，可能无法查到其他用户数据）");
  console.warn("   请在 .env.local 中添加 SUPABASE_SERVICE_ROLE_KEY=<你的 service role key>\n");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONTENT_KEYS = ["mind_body", "connection", "peak_moment", "vision"];

interface DiaryRecord {
  id: string;
  user_id: string;
  content: Record<string, string>;
  chat_history: Array<{ type: string; label: string; content: string }>;
  created_at: string;
}

interface DuplicateGroup {
  user_id: string;
  diary_date: string;
  records: DiaryRecord[];
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
  // Fetch all diaries ordered by created_at
  const { data, error } = await supabase
    .from("diaries")
    .select("id, user_id, content, chat_history, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ 查询失败:", error.message);
    process.exit(1);
  }

  // Group by user_id + date
  const groups = new Map<string, DiaryRecord[]>();
  for (const row of data as DiaryRecord[]) {
    const date = row.created_at.slice(0, 10); // YYYY-MM-DD
    const key = `${row.user_id}|${date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Filter to only duplicates
  const duplicates: DuplicateGroup[] = [];
  for (const [key, records] of groups) {
    if (records.length > 1) {
      const [user_id, diary_date] = key.split("|");
      duplicates.push({ user_id, diary_date, records });
    }
  }

  return duplicates;
}

function mergeContent(records: DiaryRecord[]): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const key of CONTENT_KEYS) {
    const parts: string[] = [];
    for (const record of records) {
      const val = record.content?.[key]?.trim();
      if (val) parts.push(val);
    }
    merged[key] = parts.join("\n");
  }

  return merged;
}

function mergeChatHistory(records: DiaryRecord[]): Array<{ type: string; label: string; content: string }> {
  // Keep the latest record's chat_history (most complete AI interpretation)
  const latest = records[records.length - 1];
  const history = latest.chat_history;

  // If latest has meaningful AI content, use it; otherwise try earlier records
  if (history && history.length > 1) {
    return history;
  }

  // Fallback: find the record with most chat_history entries
  let best = records[0];
  for (const record of records) {
    if ((record.chat_history?.length ?? 0) > (best.chat_history?.length ?? 0)) {
      best = record;
    }
  }

  return best.chat_history || [{ type: "reference", label: "日记原文", content: "" }];
}

async function main() {
  console.log("🔍 正在查询重复记录...\n");

  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log("✅ 没有发现重复记录，无需合并。");
    return;
  }

  // Print merge plan
  console.log(`📋 发现 ${duplicates.length} 组重复数据：\n`);
  console.log("─".repeat(60));

  let totalToDelete = 0;

  for (const group of duplicates) {
    console.log(`\n👤 用户: ${group.user_id}`);
    console.log(`📅 日期: ${group.diary_date}`);
    console.log(`📄 记录数: ${group.records.length} 条`);
    console.log(`   保留 ID: ${group.records[0].id} (最早创建)`);
    console.log(`   删除 ID: ${group.records.slice(1).map((r) => r.id).join(", ")}`);

    const merged = mergeContent(group.records);
    console.log(`   合并内容预览:`);
    for (const key of CONTENT_KEYS) {
      if (merged[key]) {
        const preview = merged[key].length > 50 ? merged[key].slice(0, 50) + "..." : merged[key];
        console.log(`     ${key}: "${preview}"`);
      }
    }

    totalToDelete += group.records.length - 1;
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\n📊 汇总: 将合并 ${duplicates.length} 组，删除 ${totalToDelete} 条重复记录\n`);

  // Ask for confirmation
  const answer = await ask("⚠️  确认执行合并？此操作不可逆 (y/n): ");

  if (answer !== "y") {
    console.log("❌ 已取消操作。");
    return;
  }

  // Execute merge
  console.log("\n🔄 开始执行合并...\n");

  let processedGroups = 0;
  let deletedRecords = 0;

  for (const group of duplicates) {
    const keepRecord = group.records[0]; // Earliest record
    const deleteIds = group.records.slice(1).map((r) => r.id);

    // Merge content
    const mergedContent = mergeContent(group.records);
    const mergedHistory = mergeChatHistory(group.records);

    // Update the kept record with merged data
    const { error: updateError } = await supabase
      .from("diaries")
      .update({
        content: mergedContent,
        chat_history: mergedHistory,
      })
      .eq("id", keepRecord.id);

    if (updateError) {
      console.error(`❌ 更新记录 ${keepRecord.id} 失败:`, updateError.message);
      continue;
    }

    // Delete duplicate records
    const { error: deleteError } = await supabase
      .from("diaries")
      .delete()
      .in("id", deleteIds);

    if (deleteError) {
      console.error(`❌ 删除重复记录失败:`, deleteError.message);
      continue;
    }

    processedGroups++;
    deletedRecords += deleteIds.length;
    console.log(`  ✅ ${group.diary_date} — 合并完成，删除 ${deleteIds.length} 条`);
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\n✅ 合并完成！共处理 ${processedGroups} 个日期，删除 ${deletedRecords} 条重复记录。`);
}

main().catch((err) => {
  console.error("❌ 脚本执行失败:", err);
  process.exit(1);
});
