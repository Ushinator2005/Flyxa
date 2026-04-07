import { useId } from 'react';

interface FlyxaLogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  wordmarkClassName?: string;
  subtitleClassName?: string;
}

export default function FlyxaLogo({
  size = 48,
  showWordmark = false,
  subtitle,
  className = '',
  wordmarkClassName = '',
  subtitleClassName = '',
}: FlyxaLogoProps) {
  const gradientId = useId().replace(/:/g, '');
  const glowId = `${gradientId}-glow`;
  const strokeId = `${gradientId}-stroke`;

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-[28%] bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.7),rgba(59,130,246,0.18)_52%,transparent_76%)] blur-md opacity-90" />
        <svg
          viewBox="0 0 64 64"
          fill="none"
          className="brand-mark relative h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="12" y1="14" x2="53" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7dd3fc" />
              <stop offset="0.48" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#f97316" />
            </linearGradient>
            <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(25 20) rotate(51.245) scale(37.3499)">
              <stop stopColor="#e0f2fe" stopOpacity="0.95" />
              <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={strokeId} x1="10" y1="10" x2="53" y2="53" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity="0.28" />
              <stop offset="1" stopColor="white" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <rect x="5" y="5" width="54" height="54" rx="18" fill="#081120" />
          <rect x="5" y="5" width="54" height="54" rx="18" fill={`url(#${glowId})`} />
          <rect x="5.5" y="5.5" width="53" height="53" rx="17.5" stroke={`url(#${strokeId})`} />

          <path
            d="M16 44 28.7 16.9c.8-1.7 3-2.2 4.6-1.1l6.5 4.7c1.5 1.1 1.9 3.2.9 4.8L33 36.3h16.4c2 0 3 2.4 1.7 3.8L40.4 50.8c-.7.7-1.6 1.1-2.6 1.1H18.7c-2 0-3.4-2.1-2.7-3.9Z"
            fill={`url(#${gradientId})`}
          />
          <path
            d="M31.2 24.2 24.4 38h9.4l10.5-10.7H35c-1.4 0-2.7-.7-3.8-1.9Z"
            fill="white"
            fillOpacity="0.18"
          />
          <path
            d="M24.8 41.9h13.9"
            stroke="white"
            strokeOpacity="0.38"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showWordmark && (
        <div className="min-w-0">
          <div
            className={`auth-display text-xl font-bold tracking-[-0.04em] text-white ${wordmarkClassName}`.trim()}
          >
            Flyxa
          </div>
          {subtitle && (
            <div className={`text-sm text-slate-400 ${subtitleClassName}`.trim()}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
