interface FlyxaLogoProps {
  size?: number;
  showWordmark?: boolean;
  mode?: 'compact' | 'banner';
  subtitle?: string;
  className?: string;
  wordmarkClassName?: string;
  subtitleClassName?: string;
}

export default function FlyxaLogo({
  size = 48,
  showWordmark = false,
  mode = 'compact',
  subtitle,
  className = '',
  wordmarkClassName = '',
  subtitleClassName = '',
}: FlyxaLogoProps) {
  const palette = {
    bg: '#020913',
    lineDim: '#082b4a',
    lineBright: '#12a8f3',
    dot: '#12a8f3',
    word: '#d5dce6',
    subtitle: '#0e4b73',
  };

  const mark = (
    <svg viewBox="0 0 120 120" fill="none" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="0" width="120" height="120" fill={palette.bg} />
      <line x1="10" y1="72" x2="40" y2="72" stroke={palette.lineDim} strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="72" x2="68" y2="44" stroke={palette.lineBright} strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="44" x2="102" y2="44" stroke={palette.lineBright} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="72" r="5" fill={palette.dot} />
    </svg>
  );

  if (!showWordmark) {
    return (
      <div className={`relative shrink-0 ${className}`.trim()} style={{ width: size, height: size }}>
        {mark}
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div className={`inline-flex flex-col ${className}`.trim()}>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            {mark}
          </div>
          <div className={`auth-display text-xl font-bold leading-none tracking-[-0.04em] ${wordmarkClassName}`.trim()} style={{ color: palette.word }}>
            fly<span style={{ color: palette.lineBright }}>x</span>a
          </div>
        </div>
        <div className={`mt-2 w-full text-center text-[10px] uppercase tracking-[0.5em] ${subtitleClassName}`.trim()} style={{ color: palette.subtitle }}>
          {subtitle || 'Trading Intelligence'}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden ${className}`.trim()}
      style={{ backgroundColor: palette.bg, minHeight: Math.max(58, Math.round(size * 1.5)) }}
    >
      <svg viewBox="0 0 860 214" fill="none" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="126" x2="270" y2="126" stroke={palette.lineDim} strokeWidth="2" />
        <line x1="270" y1="126" x2="355" y2="56" stroke={palette.lineBright} strokeWidth="2.5" />
        <line x1="355" y1="56" x2="850" y2="56" stroke={palette.lineBright} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="178" x2="270" y2="178" stroke="#042240" strokeWidth="2" />
        <circle cx="270" cy="126" r="6.4" fill={palette.dot} />
        <circle cx="95" cy="178" r="2.8" fill="#062849" />
      </svg>

      <div className="relative flex items-center justify-center px-6 py-5">
        <div className="min-w-0 text-center">
          <div className={`auth-display text-xl font-bold leading-none tracking-[-0.04em] ${wordmarkClassName}`.trim()} style={{ color: palette.word }}>
            fly<span style={{ color: palette.lineBright }}>x</span>a
          </div>
          <div className={`mt-2 text-[10px] uppercase tracking-[0.5em] ${subtitleClassName}`.trim()} style={{ color: palette.subtitle }}>
            {subtitle || 'Trading Intelligence'}
          </div>
        </div>
      </div>
    </div>
  );
}
