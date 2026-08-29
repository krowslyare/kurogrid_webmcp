import Link from "next/link";

type KuroBrandProps = {
  href?: string;
  label?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
};

export function KuroMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M16 2.7 22.3 9 16 15.3 9.7 9Z" />
      <path d="M23 9.7 29.3 16 23 22.3 16.7 16Z" />
      <path d="M16 16.7 22.3 23 16 29.3 9.7 23Z" />
      <path d="M9 9.7 15.3 16 9 22.3 2.7 16Z" />
    </svg>
  );
}

export function KuroBrand({
  href = "/",
  label = "Kuro Agent",
  suffix = "by Kurogrid",
  className = "",
  ariaLabel = `${label}, home`,
}: KuroBrandProps) {
  return (
    <Link className={`kuro-brand ${className}`.trim()} href={href} aria-label={ariaLabel}>
      <KuroMark className="kuro-brand-mark" />
      <strong>{label}</strong>
      {suffix ? <em>{suffix}</em> : null}
    </Link>
  );
}
