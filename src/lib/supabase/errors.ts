/**
 * Supabase 网络层错误识别与用户友好文案
 *
 * 背景：`*.supabase.co` 在中国大陆会被 SNI 定向阻断（TCP 可连、TLS 握手即被 RST）。
 * 此时 supabase-js 抛出的并不是「密码错误」，而是底层 fetch 失败：
 *   - Chrome  / Android：TypeError: Failed to fetch
 *   - iOS Safari        ：TypeError: Load failed
 *   - 原生 RN           ：TypeError: Network request failed
 * 直接把 message 抛给用户会显示成「Load failed」，让人误判为账号问题。
 */

type SupabaseLikeError = {
  name?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
} | null | undefined;

const NETWORK_ERROR_PATTERN =
  /load failed|failed to fetch|fetch failed|network ?error|networkrequestfailed|connection (reset|refused|aborted)|internet connection appears to be offline|cannot connect to the server|timed? ?out|the request timed out/i;

/** 判断是否为「连不上后端」这类网络错误（而非凭据/权限问题） */
export function isNetworkError(err: SupabaseLikeError): boolean {
  if (!err) return false;
  // auth-js 网络失败统一抛 AuthRetryableFetchError；postgrest-js 记为 status 0
  if (err.name === "AuthRetryableFetchError") return true;
  if (err.status === 0) return true;
  const text = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`;
  return NETWORK_ERROR_PATTERN.test(text);
}

/** 网络不可达时给用户的统一文案（明确「不是密码问题 / 数据没丢」） */
export const NETWORK_ERROR_MESSAGE =
  "无法连接数据服务器（Supabase）。这不是密码问题，你的数据也没有丢失。请检查手机网络——国内网络需开启代理后重试。";

/** 把任意错误转成可直接展示给用户的文案 */
export function toFriendlyError(err: unknown): string {
  if (isNetworkError(err as SupabaseLikeError)) return NETWORK_ERROR_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  const message = (err as SupabaseLikeError)?.message;
  return message || "操作失败，请稍后重试";
}
