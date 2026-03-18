import type { ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "error" | "admin" | "member" | "viewer";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-border/50 text-text-muted",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  admin: "bg-purple-500/15 text-purple-400",
  member: "bg-blue-500/15 text-blue-400",
  viewer: "bg-zinc-500/15 text-zinc-400",
};

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export function Badge({ children, variant = "default", size = "md" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const variant = role === "admin" ? "admin" : role === "member" ? "member" : "viewer";
  return <Badge variant={variant} size="sm">{role}</Badge>;
}
