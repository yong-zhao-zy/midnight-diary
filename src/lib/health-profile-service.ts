import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthProfile } from "@/config/dri-config";
import { DEFAULT_HEALTH_PROFILE } from "@/config/dri-config";

const HEALTH_PROFILE_SELECT = "health_profile";

/** 获取用户健康画像 */
export async function fetchHealthProfile(
  supabase: SupabaseClient = createClient()
): Promise<HealthProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...DEFAULT_HEALTH_PROFILE };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(HEALTH_PROFILE_SELECT)
    .eq("id", user.id)
    .eq("is_deleted", false)
    .single();

  if (error || !data) {
    console.error("Fetch health profile error:", error);
    return { ...DEFAULT_HEALTH_PROFILE };
  }

  const profile = data.health_profile as HealthProfile | null;
  if (!profile || typeof profile !== "object") {
    return { ...DEFAULT_HEALTH_PROFILE };
  }

  return { ...DEFAULT_HEALTH_PROFILE, ...profile };
}

/** 更新用户健康画像（整体覆盖 health_profile JSONB） */
export async function updateHealthProfile(
  profile: HealthProfile,
  supabase: SupabaseClient = createClient()
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("Update health profile: no user");
    return false;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ health_profile: profile })
    .eq("id", user.id);

  if (error) {
    console.error("Update health profile error:", error);
    return false;
  }
  return true;
}
