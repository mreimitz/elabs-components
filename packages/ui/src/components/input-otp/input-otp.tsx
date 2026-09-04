import { forwardRef, useContext, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";
import { cn } from "../../lib/cn";

export const InputOTP = forwardRef<
  ElementRef<typeof OTPInput>,
  ComponentPropsWithoutRef<typeof OTPInput>
>(function InputOTP({ className, containerClassName, ...props }, ref) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
});

export const InputOTPGroup = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function InputOTPGroup({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex items-center", className)} {...props} />;
  },
);

export const InputOTPSlot = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { index: number }
>(function InputOTPSlot({ index, className, ...props }, ref) {
  const ctx = useContext(OTPInputContext);
  const slot = ctx.slots[index];
  const { char, hasFakeCaret, isActive } = slot ?? {
    char: null,
    hasFakeCaret: false,
    isActive: false,
  };
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex size-9 items-center justify-center border-y border-e border-input text-sm shadow-sm transition-[color,border-color,box-shadow] duration-fast ease-standard first:rounded-s-md first:border-s last:rounded-e-md",
        // The OTP slot IS the field's focus indicator: the real focused element is
        // InputOTP's visually-hidden <input>, and `isActive` is the caret's slot. It
        // therefore carries the compound indicator (#67) — the state is JS-driven, so
        // it is the `-static` flavour rather than a `:focus-visible` one.
        isActive && "z-10 focus-ring-static",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground" />
        </div>
      )}
    </div>
  );
});

export const InputOTPSeparator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function InputOTPSeparator(props, ref) {
    return (
      <div ref={ref} role="separator" {...props}>
        <Minus className="size-4 text-muted-foreground" />
      </div>
    );
  },
);
