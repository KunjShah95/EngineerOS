"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

import { useThemeStore } from "@/lib/store/theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeStore((s) => s.theme)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" strokeWidth={1.75} />,
        info: <InfoIcon className="size-4" strokeWidth={1.75} />,
        warning: <TriangleAlertIcon className="size-4" strokeWidth={1.75} />,
        error: <OctagonXIcon className="size-4" strokeWidth={1.75} />,
        loading: <Loader2Icon className="size-4 animate-spin" strokeWidth={1.75} />,
      }}
      style={
        {
          "--normal-bg": "var(--bg-elevated)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-default)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
