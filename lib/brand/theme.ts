export type BrandColors = {
  paper: string;
  paperDeep: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  input: string;
  accent: string;
  accentSoft: string;
  secondary: string;
  secondarySoft: string;
  good: string;
  bad: string;
  heart: string;
  shadow: string;
};

export type BrandFonts = {
  display: string;
  body: string;
  googleHref: string;
};

export type BrandRadius = {
  sm: string;
  md: string;
  lg: string;
};

export type BrandSpace = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type BrandType = {
  body: string;
  small: string;
  label: string;
  title: string;
};

export const defaultScale = {
  radius: { sm: "6px", md: "10px", lg: "16px" },
  space: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "40px" },
  type: { body: "16px", small: "13px", label: "11px", title: "20px" },
} as const;

export type BrandTheme = {
  id: string;
  name: string;
  productName: string;
  tagline: string;
  logoUrl?: string;
  fonts: BrandFonts;
  colors: BrandColors;
  radius: BrandRadius;
  space: BrandSpace;
  type: BrandType;
  modules: import("../modules").ModuleId[];
};
