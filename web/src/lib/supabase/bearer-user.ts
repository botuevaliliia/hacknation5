import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Resolve the Supabase user from `Authorization: Bearer <access_token>` (machine / agent clients).
 * Does not use cookies — suitable for Route Handlers called outside the browser.
 */
export async function getUserFromBearerRequest(req: Request): Promise<
  | { user: User; error: null }
  | { user: null; error: "config" | "missing_token" | "invalid_token" }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { user: null, error: "config" };
  }
  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { user: null, error: "missing_token" };
  }
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: "invalid_token" };
  }
  return { user: data.user, error: null };
}
