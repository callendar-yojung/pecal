import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/50 shadow-sm ${className}`}
      {...props}
    />
  )
}

export function CardHeader({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 border-b border-gray-100 dark:border-gray-800 px-5 py-4 ${className}`}
      {...props}
    />
  )
}

export function CardTitle({ className = '', ...props }: CardProps) {
  return (
    <h4
      className={`text-base font-semibold text-gray-900 dark:text-gray-100 ${className}`}
      {...props}
    />
  )
}

export function CardDescription({ className = '', ...props }: CardProps) {
  return (
    <p
      className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}
      {...props}
    />
  )
}

export function CardContent({ className = '', ...props }: CardProps) {
  return (
    <div className={`px-5 py-4 ${className}`} {...props} />
  )
}

export function CardFooter({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4 ${className}`}
      {...props}
    />
  )
}

export function CardAction({ className = '', ...props }: CardProps) {
  return (
    <div className={`self-start ${className}`} {...props} />
  )
}
