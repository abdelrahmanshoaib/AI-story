import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProfileUpdateSchema = z.object({
  display_name: z.string().trim().max(60).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  age: z.number().int().min(3).max(99).nullable().optional(),
  arabic_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  english_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  favorite_topics: z.array(z.string().max(60)).max(20).optional(),
  preferred_language: z.enum(["ar", "en"]).optional(),
  preferred_size: z.enum(["small", "medium", "large"]).optional(),
  daily_goal: z.number().int().min(0).max(50).optional(),
  weekly_goal: z.number().int().min(0).max(200).optional(),
  monthly_goal: z.number().int().min(0).max(1000).optional(),
  font_family: z.enum(["default", "handwritten", "serif", "mono"]).optional(),
  font_size: z.enum(["small", "medium", "large", "xlarge"]).optional(),
  color_theme: z.enum(["default", "ocean", "forest", "sunset", "candy", "midnight"]).optional(),
  app_style: z.enum(["playful", "minimal", "classic"]).optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const { data: created, error: insErr } = await context.supabase
        .from("profiles")
        .insert({ user_id: context.userId })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      return created;
    }
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProfileUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getReadingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [today, week, month] = await Promise.all([
      context.supabase.from("stories").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
      context.supabase.from("stories").select("id", { count: "exact", head: true }).gte("created_at", startOfWeek.toISOString()),
      context.supabase.from("stories").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
    ]);

    return {
      today: today.count ?? 0,
      week: week.count ?? 0,
      month: month.count ?? 0,
    };
  });
