// Canaan Finance — Theme System
// Three visual modes: Mirror, Report, Distinct
// User picks once, stored in localStorage, applied to all detail pages.

export const THEMES = {
  mirror: {
    id: 'mirror',
    name: 'Mirror',
    description: 'Matches the main page exactly',
    bg: '#090b0f',
    surface: 'rgba(255,255,255,0.03)',
    surfaceBorder: 'rgba(255,255,255,0.06)',
    surfaceHover: 'rgba(255,255,255,0.05)',
    header: 'linear-gradient(180deg, #101420, #090b0f)',
    headerBorder: 'rgba(255,255,255,0.06)',
    text: '#e0e0e0',
    textMuted: 'rgba(255,255,255,0.45)',
    textDim: 'rgba(255,255,255,0.25)',
    accent: '#22c55e',
    accentBlue: '#4a9eff',
    accentOrange: '#ff8c00',
    accentPurple: '#a855f7',
    accentRed: '#ff4444',
    accentGold: '#ffd700',
    mono: "'JetBrains Mono', monospace",
    sans: "'IBM Plex Sans', -apple-system, sans-serif",
    cardRadius: 12,
    statFontSize: 26,
    density: 'normal',
    sectionTitleSize: 14,
    rowPadding: '12px 16px',
  },

  report: {
    id: 'report',
    name: 'Report',
    description: 'Denser, document-style layout',
    bg: '#07090d',
    surface: 'rgba(255,255,255,0.025)',
    surfaceBorder: 'rgba(255,255,255,0.07)',
    surfaceHover: 'rgba(255,255,255,0.04)',
    header: 'linear-gradient(180deg, #0d1018, #07090d)',
    headerBorder: 'rgba(255,255,255,0.08)',
    text: '#d4d8e0',
    textMuted: 'rgba(212,216,224,0.5)',
    textDim: 'rgba(212,216,224,0.25)',
    accent: '#22c55e',
    accentBlue: '#4a9eff',
    accentOrange: '#ff8c00',
    accentPurple: '#a855f7',
    accentRed: '#ff4444',
    accentGold: '#ffd700',
    mono: "'JetBrains Mono', monospace",
    sans: "'IBM Plex Mono', monospace",
    cardRadius: 6,
    statFontSize: 22,
    density: 'dense',
    sectionTitleSize: 11,
    rowPadding: '8px 12px',
  },

  distinct: {
    id: 'distinct',
    name: 'Distinct',
    description: 'Bold layout, same brand colors',
    bg: '#060810',
    surface: 'rgba(255,255,255,0.04)',
    surfaceBorder: 'rgba(74,158,255,0.12)',
    surfaceHover: 'rgba(74,158,255,0.08)',
    header: 'linear-gradient(135deg, #0d1525, #060810)',
    headerBorder: 'rgba(74,158,255,0.15)',
    text: '#f0f4ff',
    textMuted: 'rgba(240,244,255,0.5)',
    textDim: 'rgba(240,244,255,0.25)',
    accent: '#22c55e',
    accentBlue: '#4a9eff',
    accentOrange: '#ff8c00',
    accentPurple: '#a855f7',
    accentRed: '#ff4444',
    accentGold: '#ffd700',
    mono: "'JetBrains Mono', monospace",
    sans: "'Space Grotesk', -apple-system, sans-serif",
    cardRadius: 16,
    statFontSize: 32,
    density: 'spacious',
    sectionTitleSize: 16,
    rowPadding: '16px 20px',
  },
}

export const DEFAULT_THEME = 'mirror'

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME]
}

export function ThemePicker({ current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Object.values(THEMES).map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          title={t.description}
          style={{
            border: current === t.id ? '1px solid rgba(74,158,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
            background: current === t.id ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: current === t.id ? '#4a9eff' : 'rgba(255,255,255,0.4)',
            borderRadius: 6, padding: '4px 10px', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase',
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'all 0.15s ease',
          }}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}

// Nav popover for clicking a name — opens in same tab, new tab, or side panel
export function NavPopover({ positionId, positionSlug, deptSlug, onSidePanel, onClose }) {
  return (
    <div style={{
      position: 'absolute', zIndex: 200,
      background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, padding: 10, minWidth: 200,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '2px 6px', marginBottom: 2 }}>Open profile</div>
      <a href={`/position/${positionId}`} style={navOptionStyle('#4a9eff')}>
        <span>↗</span> Same tab
      </a>
      <a href={`/position/${positionId}`} target="_blank" rel="noopener noreferrer" style={navOptionStyle('#22c55e')}>
        <span>⧉</span> New tab
      </a>
      <button onClick={() => { onSidePanel(positionId); onClose(); }} style={{ ...navOptionStyle('#ff8c00'), border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
        <span>▶</span> Side panel
      </button>
    </div>
  )
}

function navOptionStyle(color) {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 6,
    fontSize: 12, fontWeight: 600, color,
    background: `${color}11`, textDecoration: 'none',
    fontFamily: "'IBM Plex Sans', sans-serif",
    transition: 'background 0.1s',
  }
}
