"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

const variants: Record<string, string> = {
  primary: "text-white shadow-[0_8px_30px_rgba(191,90,242,0.35)]",
  secondary: "bg-white/8 text-foreground border border-white/10",
  ghost: "bg-transparent text-foreground",
  danger: "bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/30",
};

const sizes: Record<string, string> = {
  sm: "text-sm px-4 py-2 rounded-full",
  md: "text-[15px] px-5 py-3.5 rounded-2xl",
  lg: "text-base px-6 py-4 rounded-2xl",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={disabled ? {} : { scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled}
      className={cn(
        "font-semibold inline-flex items-center justify-center gap-2 transition-opacity active:opacity-90 disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      style={
        variant === "primary"
          ? { background: "var(--gradient-party)", ...props.style }
          : props.style
      }
      {...props}
    >
      {children}
    </motion.button>
  );
}
