import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const baseClasses =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'border-transparent bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
  secondary:
    'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
  destructive:
    'border-transparent bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700',
  outline:
    'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200 bg-transparent',
}

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={[baseClasses, variantClasses[variant], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
