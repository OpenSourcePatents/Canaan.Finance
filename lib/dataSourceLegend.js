// Canaan Finance — Data Source Legend
// Every data point in the app references one of these sources.
// Used for consistent badges, tooltips, and legend rendering everywhere.

export const SOURCE_LEGEND = {
  AR:  { code: 'AR',  label: 'Annual Report',         full: 'Annual Report — scholars.unh.edu',         color: '#22c55e',  icon: '📄' },
  MS5: { code: 'MS5', label: 'MS-535',                full: 'MS-535 Budget Filing',                     color: '#4a9eff',  icon: '📊' },
  MS7: { code: 'MS7', label: 'MS-737',                full: 'MS-737 Warrant Article',                   color: '#06b6d4',  icon: '📋' },
  VN:  { code: 'VN',  label: 'Valley News',           full: 'Valley News Reporting',                    color: '#ff8c00',  icon: '📰' },
  RSA: { code: 'RSA', label: 'RSA 91-A Response',     full: 'RSA 91-A Public Records Response',         color: '#a855f7',  icon: '⚖️' },
  GOV: { code: 'GOV', label: 'canaannh.gov',          full: 'canaannh.gov — Official Town Website',     color: '#d4d4d4',  icon: '🏛️' },
  JP:  { code: 'JP',  label: 'Job Posting',           full: 'Official Job Posting',                     color: '#ffd700',  icon: '📌' },
  PND: { code: 'PND', label: 'Pending',               full: 'Source not yet obtained — pending request',color: '#6b7280',  icon: '⏳' },
}

// Map free-text source strings from DB to legend codes
export function resolveSourceCode(sourceString) {
  if (!sourceString) return 'PND'
  const s = sourceString.toLowerCase()
  if (s.includes('annual report') || s.includes('scholars.unh')) return 'AR'
  if (s.includes('ms-535') || s.includes('ms535'))               return 'MS5'
  if (s.includes('ms-737') || s.includes('ms737'))               return 'MS7'
  if (s.includes('valley news'))                                  return 'VN'
  if (s.includes('rsa 91') || s.includes('91-a'))                return 'RSA'
  if (s.includes('canaannh.gov') || s.includes('town website'))  return 'GOV'
  if (s.includes('job posting') || s.includes('posting'))        return 'JP'
  return 'PND'
}

export function getSource(sourceString) {
  return SOURCE_LEGEND[resolveSourceCode(sourceString)] || SOURCE_LEGEND.PND
}

export function SourceBadge({ source, style = {} }) {
  const s = getSource(source)
  return (
    <span title={s.full} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
      padding: '2px 6px', borderRadius: 4,
      background: `${s.color}18`, color: s.color,
      border: `1px solid ${s.color}33`,
      cursor: 'default', fontFamily: "'JetBrains Mono', monospace",
      ...style
    }}>
      {s.icon} {s.code}
    </span>
  )
}

export function SourceLegendPanel() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 18px', marginTop: 16
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Data Source Legend</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.values(SOURCE_LEGEND).map(s => (
          <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SourceBadge source={s.full} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{s.full}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
