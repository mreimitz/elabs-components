/**
 * @qlik-coe-emea/qlabs-components-icons
 *
 * Brand / product-vocabulary SVG icons in one consistent monoline style (24x24,
 * stroke = currentColor) + `BrandLogo`. Use the `Icon`/`createIcon` primitives to
 * add more. Add an icon HERE only when it is part of the product's vocabulary.
 *
 * For generic UI glyphs (chevrons, X, search, bell, …) the DEFAULT is `lucide-react`
 * — import it directly. See `.claude/rules/icons.md`.
 */
export { Icon, createIcon, type IconProps } from "./icon";
export { BrandLogo, type BrandLogoProps, type BrandLogoVariant } from "./brand-logo";
export { AppIcon, type AppIconProps, type AppIconMorph } from "./app-icon";
export * from "./sample-icons";
