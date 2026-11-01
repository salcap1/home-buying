import { MODULE_IDS } from "../../modules";
import { defaultScale, type BrandTheme } from "../theme";

/** Example tenant theme. Switch with NEXT_PUBLIC_BRAND=south32. Not a live 32 South deploy. */
export const south32Theme: BrandTheme = {
  id: "south32",
  name: "32 South",
  productName: "32 South Home Buying",
  tagline: "Charleston buyer boards",
  ...defaultScale,
  modules: [...MODULE_IDS],
  fonts: {
    display: '"Fraunces", Georgia, serif',
    body: '"Source Sans 3", "Segoe UI", sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600;700&display=swap",
  },
  colors: {
    paper: "#f4f1ea",
    paperDeep: "#e4ddd0",
    card: "#fffdf8",
    ink: "#1b2420",
    muted: "#5c6863",
    line: "#d3cdc2",
    input: "#fff8ec",
    accent: "#1f4d3a",
    accentSoft: "#e3efe8",
    secondary: "#2a4a6b",
    secondarySoft: "#e4ebf3",
    good: "#2d6a4f",
    bad: "#9a3b2a",
    heart: "#c2415a",
    shadow: "0 12px 32px rgba(27, 36, 32, 0.06)",
  },
};
