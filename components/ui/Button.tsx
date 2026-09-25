"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "lg" | "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-float hover:bg-primary-press",
  secondary: "border border-border bg-card text-foreground hover:bg-surface",
  ghost: "bg-transparent text-primary",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  lg: "h-[60px] rounded-[28px] px-6 text-[17px]",
  md: "h-[52px] rounded-[24px] px-5 text-[16px]",
  sm: "h-[42px] rounded-[18px] px-4 text-[14px]",
};

export function Button({
  variant = "primary",
  size = "lg",
  fullWidth = true,
  isLoading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={cn(
        "pressable inline-flex items-center justify-center gap-2 font-bold disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
