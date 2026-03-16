import type React from 'react';

interface BadgeProps {
  className?: string;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

const variantClasses = {
  default: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-foreground',
  success: 'bg-status-done text-status-done-foreground',
  warning: 'bg-status-todo text-status-todo-foreground',
  error: 'bg-destructive/10 text-destructive',
};

export const Badge = ({ className, variant = 'default', children }: BadgeProps) => {
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className || ''}`}>
      {children}
    </span>
  );
};
