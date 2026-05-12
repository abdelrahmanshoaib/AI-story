import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/profile.functions";

const FONT_FAMILY: Record<string, string> = {
  default: "var(--font-body)",
  handwritten: "var(--font-handwritten)",
  serif: "Georgia, 'Cairo', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const FONT_SIZE: Record<string, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  xlarge: "21px",
};

type ThemeVars = Record<string, string>;

const THEMES: Record<string, ThemeVars> = {
  default: {},
  ocean: {
    "--background": "oklch(0.98 0.02 220)",
    "--primary": "oklch(0.7 0.15 220)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.72 0.16 200)",
    "--accent": "oklch(0.75 0.13 250)",
    "--ring": "oklch(0.7 0.15 220)",
  },
  forest: {
    "--background": "oklch(0.98 0.02 140)",
    "--primary": "oklch(0.65 0.16 145)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.7 0.15 110)",
    "--accent": "oklch(0.75 0.12 170)",
    "--ring": "oklch(0.65 0.16 145)",
  },
  sunset: {
    "--background": "oklch(0.98 0.02 50)",
    "--primary": "oklch(0.7 0.2 35)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.72 0.18 15)",
    "--accent": "oklch(0.78 0.15 70)",
    "--ring": "oklch(0.7 0.2 35)",
  },
  candy: {
    "--background": "oklch(0.98 0.02 340)",
    "--primary": "oklch(0.72 0.2 340)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.75 0.18 300)",
    "--accent": "oklch(0.78 0.15 200)",
    "--ring": "oklch(0.72 0.2 340)",
  },
  midnight: {
    "--background": "oklch(0.2 0.03 270)",
    "--foreground": "oklch(0.98 0.01 90)",
    "--card": "oklch(0.26 0.04 270)",
    "--card-foreground": "oklch(0.98 0.01 90)",
    "--popover": "oklch(0.26 0.04 270)",
    "--popover-foreground": "oklch(0.98 0.01 90)",
    "--muted": "oklch(0.3 0.03 270)",
    "--muted-foreground": "oklch(0.75 0.02 90)",
    "--border": "oklch(1 0 0 / 12%)",
    "--input": "oklch(1 0 0 / 15%)",
    "--primary": "oklch(0.82 0.17 75)",
  },
};

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const getProfileFn = useServerFn(getProfile);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfileFn(),
    enabled: authed,
    staleTime: 60_000,
  });

  useEffect(() => {
    const root = document.documentElement;
    const p = profile.data as Record<string, unknown> | undefined;
    const fontFamily = (p?.font_family as string) || "default";
    const fontSize = (p?.font_size as string) || "medium";
    const theme = (p?.color_theme as string) || "default";
    const style = (p?.app_style as string) || "playful";

    root.style.setProperty("--app-font", FONT_FAMILY[fontFamily] || FONT_FAMILY.default);
    root.style.fontSize = FONT_SIZE[fontSize] || FONT_SIZE.medium;
    document.body.style.fontFamily = FONT_FAMILY[fontFamily] || FONT_FAMILY.default;

    // Reset previously applied theme keys
    const allKeys = new Set<string>();
    Object.values(THEMES).forEach((t) => Object.keys(t).forEach((k) => allKeys.add(k)));
    allKeys.forEach((k) => root.style.removeProperty(k));

    const vars = THEMES[theme] || {};
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));

    root.dataset.appStyle = style;
  }, [profile.data]);

  return <>{children}</>;
}
