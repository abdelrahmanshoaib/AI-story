import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProviderEnum = z.enum(["lovable", "openai", "gemini", "custom"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    return {
      provider: (data?.provider ?? "lovable") as "lovable" | "openai" | "gemini" | "custom",
      model: data?.model ?? "google/gemini-2.5-flash",
      base_url: data?.base_url ?? "",
      has_custom_key: !!data?.has_custom_key,
      key_present: !!process.env.CUSTOM_AI_API_KEY,
      updated_at: data?.updated_at ?? null,
    };
  });

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: ProviderEnum,
        model: z.string().min(2).max(200),
        base_url: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hasKey = !!process.env.CUSTOM_AI_API_KEY;
    const { error } = await supabaseAdmin
      .from("ai_settings")
      .upsert({
        id: true,
        provider: data.provider,
        model: data.model,
        base_url: data.base_url || null,
        has_custom_key: data.provider !== "lovable" && hasKey,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true, key_present: hasKey };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { resolveAiProvider } = await import("@/lib/ai-provider.server");
    const { generateText } = await import("ai");
    try {
      const { model, provider, modelId } = await resolveAiProvider();
      const { text } = await generateText({
        model,
        prompt: "Reply with the single word OK",
        maxOutputTokens: 10,
      });
      return { ok: true, provider, modelId, reply: text.trim().slice(0, 80) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });
