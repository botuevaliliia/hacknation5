"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard/market").trim() || "/dashboard/market";

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect(
      `/auth/login?error=${encodeURIComponent("Missing Supabase env on server (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).")}`,
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.user) {
    await ensureProfile(data.user.id, data.user.email);
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect(
      `/auth/register?error=${encodeURIComponent("Missing Supabase env on server (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).")}`,
    );
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect(`/auth/register?error=${encodeURIComponent(error.message)}`);
  }
  if (data.user) {
    await ensureProfile(data.user.id, data.user.email ?? email);
  }
  revalidatePath("/", "layout");
  redirect("/dashboard/market");
}

export async function signOut() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    redirect("/");
  }
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
