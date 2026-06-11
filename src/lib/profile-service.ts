import { createClient } from "@/lib/supabase/client";
import type { CustomExpertTags } from "@/config/experts-config";

export interface ExpertProfile {
  expert_style: string;
  custom_expert_tags: CustomExpertTags | null;
}

/**
 * Fetch current user's expert style settings.
 */
export async function fetchExpertStyle(): Promise<ExpertProfile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { expert_style: "warm_companion", custom_expert_tags: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("expert_style, custom_expert_tags")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return { expert_style: "warm_companion", custom_expert_tags: null };
  }

  return {
    expert_style: data.expert_style ?? "warm_companion",
    custom_expert_tags: data.custom_expert_tags as CustomExpertTags | null,
  };
}

/**
 * Update current user's expert style.
 */
export async function updateExpertStyle(
  style: string,
  customTags?: CustomExpertTags | null
): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const update: Record<string, unknown> = { expert_style: style };
  if (style === "custom") {
    update.custom_expert_tags = customTags ?? null;
  } else {
    update.custom_expert_tags = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  return !error;
}
