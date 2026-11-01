import type { BrandTheme } from "./theme";
import { defaultTheme } from "./themes/default";
import { south32Theme } from "./themes/south32";

export type { BrandColors, BrandFonts, BrandRadius, BrandSpace, BrandTheme, BrandType } from "./theme";
export { defaultScale } from "./theme";

const themes: Record<string, BrandTheme> = {
  default: defaultTheme,
  south32: south32Theme,
};

export function listBrands() {
  return Object.keys(themes);
}

export function getBrand(id = "default"): BrandTheme {
  const key = String(id || "default").toLowerCase();
  return themes[key] || defaultTheme;
}

export function brandCssVars(theme: BrandTheme = getBrand()): Record<string, string> {
  const { colors, fonts, radius, space, type } = theme;
  return {
    "--paper": colors.paper,
    "--paper-deep": colors.paperDeep,
    "--card": colors.card,
    "--ink": colors.ink,
    "--muted": colors.muted,
    "--line": colors.line,
    "--input": colors.input,
    "--a": colors.accent,
    "--a-soft": colors.accentSoft,
    "--b": colors.secondary,
    "--b-soft": colors.secondarySoft,
    "--good": colors.good,
    "--bad": colors.bad,
    "--heart": colors.heart,
    "--shadow": colors.shadow,
    "--font-display": fonts.display,
    "--font-body": fonts.body,
    "--radius-sm": radius.sm,
    "--radius-md": radius.md,
    "--radius-lg": radius.lg,
    "--space-xs": space.xs,
    "--space-sm": space.sm,
    "--space-md": space.md,
    "--space-lg": space.lg,
    "--space-xl": space.xl,
    "--text-body": type.body,
    "--text-small": type.small,
    "--text-label": type.label,
    "--text-title": type.title,
    "--background": colors.paper,
    "--foreground": colors.ink,
    "--card-foreground": colors.ink,
    "--popover": colors.card,
    "--popover-foreground": colors.ink,
    "--primary": colors.accent,
    "--primary-foreground": colors.card,
    "--secondary": colors.secondarySoft,
    "--secondary-foreground": colors.secondary,
    "--border": colors.line,
    "--muted-foreground": colors.muted,
    "--destructive": colors.bad,
    "--ring": colors.accent,
    "--radius": radius.md,
  };
}
