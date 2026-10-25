import { Link } from "@tanstack/react-router";
import logo from "@/assets/trishna-logo.png";
import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  withText = true,
  subtitle,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  subtitle?: string;
  className?: string;
}) {
  const dim = size === "sm" ? 28 : size === "lg" ? 56 : 38;
  return (
    <Link to="/" className={cn("flex items-center gap-3", className)} aria-label="TRISHNA home">
      <img
        src={logo}
        alt="TRISHNA logo"
        width={dim}
        height={dim}
        style={{ width: dim, height: dim }}
        className="shrink-0"
      />
      {withText && (
        <span className="leading-tight">
          <span
            className={cn(
              "block font-display font-bold tracking-[0.18em] text-primary",
              size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg",
            )}
          >
            TRISHNA
          </span>
          {subtitle && <span className="block text-[11px] text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}
