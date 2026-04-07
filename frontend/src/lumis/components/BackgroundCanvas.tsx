import { ReactNode } from 'react';

type BackgroundCanvasProps = {
  children: ReactNode;
  className?: string;
  plain?: boolean;
};

export default function BackgroundCanvas({
  children,
  className = '',
  plain = false,
}: BackgroundCanvasProps) {
  const shellClassName = plain
    ? `relative overflow-hidden isolate ${className}`.trim()
    : `lumis-shell ${className}`.trim();

  return (
    <div className={shellClassName}>
      {!plain && <div className="lumis-grid-overlay" />}
      {!plain && <div className="lumis-orb lumis-orb--one" />}
      {!plain && <div className="lumis-orb lumis-orb--two" />}
      {!plain && <div className="lumis-orb lumis-orb--three" />}
      {!plain && <div className="lumis-orb lumis-orb--four" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
