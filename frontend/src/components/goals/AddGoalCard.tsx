interface AddGoalCardProps {
  onOpen: () => void;
}

export default function AddGoalCard({ onOpen }: AddGoalCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      style={{
        background: 'transparent',
        border: '1.5px dashed rgba(255,255,255,0.07)',
        borderRadius: 14,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        cursor: 'pointer',
        transition: 'border-color 0.18s ease, background 0.18s ease',
        padding: 24,
        textAlign: 'center',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'rgba(29,110,245,0.30)';
        el.style.background = 'rgba(29,110,245,0.04)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'rgba(255,255,255,0.07)';
        el.style.background = 'transparent';
      }}
    >
      {/* Icon box */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(29,110,245,0.10)',
          border: '1px solid rgba(29,110,245,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4v12M4 10h12" stroke="#4d8ef7" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      {/* Title */}
      <div>
        <p
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 16,
            color: 'rgba(226,232,240,0.50)',
            fontWeight: 400,
            margin: '0 0 6px',
          }}
        >
          Pin a new goal
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            color: 'rgba(148,163,184,0.40)',
            lineHeight: 1.55,
            maxWidth: 180,
          }}
        >
          Something you're building toward — even if it takes months.
        </p>
      </div>
    </div>
  );
}
