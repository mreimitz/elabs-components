import {
  Children,
  forwardRef,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../../lib/cn";
import { initialsOf } from "../../lib/initials";

export const Avatar = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(function Avatar({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      data-slot="avatar"
      className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
});
export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full animate-in fade-in duration-base ease-entrance",
        className,
      )}
      {...props}
    />
  );
});

export interface AvatarFallbackProps extends ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Fallback
> {
  /**
   * A person's (or workspace's) display name — the fallback shows its
   * initials (`initialsOf`) when `children` is omitted, so consumers stop
   * carrying their own split/slice helper.
   */
  name?: string;
}

export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(function AvatarFallback({ className, name, children, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-meta font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children ?? (name ? initialsOf(name) : null)}
    </AvatarPrimitive.Fallback>
  );
});

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * How many avatars to show before collapsing the rest into a “+N” tail.
   * Omit to show every child.
   */
  max?: number;
  /**
   * The total the group stands for when the children are only a sample
   * (“+1,204”); defaults to the number of children.
   */
  total?: number;
  /** The `Avatar`s. Any `className` for size belongs on each child. */
  children?: ReactNode;
}

/**
 * A row of overlapping `Avatar`s — the “people on this” strip: each avatar
 * gets a background-coloured ring so the overlap reads, and anything past
 * `max` collapses into one “+N” fallback. Semantics: a `group`; give it an
 * `aria-label` naming who these are, and let each child's `AvatarImage`
 * carry its own `alt`.
 */
export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  { max, total, className, children, ...props },
  ref,
) {
  const items = Children.toArray(children).filter(isValidElement);
  const visible = max === undefined ? items : items.slice(0, max);
  const overflow = (total ?? items.length) - visible.length;
  return (
    <div
      ref={ref}
      role="group"
      data-slot="avatar-group"
      className={cn(
        "flex items-center -space-x-2 [&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background",
        className,
      )}
      {...props}
    >
      {visible}
      {overflow > 0 ? (
        <Avatar data-overflow="">
          <AvatarFallback className="tabular-nums">+{overflow}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
});
