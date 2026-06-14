// Server-only helper to resolve the active AI provider.
// Reads admin-configured ai_settings from the DB and uses CUSTOM_AI_API_KEY when set.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

export type Provider = "lovable" | "openai" | "gemini" | "custom";

export interface ResolvedAi {
  provider: Provider;
  model: any; // AI SDK LanguageModel
  modelId: string;
  // Lovable API key, available for image generation fallback paths
  lovableKey: string;
}

const PRESET_URLS: Record<Provider, string | null> = {
  lovable: "https://ai.gateway.lovable.dev/v1",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  custom: null,
};

export async function resolveAiProvider(): Promise<ResolvedAi> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

  const { data: settings } = await supabaseAdmin
    .from("ai_settings")
    .select("provider, model, base_url, has_custom_key")
    .eq("id", true)
    .maybeSingle();

  const provider = (settings?.provider as Provider | undefined) ?? "lovable";
  const modelId = settings?.model ?? "google/gemini-2.5-flash";

  // If admin selected custom provider but key isn't set, fall back to Lovable.
  const customKey = process.env.CUSTOM_AI_API_KEY;
  const useCustom = provider !== "lovable" && settings?.has_custom_key && !!customKey;

  if (!useCustom) {
    const gateway = createLovableAiGatewayProvider(lovableKey);
    return {
      provider: "lovable",
      model: gateway(modelId.startsWith("google/") || modelId.startsWith("openai/") ? modelId : "google/gemini-2.5-flash"),
      modelId,
      lovableKey,
    };
  }

  const baseURL = provider === "custom" ? (settings?.base_url ?? "") : PRESET_URLS[provider]!;
  if (!baseURL) {
    throw new Error("Custom AI base URL is not configured");
  }

  const compat = createOpenAICompatible({
    name: provider,
    baseURL,
    headers: {
      Authorization: `Bearer ${customKey}`,
    },
  });

  return {
    provider,
    model: compat(modelId),
    modelId,
    lovableKey,
  };
}
