import type { MascotStage } from '../../types/rivals.js';

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('mascot-kf')) {
  const s = document.createElement('style');
  s.id = 'mascot-kf';
  s.textContent = `
    @keyframes mascotFloat {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }
    @keyframes mascotPulse {
      0%, 100% { opacity: 0.55; transform: scaleX(1); }
      50% { opacity: 1; transform: scaleX(1.06); }
    }
    @keyframes mascotZzz {
      0% { opacity: 0; transform: translateY(0px) scale(0.7); }
      30% { opacity: 0.9; }
      80% { opacity: 0.5; }
      100% { opacity: 0; transform: translateY(-18px) scale(1.1); }
    }
    @keyframes mascotParticle {
      0%, 100% { opacity: 0.3; transform: translateY(0px); }
      50% { opacity: 0.9; transform: translateY(-5px); }
    }
    @keyframes bob {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    @keyframes spark {
      0% { opacity: 0; transform: scale(0.5) translateY(0px); }
      50% { opacity: 1; }
      100% { opacity: 0; transform: scale(1) translateY(-20px); }
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    @keyframes eyePulse {
      0%, 100% { opacity: 0.20; transform: scale(1); }
      50%       { opacity: 0.50; transform: scale(1.18); }
    }
    @keyframes breathe {
      0%, 100% { transform: scaleY(1); }
      45%      { transform: scaleY(1.035); }
    }
    @keyframes capeFlutterL {
      0%, 100% { transform: skewY(0deg) translateX(0px); }
      35%      { transform: skewY(2deg) translateX(-3px); }
      70%      { transform: skewY(-1deg) translateX(1px); }
    }
    @keyframes capeFlutterR {
      0%, 100% { transform: skewY(0deg) translateX(0px); }
      35%      { transform: skewY(-2deg) translateX(3px); }
      70%      { transform: skewY(1deg) translateX(-1px); }
    }
    @keyframes fistFlex {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.07); }
    }
    @keyframes hornGlow {
      0%, 100% { opacity: 0.30; transform: scale(1); }
      50%      { opacity: 0.60; transform: scale(1.25); }
    }
    @keyframes starSpin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes nostrilFlare {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.35); }
    }
    @keyframes earTwitch {
      0%, 88%, 100% { transform: rotate(0deg); }
      92%           { transform: rotate(-9deg); }
      96%           { transform: rotate(4deg); }
    }
    @keyframes knucklePulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.45; }
    }
  `;
  document.head.appendChild(s);
}

interface MascotCharacterProps {
  stage: MascotStage;
  health?: 'healthy' | 'tired' | 'sick' | 'critical';
  size?: number;
}

const HEALTH_FILTER: Record<string, string> = {
  healthy: 'none',
  tired: 'saturate(0.7)',
  sick: 'saturate(0.3) brightness(0.75)',
  critical: 'saturate(0) brightness(0.5)',
};

/* ─── Shared aura (used by seed / rookie / elite / apex) ─── */
function Aura({ color, health }: { color: string; health: string }) {
  if (health === 'critical') return null;
  const auraColor = health === 'sick' ? '#f59e0b' : color;
  return (
    <ellipse
      cx="80"
      cy="152"
      rx="44"
      ry="8"
      fill={auraColor}
      fillOpacity="0.20"
      style={{ animation: 'mascotPulse 3s ease-in-out infinite', transformOrigin: '80px 152px' }}
    />
  );
}

/* ─── Drooping horns for critical (legacy 160-space) ─── */
function DrooingHorns() {
  return (
    <g opacity="0.5">
      <path d="M62 30 Q52 42 46 52" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M98 30 Q108 42 114 52" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" fill="none" />
    </g>
  );
}

/* ─── Crack overlay (legacy 160-space, used by elite/apex) ─── */
function CrackOverlay() {
  return (
    <g>
      <path d="M76 72 L80 84 L73 90 L78 102" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M80 84 L84 88" stroke="#475569" strokeWidth="1" strokeLinecap="round" fill="none" />
    </g>
  );
}

/* ─── Sick overlay (legacy 160-space, used by elite/apex) ─── */
function SickOverlay() {
  return (
    <g>
      <line x1="69" y1="36" x2="77" y2="44" stroke="rgba(220,50,50,0.85)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="77" y1="36" x2="69" y2="44" stroke="rgba(220,50,50,0.85)" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/* ─── Tired Zzz (legacy 160-space, used by elite/apex) ─── */
function ZzzOverlay() {
  return (
    <g>
      <text
        x="99"
        y="24"
        fill="rgba(148,163,184,0.9)"
        fontSize="8"
        fontFamily="'DM Mono', monospace"
        style={{ animation: 'mascotZzz 2.2s ease-in-out infinite' }}
      >z</text>
      <text
        x="104"
        y="17"
        fill="rgba(148,163,184,0.6)"
        fontSize="6"
        fontFamily="'DM Mono', monospace"
        style={{ animation: 'mascotZzz 2.2s ease-in-out 0.8s infinite' }}
      >z</text>
    </g>
  );
}

/* ─── Veteran health overlays — adapted for 200×220 coordinate space ─── */
function VeteranZzzOverlay() {
  return (
    <g>
      <text x="158" y="38" fill="rgba(148,163,184,0.9)" fontSize="11" fontFamily="'DM Mono', monospace"
        style={{ animation: 'mascotZzz 2.2s ease-in-out infinite' }}>z</text>
      <text x="166" y="25" fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="'DM Mono', monospace"
        style={{ animation: 'mascotZzz 2.2s ease-in-out 0.8s infinite' }}>z</text>
    </g>
  );
}

function VeteranSickOverlay() {
  {/* X over left eye — left eye is at cx=82 cy=70 in 200×220 space */}
  return (
    <g>
      <line x1="74" y1="62" x2="90" y2="78" stroke="rgba(220,50,50,0.88)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="90" y1="62" x2="74" y2="78" stroke="rgba(220,50,50,0.88)" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function VeteranCrackOverlay() {
  {/* Crack on chest plate — chest is at x:74–126 y:108–146 in 200×220 space */}
  return (
    <g>
      <path d="M98 118 L104 133 L95 140 L101 155" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M104 133 L110 138" stroke="#475569" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </g>
  );
}

/* ─── SEED ─── */
function SeedBody() {
  return (
    <g>
      <ellipse cx="80" cy="92" rx="32" ry="40" fill="rgba(29,110,245,0.05)" stroke="rgba(29,110,245,0.14)" strokeWidth="1" />
      <ellipse cx="80" cy="92" rx="24" ry="32" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.5" />
      <ellipse cx="80" cy="82" rx="14" ry="16" fill="rgba(29,110,245,0.07)" />
      <path d="M68 74 Q80 68 92 74" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="74" cy="90" r="2" fill="rgba(29,110,245,0.40)" />
      <circle cx="86" cy="90" r="2" fill="rgba(29,110,245,0.40)" />
    </g>
  );
}

/* ─── ROOKIE ─── */
function RookieBody() {
  return (
    <g>
      <circle cx="80" cy="98" r="34" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.5" />
      <ellipse cx="67" cy="67" rx="5" ry="7" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.2" transform="rotate(-15,67,67)" />
      <ellipse cx="93" cy="67" rx="5" ry="7" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.2" transform="rotate(15,93,67)" />
      <circle cx="72" cy="94" r="5" fill="#1d6ef5" />
      <circle cx="88" cy="94" r="5" fill="#1d6ef5" />
      <circle cx="73.5" cy="92.5" r="2" fill="rgba(255,255,255,0.85)" />
      <circle cx="89.5" cy="92.5" r="2" fill="rgba(255,255,255,0.85)" />
      <ellipse cx="80" cy="104" rx="9" ry="7" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1" />
      <circle cx="77" cy="104" r="2.2" fill="rgba(29,110,245,0.50)" />
      <circle cx="83" cy="104" r="2.2" fill="rgba(29,110,245,0.50)" />
      <path d="M48 106 Q42 114 46 122" stroke="#1d6ef5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M112 106 Q118 114 114 122" stroke="#1d6ef5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="46" cy="124" r="4.5" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1" />
      <circle cx="114" cy="124" r="4.5" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1" />
    </g>
  );
}

/* ─── VETERAN BODY LEGACY — preserved for elite/apex to compose with ─── */
function VeteranBodyLegacy({ health = 'healthy' }: { health?: string }) {
  const isCritical = health === 'critical';
  return (
    <g>
      <path d="M64 116 Q63 130 61 140" stroke="#0a1624" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M64 116 Q63 130 61 140" stroke="#1d6ef5" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M96 116 Q97 130 99 140" stroke="#0a1624" strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M96 116 Q97 130 99 140" stroke="#1d6ef5" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M51 138 Q62 133 70 138 L72 148 Q60 152 50 148 Z" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.2" />
      <path d="M90 138 Q100 133 108 138 L110 148 Q98 152 88 148 Z" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.2" />
      <path d="M54 66 C54 54 66 56 80 56 C94 56 106 54 106 66 L106 116 C106 128 94 130 80 130 C66 130 54 128 54 116 Z" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.5" />
      <path d="M63 68 C71 64 89 64 97 68 L95 106 C87 110 73 110 65 106 Z" fill="rgba(13,29,56,0.9)" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <path d="M66 78 Q80 74 94 78" stroke="rgba(29,110,245,0.28)" strokeWidth="0.8" fill="none" />
      <path d="M66 90 Q80 86 94 90" stroke="rgba(29,110,245,0.28)" strokeWidth="0.8" fill="none" />
      <path d="M67 102 Q80 98 93 102" stroke="rgba(29,110,245,0.28)" strokeWidth="0.8" fill="none" />
      <ellipse cx="46" cy="73" rx="14" ry="10" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.3" />
      <path d="M35 73 L57 73" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <path d="M38 67 Q46 63 54 67" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" fill="none" />
      <ellipse cx="114" cy="73" rx="14" ry="10" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.3" />
      <path d="M103 73 L125 73" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <path d="M106 67 Q114 63 122 67" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" fill="none" />
      <path d="M46 80 Q39 95 37 110" stroke="#0a1624" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M46 80 Q39 95 37 110" stroke="#1d6ef5" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M114 80 Q121 95 123 110" stroke="#0a1624" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M114 80 Q121 95 123 110" stroke="#1d6ef5" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <rect x="26" y="108" width="18" height="15" rx="5" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.3" />
      <line x1="31" y1="108" x2="31" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <line x1="36" y1="108" x2="36" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <line x1="40" y1="108" x2="40" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <rect x="116" y="108" width="18" height="15" rx="5" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.3" />
      <line x1="121" y1="108" x2="121" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <line x1="126" y1="108" x2="126" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <line x1="130" y1="108" x2="130" y2="123" stroke="rgba(29,110,245,0.30)" strokeWidth="0.8" />
      <ellipse cx="80" cy="42" rx="23" ry="19" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.5" />
      <ellipse cx="58" cy="38" rx="7" ry="10" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.2" />
      <ellipse cx="58" cy="38" rx="4" ry="6" fill="rgba(29,110,245,0.14)" />
      <ellipse cx="102" cy="38" rx="7" ry="10" fill="#0a1624" stroke="#1d6ef5" strokeWidth="1.2" />
      <ellipse cx="102" cy="38" rx="4" ry="6" fill="rgba(29,110,245,0.14)" />
      {isCritical ? (
        <DrooingHorns />
      ) : (
        <>
          <path d="M62 30 Q50 20 42 10" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="M98 30 Q110 20 118 10" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="42" cy="10" r="5" fill="#93c5fd" />
          <circle cx="42" cy="10" r="9" fill="#60a5fa" fillOpacity="0.20" />
          <circle cx="118" cy="10" r="5" fill="#93c5fd" />
          <circle cx="118" cy="10" r="9" fill="#60a5fa" fillOpacity="0.20" />
        </>
      )}
      <circle cx="73" cy="40" r="6" fill="#1d6ef5" />
      <circle cx="87" cy="40" r="6" fill="#1d6ef5" />
      <circle cx="74.5" cy="38.5" r="2.5" fill="rgba(255,255,255,0.88)" />
      <circle cx="88.5" cy="38.5" r="2.5" fill="rgba(255,255,255,0.88)" />
      <ellipse cx="80" cy="54" rx="11" ry="8" fill="#0d1d38" stroke="#1d6ef5" strokeWidth="1.2" />
      <ellipse cx="75" cy="54" rx="3" ry="2.5" fill="rgba(29,110,245,0.50)" />
      <ellipse cx="85" cy="54" rx="3" ry="2.5" fill="rgba(29,110,245,0.50)" />
    </g>
  );
}

/* ─── VETERAN — redesigned amber bull (standalone, 200×220) ─── */
function VeteranStage({ health = 'healthy' }: { health?: string }) {
  const isCritical = health === 'critical';
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Ground glow ring */}
      <svg
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        width="160"
        height="24"
        viewBox="0 0 160 24"
      >
        <ellipse cx="80" cy="12" rx="70" ry="10" fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth="1.5"
          style={{ animation: 'glowPulse 2.5s ease-in-out infinite' }} />
        <ellipse cx="80" cy="12" rx="45" ry="6" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="1" />
      </svg>

      {/* Main mascot SVG */}
      <svg
        width="200"
        height="220"
        viewBox="0 0 200 220"
        fill="none"
        style={{ animation: 'bob 3.5s ease-in-out infinite', display: 'block', position: 'relative', zIndex: 1 }}
      >
        {/* Drop shadow */}
        <ellipse cx="100" cy="210" rx="52" ry="8" fill="rgba(0,0,0,0.5)" />

        {/* Cape left */}
        <g style={{ animation: 'capeFlutterL 3.8s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path d="M68 90 Q40 100 30 140 Q45 145 58 130 Q62 110 72 100Z" fill="#dc2626" opacity="0.9" />
          <path d="M70 92 Q48 108 38 138" stroke="rgba(255,100,100,0.4)" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Cape right */}
        <g style={{ animation: 'capeFlutterR 3.8s ease-in-out infinite 0.6s', transformBox: 'fill-box', transformOrigin: 'center' }}>
          <path d="M132 90 Q158 105 168 145 Q152 148 141 132 Q137 112 128 102Z" fill="#dc2626" opacity="0.9" />
          <path d="M150 118 Q166 128 170 148" stroke="rgba(255,100,100,0.4)" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Body base */}
        <ellipse cx="100" cy="130" rx="38" ry="42" fill="#92400e" />
        <ellipse cx="100" cy="130" rx="38" ry="42" fill="url(#bodyGrad)" opacity="0.9" />

        {/* Chest plate with breathe animation */}
        <g style={{ animation: 'breathe 3.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
          <rect x="74" y="108" width="52" height="38" rx="10" fill="#f59e0b" />
          <rect x="80" y="114" width="40" height="26" rx="7" fill="#fbbf24" />
          <line x1="100" y1="116" x2="100" y2="138" stroke="rgba(146,64,14,0.4)" strokeWidth="1.5" />
        </g>

        {/* Chest cobalt star emblem */}
        <polygon points="100,123 102,129 108,129 103,133 105,139 100,135 95,139 97,133 92,129 98,129" fill="#1d6ef5" opacity="0.9"
          style={{ animation: 'starSpin 9s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />

        {/* Shoulders */}
        <ellipse cx="62" cy="112" rx="16" ry="13" fill="#b45309" />
        <ellipse cx="62" cy="110" rx="12" ry="9" fill="#f59e0b" />
        <ellipse cx="138" cy="112" rx="16" ry="13" fill="#b45309" />
        <ellipse cx="138" cy="110" rx="12" ry="9" fill="#f59e0b" />

        {/* Arms */}
        <path d="M50 118 Q32 126 28 150" stroke="#92400e" strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d="M150 118 Q168 126 172 150" stroke="#92400e" strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d="M50 118 Q34 128 30 148" stroke="rgba(245,158,11,0.3)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M150 118 Q166 128 170 148" stroke="rgba(245,158,11,0.3)" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* Fists */}
        <circle cx="26" cy="154" r="14" fill="#b45309" />
        <circle cx="26" cy="152" r="11" fill="#f59e0b"
          style={{ animation: 'fistFlex 1.9s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <rect x="16" y="145" width="20" height="7" rx="3" fill="rgba(146,64,14,0.4)" />
        <circle cx="20" cy="148" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0s' }} />
        <circle cx="26" cy="147" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0.2s' }} />
        <circle cx="32" cy="148" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0.4s' }} />
        <circle cx="174" cy="154" r="14" fill="#b45309" />
        <circle cx="174" cy="152" r="11" fill="#f59e0b"
          style={{ animation: 'fistFlex 1.9s ease-in-out infinite 0.95s', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <rect x="164" y="145" width="20" height="7" rx="3" fill="rgba(146,64,14,0.4)" />
        <circle cx="168" cy="148" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0s' }} />
        <circle cx="174" cy="147" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0.2s' }} />
        <circle cx="180" cy="148" r="2.5" fill="#1d6ef5" style={{ animation: 'knucklePulse 1.4s ease-in-out infinite 0.4s' }} />

        {/* Legs */}
        <rect x="74" y="166" width="20" height="28" rx="8" fill="#92400e" />
        <rect x="106" y="166" width="20" height="28" rx="8" fill="#92400e" />

        {/* Boots */}
        <rect x="70" y="186" width="28" height="14" rx="6" fill="#1e1208" />
        <rect x="102" y="186" width="28" height="14" rx="6" fill="#1e1208" />
        <ellipse cx="84" cy="199" rx="12" ry="4" fill="#f59e0b" opacity="0.6" />
        <ellipse cx="116" cy="199" rx="12" ry="4" fill="#f59e0b" opacity="0.6" />

        {/* Head */}
        <ellipse cx="100" cy="76" rx="32" ry="30" fill="#92400e" />
        <ellipse cx="100" cy="74" rx="30" ry="27" fill="#b45309" />

        {/* Horns — normal or drooping for critical */}
        {isCritical ? (
          <g opacity="0.45">
            <path d="M72 58 Q52 72 46 86" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M72 58 Q52 72 46 86" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
            <path d="M128 58 Q148 72 154 86" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M128 58 Q148 72 154 86" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
          </g>
        ) : (
          <>
            <path d="M72 58 Q52 34 48 18" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M72 58 Q52 34 48 18" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
            <path d="M128 58 Q148 34 152 18" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M128 58 Q148 34 152 18" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
            <circle cx="48" cy="18" r="6" fill="#fbbf24" />
            <circle cx="48" cy="18" r="10" fill="rgba(251,191,36,0.3)"
              style={{ animation: 'hornGlow 2.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle cx="152" cy="18" r="6" fill="#fbbf24" />
            <circle cx="152" cy="18" r="10" fill="rgba(251,191,36,0.3)"
              style={{ animation: 'hornGlow 2.2s ease-in-out infinite 1.1s', transformBox: 'fill-box', transformOrigin: 'center' }} />
          </>
        )}

        {/* Muzzle */}
        <ellipse cx="100" cy="90" rx="18" ry="13" fill="#7c3a0e" opacity="0.8" />
        <ellipse cx="94" cy="91" rx="4" ry="3.5" fill="#3d1a06"
          style={{ animation: 'nostrilFlare 3s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <ellipse cx="106" cy="91" rx="4" ry="3.5" fill="#3d1a06"
          style={{ animation: 'nostrilFlare 3s ease-in-out infinite 1.5s', transformBox: 'fill-box', transformOrigin: 'center' }} />

        {/* Eyes with cobalt glow */}
        <ellipse cx="82" cy="70" rx="9" ry="9" fill="#0a0f1e" />
        <ellipse cx="118" cy="70" rx="9" ry="9" fill="#0a0f1e" />
        <ellipse cx="82" cy="70" rx="6" ry="6" fill="#1d6ef5" />
        <ellipse cx="118" cy="70" rx="6" ry="6" fill="#1d6ef5" />
        <ellipse cx="82" cy="70" rx="3" ry="3" fill="#0a1530" />
        <ellipse cx="118" cy="70" rx="3" ry="3" fill="#0a1530" />
        <circle cx="84" cy="68" r="1.5" fill="white" opacity="0.9" />
        <circle cx="120" cy="68" r="1.5" fill="white" opacity="0.9" />
        <ellipse cx="82" cy="70" rx="11" ry="11" fill="rgba(29,110,245,0.2)"
          style={{ animation: 'eyePulse 2.5s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <ellipse cx="118" cy="70" rx="11" ry="11" fill="rgba(29,110,245,0.2)"
          style={{ animation: 'eyePulse 2.5s ease-in-out infinite 1.25s', transformBox: 'fill-box', transformOrigin: 'center' }} />

        {/* Eyebrows */}
        <path d="M74 62 Q82 58 90 60" stroke="#3d1a06" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M110 60 Q118 58 126 62" stroke="#3d1a06" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Ears */}
        <ellipse cx="68" cy="72" rx="8" ry="10" fill="#b45309" />
        <ellipse cx="68" cy="72" rx="5" ry="7" fill="#dc8a4a"
          style={{ animation: 'earTwitch 5s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <ellipse cx="132" cy="72" rx="8" ry="10" fill="#b45309" />
        <ellipse cx="132" cy="72" rx="5" ry="7" fill="#dc8a4a"
          style={{ animation: 'earTwitch 5s ease-in-out infinite 2.5s', transformBox: 'fill-box', transformOrigin: 'center' }} />

        {/* Floating sparks */}
        <circle cx="36" cy="75" r="2.5" fill="#fbbf24" style={{ animation: 'spark 2.2s ease-in-out infinite 0s' }} />
        <circle cx="164" cy="80" r="2" fill="#1d6ef5" style={{ animation: 'spark 2.8s ease-in-out infinite 0.4s' }} />
        <circle cx="30" cy="110" r="1.5" fill="#fbbf24" style={{ animation: 'spark 3.1s ease-in-out infinite 1s' }} />
        <circle cx="170" cy="100" r="2" fill="#fbbf24" style={{ animation: 'spark 2.5s ease-in-out infinite 0.7s' }} />

        {/* Health overlays (in 200×220 coordinate space) */}
        {health === 'tired' && <VeteranZzzOverlay />}
        {health === 'sick' && <VeteranSickOverlay />}
        {isCritical && <VeteranCrackOverlay />}

        <defs>
          <radialGradient id="bodyGrad" cx="40%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#92400e" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ─── ELITE (VeteranBodyLegacy + lightning + particles) ─── */
function EliteBody({ health = 'healthy' }: { health?: string }) {
  return (
    <g>
      <VeteranBodyLegacy health={health} />
      <path d="M80 68 L74 84 L80 82 L74 100" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M64 86 Q68 84 72 86" stroke="rgba(167,139,250,0.5)" strokeWidth="0.9" fill="none" />
      <path d="M88 86 Q92 84 96 86" stroke="rgba(167,139,250,0.5)" strokeWidth="0.9" fill="none" />
      <circle cx="42" cy="10" r="12" fill="#60a5fa" fillOpacity="0.14" />
      <circle cx="118" cy="10" r="12" fill="#60a5fa" fillOpacity="0.14" />
      <circle cx="28" cy="70" r="2.5" fill="#7c3aed" fillOpacity="0.7" style={{ animation: 'mascotParticle 2.4s ease-in-out infinite' }} />
      <circle cx="132" cy="80" r="2" fill="#1d6ef5" fillOpacity="0.8" style={{ animation: 'mascotParticle 2.4s ease-in-out 0.6s infinite' }} />
      <circle cx="22" cy="100" r="1.8" fill="#a78bfa" fillOpacity="0.7" style={{ animation: 'mascotParticle 2.4s ease-in-out 1.2s infinite' }} />
      <circle cx="138" cy="60" r="2.2" fill="#60a5fa" fillOpacity="0.6" style={{ animation: 'mascotParticle 2.4s ease-in-out 1.8s infinite' }} />
    </g>
  );
}

/* ─── APEX (elite + crown + gold scheme) ─── */
function ApexBody({ health = 'healthy' }: { health?: string }) {
  return (
    <g>
      <EliteBody health={health} />
      <path d="M62 24 L62 14 L69 20 L80 10 L91 20 L98 14 L98 24 Z" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
      <circle cx="80" cy="12" r="3" fill="#e11d48" />
      <circle cx="69" cy="20" r="2" fill="#1d6ef5" />
      <circle cx="91" cy="20" r="2" fill="#1d6ef5" />
      <ellipse cx="80" cy="152" rx="52" ry="10" fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.4" />
      <circle cx="16" cy="88" r="2" fill="#f59e0b" fillOpacity="0.7" style={{ animation: 'mascotParticle 2s ease-in-out 0.3s infinite' }} />
      <circle cx="144" cy="92" r="2" fill="#fbbf24" fillOpacity="0.7" style={{ animation: 'mascotParticle 2s ease-in-out 0.9s infinite' }} />
    </g>
  );
}

/* ─── Main component ─── */
export default function MascotCharacter({ stage, health = 'healthy', size = 160 }: MascotCharacterProps) {
  const cssFilter = HEALTH_FILTER[health] ?? 'none';

  // Veteran gets its own standalone SVG (200×220 with bob animation)
  if (stage === 'veteran') {
    return (
      <div style={{ display: 'inline-block', filter: cssFilter }}>
        <VeteranStage health={health} />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      style={{ filter: cssFilter, display: 'block', overflow: 'visible' }}
    >
      <Aura color="#1d6ef5" health={health} />

      <g style={{ animation: 'mascotFloat 4s ease-in-out infinite' }}>
        {stage === 'seed' && <SeedBody />}
        {stage === 'rookie' && <RookieBody />}
        {stage === 'elite' && <EliteBody health={health} />}
        {stage === 'apex' && <ApexBody health={health} />}

        {health === 'tired' && <ZzzOverlay />}
        {health === 'sick' && stage !== 'seed' && stage !== 'rookie' && <SickOverlay />}
        {health === 'critical' && stage !== 'seed' && stage !== 'rookie' && <CrackOverlay />}
      </g>
    </svg>
  );
}
