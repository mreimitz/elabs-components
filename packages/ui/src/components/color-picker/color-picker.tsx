// a2ui.exposed: yes
import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

// ---------------------------------------------------------------------------
// Token vocabulary
// ---------------------------------------------------------------------------

/**
 * The semantic color token names that ColorPicker understands as "safe" values.
 * These map 1-to-1 with Tailwind utilities backed by CSS variables so they
 * remain theme-aware at runtime.
 */
export type ColorToken =
  | "primary"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  | "chart-6"
  | "chart-7"
  | "chart-8"
  | "chart-9"
  | "chart-10"
  | "chart-11"
  | "chart-12";

/** All recognised token names in display order. */
export const COLOR_TOKENS: ColorToken[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "chart-9",
  "chart-10",
  "chart-11",
  "chart-12",
  "primary",
  "secondary",
  "destructive",
  "success",
  "warning",
  "info",
];

/**
 * Map a ColorToken → the Tailwind bg-* utility class that renders it.
 * These classes must be present as complete strings so Tailwind's JIT scanner
 * can detect them statically.
 */
const TOKEN_BG: Record<ColorToken, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
  "chart-6": "bg-chart-6",
  "chart-7": "bg-chart-7",
  "chart-8": "bg-chart-8",
  "chart-9": "bg-chart-9",
  "chart-10": "bg-chart-10",
  "chart-11": "bg-chart-11",
  "chart-12": "bg-chart-12",
  primary: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
};

function isColorToken(v: string): v is ColorToken {
  return Object.prototype.hasOwnProperty.call(TOKEN_BG, v);
}

// ---------------------------------------------------------------------------
// Sub-component: individual swatch button
// ---------------------------------------------------------------------------

interface SwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  token: ColorToken;
  selected: boolean;
  onSelect: (token: ColorToken) => void;
}

const Swatch = forwardRef<HTMLButtonElement, SwatchProps>(function Swatch(
  { token, selected, onSelect, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={token}
      onClick={() => onSelect(token)}
      className={cn(
        "size-7 rounded-md border-2 transition-[border-color,box-shadow] duration-fast",
        TOKEN_BG[token],
        selected
          ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
          : "border-transparent hover:border-foreground/40",
        "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
});

// ---------------------------------------------------------------------------
// Trigger swatch preview
// ---------------------------------------------------------------------------

interface TriggerSwatchProps {
  value: string;
  className?: string;
}

function TriggerSwatch({ value, className }: TriggerSwatchProps) {
  const bgClass = isColorToken(value) ? TOKEN_BG[value] : undefined;
  return (
    <span
      className={cn("inline-block size-4 rounded-sm border border-border", bgClass, className)}
      // When a raw hex value is supplied, use inline style — the only safe
      // place for a non-token color (isolated to this preview span).
      style={!bgClass ? { backgroundColor: value } : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /**
   * Controlled value — a `ColorToken` name (preferred, theme-aware) or a raw
   * hex string (only when `allowCustom` is true).
   */
  value?: ColorToken | string;
  /** Uncontrolled default value. */
  defaultValue?: ColorToken | string;
  /** Called when the selected color changes. */
  onValueChange?: (value: ColorToken | string) => void;
  /**
   * Swatches to display. Defaults to all chart + status tokens.
   * Accepts any subset of `ColorToken`.
   */
  swatches?: ColorToken[];
  /**
   * When true, a free-form hex input is shown below the swatches.
   * NOTE: custom hex values are NOT theme-aware — they will not adapt when
   * the active theme changes. Prefer token values for all theme-safe UI.
   */
  allowCustom?: boolean;
  /** aria-label for the trigger button. Defaults to "Pick color". */
  "aria-label"?: string;
}

/**
 * ColorPicker — a token-safe swatch picker backed by a Popover.
 *
 * The default value type is a `ColorToken` (a semantic CSS variable name),
 * not a hex string. This ensures the chosen color adapts to the active theme.
 * Raw hex is available opt-in via `allowCustom` — see the prop docs.
 *
 * Swatch group uses `role="radiogroup"` with arrow-key navigation.
 */
export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    swatches = COLOR_TOKENS,
    allowCustom = false,
    "aria-label": ariaLabel = "Pick color",
    className,
    ...props
  },
  ref,
) {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<ColorToken | string>(
    defaultValue ?? "chart-1",
  );
  const [customHex, setCustomHex] = useState("");
  const [open, setOpen] = useState(false);

  const current = isControlled ? (valueProp ?? "") : internalValue;

  const commit = useCallback(
    (next: ColorToken | string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const handleSwatchSelect = useCallback(
    (token: ColorToken) => {
      commit(token);
      setOpen(false);
    },
    [commit],
  );

  const handleCustomSubmit = useCallback(() => {
    const hex = customHex.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      commit(hex);
      setOpen(false);
    }
  }, [customHex, commit]);

  // Arrow-key navigation within the radiogroup
  const groupRef = useRef<HTMLDivElement>(null);
  const handleGroupKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = groupRef.current
      ? Array.from(groupRef.current.querySelectorAll<HTMLButtonElement>("[role=radio]"))
      : [];
    if (!buttons.length) return;
    const focused = document.activeElement as HTMLButtonElement;
    const idx = buttons.indexOf(focused);
    if (idx === -1) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    }
  }, []);

  return (
    <div ref={ref} className={cn("inline-flex", className)} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm",
              "transition-[color,box-shadow] duration-fast",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <TriggerSwatch value={current} />
            <span className="text-muted-foreground">{current || "None"}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-3" align="start">
          <div
            ref={groupRef}
            role="radiogroup"
            aria-label="Color swatches"
            className="flex flex-wrap gap-1.5"
            onKeyDown={handleGroupKeyDown}
          >
            {swatches.map((token) => (
              <Swatch
                key={token}
                token={token}
                selected={current === token}
                onSelect={handleSwatchSelect}
              />
            ))}
          </div>

          {allowCustom && (
            <div className="mt-3 border-t border-border pt-3">
              {/* Custom hex is NOT theme-aware — it will not adapt to theme changes. */}
              <p className="mb-1.5 text-xs text-muted-foreground">
                {/* #124: inline running text — ink rung, not the 3:1 mark rung. */}
                Custom hex <span className="text-warning-text">(not theme-aware)</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customHex}
                  placeholder="#3b82f6"
                  maxLength={7}
                  spellCheck={false}
                  aria-label="Custom hex color"
                  onChange={(e) => setCustomHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomSubmit();
                    }
                  }}
                  className={cn(
                    "h-8 w-28 rounded-md border border-input bg-background px-2 text-sm",
                    "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    "placeholder:text-muted-foreground",
                  )}
                />
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  className={cn(
                    "h-8 rounded-md border border-input bg-background px-2 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  )}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
});
