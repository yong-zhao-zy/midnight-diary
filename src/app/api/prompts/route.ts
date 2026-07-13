import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PROMPTS,
  PROMPT_TYPES,
  type PromptType,
  type PromptConfigRow,
} from "@/lib/prompt-templates";

/**
 * GET — 获取指定 type 下的所有版本（按 version_number 降序）
 * 防呆自愈：无记录时自动 INSERT v1.0 系统自带默认 Prompt
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as PromptType | null;

    if (!type || !PROMPT_TYPES.includes(type)) {
      return NextResponse.json({ error: "无效的提示词类型" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("prompt_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", type)
      .eq("is_deleted", false)
      .order("version_number", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    // 防呆自愈：首次访问自动播种 v1.0 系统自带
    if (!rows || rows.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from("prompt_configs")
        .insert({
          user_id: user.id,
          type,
          version_number: 1.0,
          name: "系统自带",
          content: DEFAULT_PROMPTS[type],
          is_active: true,
        })
        .select("*")
        .single();

      if (seedError) {
        return NextResponse.json({ error: "初始化失败" }, { status: 500 });
      }

      return NextResponse.json({ versions: [seeded as PromptConfigRow] });
    }

    return NextResponse.json({ versions: rows as PromptConfigRow[] });
  } catch {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST — 保存修改 / 另存为新版本
 * action: "save"     → 更新现有版本 content（1.0 系统自带禁止修改）
 * action: "saveAs"   → 新增 max+1.0 版本并设为生效，同 type 其他版本失效
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, action } = body as { type: PromptType; action: string };

    if (!type || !PROMPT_TYPES.includes(type)) {
      return NextResponse.json({ error: "无效的提示词类型" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (action === "save") {
      const { id, content } = body as { id: string; content: string };
      if (!id || !content) {
        return NextResponse.json({ error: "缺少参数" }, { status: 400 });
      }

      // 确认不是 1.0 系统自带
      const { data: target } = await supabase
        .from("prompt_configs")
        .select("version_number")
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .single();

      if (!target) {
        return NextResponse.json({ error: "记录不存在" }, { status: 404 });
      }
      if (Number(target.version_number) === 1.0) {
        return NextResponse.json(
          { error: "系统自带模板请使用另存为新版本" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("prompt_configs")
        .update({ content })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: "保存失败" }, { status: 500 });
      }

      return NextResponse.json({ version: data as PromptConfigRow });
    }

    if (action === "saveAs") {
      const { name, content } = body as { name: string; content: string };
      if (!name?.trim() || !content) {
        return NextResponse.json(
          { error: "缺少版本名称或内容" },
          { status: 400 }
        );
      }

      // 查询当前最大版本号
      const { data: existing } = await supabase
        .from("prompt_configs")
        .select("version_number")
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("is_deleted", false)
        .order("version_number", { ascending: false })
        .limit(1);

      const maxVersion =
        existing && existing.length > 0
          ? Number(existing[0].version_number)
          : 1.0;
      const newVersion = Math.round((maxVersion + 1.0) * 10) / 10; // 避免浮点误差

      // 先将同 type 其他版本 is_active 置为 false（为唯一索引让路）
      const { error: deactivateError } = await supabase
        .from("prompt_configs")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("type", type)
        .eq("is_active", true);

      if (deactivateError) {
        return NextResponse.json({ error: "版本切换失败" }, { status: 500 });
      }

      // 插入新版本并设为生效
      const { data, error } = await supabase
        .from("prompt_configs")
        .insert({
          user_id: user.id,
          type,
          version_number: newVersion,
          name: name.trim(),
          content,
          is_active: true,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: "另存失败" }, { status: 500 });
      }

      return NextResponse.json({ version: data as PromptConfigRow });
    }

    return NextResponse.json({ error: "未知操作类型" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * PATCH — 切换生效版本
 * 接收 id，将目标版本设为 is_active=true，同 user+type 其他版本设为 false
 */
export async function PATCH(request: Request) {
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 查询目标版本的 type
    const { data: target } = await supabase
      .from("prompt_configs")
      .select("type")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .single();

    if (!target) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }

    // 先将同 type 所有版本 is_active = false
    await supabase
      .from("prompt_configs")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("type", target.type)
      .eq("is_active", true);

    // 再将目标版本 is_active = true
    const { data, error } = await supabase
      .from("prompt_configs")
      .update({ is_active: true })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "切换失败" }, { status: 500 });
    }

    return NextResponse.json({ version: data as PromptConfigRow });
  } catch {
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
