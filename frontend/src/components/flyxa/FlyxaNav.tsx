import { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';

const subSectionLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748b',
};

const NAV_ITEMS = [
  { key: 'weekly',      label: 'Weekly debrief',       to: '/flyxa-ai',                        end: true  },
  { key: 'pattern',     label: 'Pattern library',       to: '/flyxa-ai/patterns',               end: false },
  { key: 'pre-session', label: 'Pre-session brief',     to: '/flyxa-ai/pre-session',            end: false },
  { key: 'emotional',   label: 'Emotional fingerprint', to: '/flyxa-ai/emotional-fingerprint',  end: false },
  { key: 'ask',         label: 'Ask Flyxa',             to: '/flyxa-ai/ask',                    end: false },
];

export default function FlyxaNav() {
  return (
    <aside
      className="min-h-0 overflow-y-auto border-r border-white/10 px-3 py-4"
      style={{ backgroundColor: '#080d18' }}
    >
      <p style={subSectionLabelStyle}>Flyxa AI</p>
      <nav className="mt-4 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.key} to={item.to} end={item.end}>
            {({ isActive }) => (
              <span
                className="flex w-full items-center gap-2 text-sm transition-colors"
                style={{
                  color: isActive ? '#c7d2fe' : '#94a3b8',
                  backgroundColor: isActive ? 'rgba(74,158,255,0.12)' : 'transparent',
                  borderRight: isActive ? '2px solid #4a9eff' : '2px solid transparent',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  display: 'flex',
                }}
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: isActive ? '#4a9eff' : '#64748b' }}
                />
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
