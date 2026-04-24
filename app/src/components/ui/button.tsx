"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, HTMLMotionProps } from "framer-motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-brand-orange to-brand-purple text-white font-semibold shadow-lg shadow-brand-purple/20",
  secondary:
    "bg-white border border-brand-border text-brand-ink hover:border-brand-purple/40",
  ghost: "text-brand-ink-soft hover:text-brand-ink hover:bg-brand-beige-dark",
  danger: "bg-red-50 border border-red-200 text-red-500 hover:bg-red-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm rounded-xl",
  md: "h-12 px-6 text-base rounded-2xl",
  lg: "h-14 px-8 text-lg rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      disabled={disabled || loading}
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center gap-2 transition-all duration-150 select-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </motion.button>
  );
}
