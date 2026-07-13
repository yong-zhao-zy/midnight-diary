import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Public routes that don't require authentication — check BEFORE getUser()
  // to avoid a network round-trip for API/login/share routes.
  const publicPaths = ["/login", "/api", "/auth/callback", "/update-password", "/share", "/invite-required"];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Invite code gate — check profiles.role + invite_code_id
  // Admin bypasses; users with a consumed invite code pass; others redirected.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, invite_code_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .single();

  if (profile?.role !== "admin" && !profile?.invite_code_id) {
    const url = request.nextUrl.clone();
    url.pathname = "/invite-required";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
