import { Paper } from '@mantine/core'
import type { ReactNode } from 'react'

export function AccentPaper({
  color,
  style,
  children,
  ...props
}: {
  color: string
  children?: ReactNode
  [key: string]: any
}) {
  return (
    <Paper
      {...props}
      style={{
        borderLeft: `3px solid var(--mantine-color-${color}-5)`,
        ...(style as React.CSSProperties),
      }}
    >
      {children}
    </Paper>
  )
}
