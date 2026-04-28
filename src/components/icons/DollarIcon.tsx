interface IconProps {
  size?: number;
}

export default function DollarIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="6.5" x2="12" y2="17.5" />
      <path d="M15.25 9.25c-.6-1.1-1.85-1.75-3.25-1.75-1.93 0-3.5 1.12-3.5 2.5s1.57 2 3.5 2 3.5.62 3.5 2-1.57 2.5-3.5 2.5c-1.4 0-2.65-.65-3.25-1.75" />
    </svg>
  );
}
