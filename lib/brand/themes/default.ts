import { MODULE_IDS } from "../../modules";
import { defaultScale, type BrandTheme } from "../theme";

/** Default product look. Other companies get their own file in this folder. */
export const defaultTheme: BrandTheme = {
  id: "default",
  name: "Buyer Boards",
  productName: "Buyer Boards",
  tagline: "Your home, your way",
  ...defaultScale,
  modules: [...MODULE_IDS],
  fonts: {
    display: '"Fraunces", Georgia, serif',
    body: '"Source Sans 3", "Segoe UI", sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600;700&display=swap",
  },
  colors: {
    paper: "#f3eee4",
    paperDeep: "#e8e0d2",
    card: "#fffdf8",
    ink: "#1c1916",
    muted: "#6b6459",
    line: "#d8d0c2",
    input: "#fff8ec",
    accent: "#9a3b2a",
    accentSoft: "#f6e6e1",
    secondary: "#245c56",
    secondarySoft: "#dfecea",
    good: "#2d6a4f",
    bad: "#9a3b2a",
    heart: "#c2415a",
    shadow: "0 12px 32px rgba(28, 25, 22, 0.06)",
  },
};
