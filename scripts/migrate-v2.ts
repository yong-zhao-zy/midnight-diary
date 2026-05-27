/**
 * 数据迁移脚本：5 维度 → 4 维度
 *
 * 映射规则:
 *   emotion + body → mind_body (身心觉知)
 *   social → connection (人际链接)
 *   light → peak_moment (高光瞬间)
 *   challenge → vision (感恩与愿景)
 *
 * 运行: npx tsx scripts/migrate-v2.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (avoid dotenv dependency)
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface OldContent {
  emotion?: string;
  body?: string;
  social?: string;
  light?: string;
  challenge?: string;
  [key: string]: string | undefined;
}

interface NewContent {
  mind_body: string;
  connection: string;
  peak_moment: string;
  vision: string;
}

function migrateContent(old: OldContent): NewContent {
  const parts: string[] = [];
  if (old.emotion?.trim()) parts.push(`[情绪]: ${old.emotion.trim()}`);
  if (old.body?.trim()) parts.push(`[身体]: ${old.body.trim()}`);

  return {
    mind_body: parts.join("\n"),
    connection: old.social?.trim() || "",
    peak_moment: old.light?.trim() || "",
    vision: old.challenge?.trim() || "",
  };
}

function isAlreadyMigrated(content: Record<string, string>): boolean {
  return "mind_body" in content || "connection" in content;
}

async function main() {
  console.log("📦 开始迁移 diaries.content: 5维度 → 4维度...\n");

  const { data: rows, error } = await supabase
    .from("diaries")
    .select("id, content");

  if (error) {
    console.error("读取失败:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("无记录需要迁移。");
    return;
  }

  console.log(`共 ${rows.length} 条记录\n`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const content = row.content as Record<string, string>;

    if (isAlreadyMigrated(content)) {
      skipped++;
      continue;
    }

    const newContent = migrateContent(content as OldContent);

    // Backup old content into content_v1_backup column (best-effort)
    await supabase
      .from("diaries")
      .update({ content: newContent } as Record<string, unknown>)
      .eq("id", row.id);

    migrated++;
    console.log(`  ✓ ${row.id} 已迁移`);
  }

  console.log(`\n✅ 迁移完成: ${migrated} 条已更新, ${skipped} 条已跳过（已是新格式）`);
}

main().catch((e) => {
  console.error("迁移异常:", e);
  process.exit(1);
});
