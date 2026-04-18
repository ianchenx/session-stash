import { cn } from "~lib/cn"

export function Logo({
  className,
  withBackground = true
}: {
  className?: string
  withBackground?: boolean
}) {
  const terracotta = "#C96E42"
  const warmCream = "#F7F4EA"

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}>
      {withBackground && (
        <rect width="100" height="100" rx="22" fill={warmCream} />
      )}
      <g stroke={terracotta} strokeWidth="6" strokeLinejoin="round">
        <rect x="22" y="32" width="48" height="36" rx="4" opacity="0.35" />
        <rect x="30" y="40" width="48" height="36" rx="4" opacity="0.65" />
      </g>
      <rect x="38" y="48" width="48" height="36" rx="4" fill={terracotta} />
      <circle cx="46" cy="66" r="3.2" fill={warmCream} />
    </svg>
  )
}
