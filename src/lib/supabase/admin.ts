import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role 客户端 — 绕过 RLS，仅用于服务端管理员操作（如账号注销）
 * 环境变量 SUPABASE_SERVICE_ROLE_KEY 已存在于 .env.local
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
