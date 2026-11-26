import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient(responseHeaders: Headers) {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) throw new Error("Configure SUPABASE_URL no back-end.");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!publishableKey?.startsWith("sb_publishable_")) {
    throw new Error("Configure SUPABASE_PUBLISHABLE_KEY com uma chave publicável.");
  }

  const cookieStore = await cookies();
  const deadline = AbortSignal.timeout(15_000);
  responseHeaders.set("Cache-Control", "private, no-store");

  return createServerClient(url, publishableKey, {
    global: {
      fetch(input, init) {
        const signal = init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline;
        return fetch(input, { ...init, signal });
      },
    },
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
        for (const [name, value] of Object.entries(cacheHeaders ?? {})) {
          responseHeaders.set(name, value);
        }
      },
    },
  });
}
