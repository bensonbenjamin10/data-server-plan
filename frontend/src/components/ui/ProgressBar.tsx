import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  colorMode?: "auto" | "accent";
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
};

function getColor(percentage: number, mode: "auto" | "accent"): string {
  if (mode === "accent") return "bg-accent";
  if (percentage >= 90) return "bg-error";
  if (percentage >= 70) return "bg-warning";
  return "bg-accent";
}

export function ProgressBar({ value, max = 100, label, showPercentage = false, size = "md", colorMode = "auto" }: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div className="w-full space-y-1.5">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-text-muted">{label}</span>}
          {showPercentage && <span className="text-text-muted font-medium">{percentage}%</span>}
        </div>
      )}
      <div className={`w-full ${sizeClasses[size]} rounded-full bg-border/50 overflow-hidden`}>
        <motion.div
          className={`h-full rounded-full ${getColor(percentage, colorMode)}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </div>
  );
}
