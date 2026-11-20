export function PinIcon({ filled = false, size = 14 }: { filled?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5M9 10.76V4h6v6.76l2.45 2.45A1 1 0 0 1 16.74 15H7.26a1 1 0 0 1-.71-1.71Z" />
    </svg>
  );
}
