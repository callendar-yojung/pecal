import type React from "react";
import { forwardRef } from "react";

// Cross-platform button props
export interface ButtonProps {
  className?: string;
  variant?: "default" | "muted" | "primary" | "danger";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  onPress?: () => void; // Mobile friendly
  onClick?: (e: any) => void; // Web friendly
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

// Shared design system mapping (using Tailwind classes common to both web and mobile via nativewind)
const variantClasses = {
  default: "bg-background border border-border text-foreground",
  muted: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
  danger: "bg-destructive text-destructive-foreground",
};

const sizeClasses = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
};

export const Button = forwardRef<any, ButtonProps>((
  { className, variant = "default", size = "md", onPress, onClick, children, ...props },
  ref
) => {
  const combinedClassName = `inline-flex items-center justify-center rounded-xl transition-opacity active:opacity-70 \${
    variantClasses[variant]
  } \${sizeClasses[size]} \${className || ""}`;

  return (
    <button
      ref={ref}
      onClick={onClick || onPress}
      className={combinedClassName}
      {...props}
    >
      {children}
    </button>
  );
});
