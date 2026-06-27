import { LogoMark } from "./LogoMark";

interface Props {
  tagline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Wordmark({ tagline = false, size = "md", className = "" }: Props) {
  const logoSize = size === "sm" ? 20 : size === "lg" ? 40 : 28;
  const textClass =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={logoSize} className="text-primary" />
      <div>
        <span className={`font-heading font-semibold tracking-tight text-primary ${textClass}`}>
          betree
        </span>
        {tagline && (
          <p className="text-xs text-muted-foreground font-sans mt-0.5">Proof of care.</p>
        )}
      </div>
    </div>
  );
}
