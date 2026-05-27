import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // email_confirmation | recovery

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Password recovery → redirect to update-password page
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/update-password`);
    }

    // Email confirmation → redirect to login with verified email pre-filled
    if (type === "email_confirmation" || data?.user?.email) {
      const email = data?.user?.email || "";
      return NextResponse.redirect(
        `${origin}/login?verified=1&email=${encodeURIComponent(email)}`
      );
    }
  }

  return NextResponse.redirect(origin);
}
