'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { SourceBadge, SourceLegendPanel } from '../../../lib/dataSourceLegend'
import { ThemePicker, getTheme } from '../../../lib/themes'

function fmtCurrency(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtRate(n) {
  if (!n) return '—'
  return '$' + Number(n).toFixed(2) + '/hr'
}

const STATUS_STYLES = {
  active:     { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Active' },
  vacant:     { bg: 'rgba(255,68,68,0.15)',  color: '#ff4444', label: 'Vacant' },
  interim:    { bg: 'rgba(255,140,0,0.15)',  color: '#ff8c00', label: 'Interim' },
  contracted: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7', label: 'Contracted' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active
  return <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
}

function DisclaimerBlock({ status }) {
  if (!status) return null
  const isVacant = status === 'vacant'
  const msg = isVacant
    ? 'Position currently vacant — budgeted amount may not reflect actual town spend for this line.'
    : 'Actual cost may vary due to earned time, leave, vacancies, and mid-year budget adjustments.'
  const c = isVacant ? '#ff4444' : '#6b7280'
  return (
    <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: `${c}0d`, border: `1px solid ${c}22`, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
      <strong style={{ color: c }}>{isVacant ? '⚠ Vacancy Notice:' : '📋 Budget Note:'}</strong>{' '}{msg}
    </div>
  )
}

// Simple SVG pie chart — no external deps
function PieChart({ slices, size = 160, label }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return null
  let cumAngle = -Math.PI / 2
  const cx = size / 2, cy = size / 2, r = size / 2 - 8

  const paths = slices.map((sl, i) => {
    const angle = (sl.value / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(cumAngle)
    const y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle)
    const y2 = cy + r * Math.sin(cumAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: sl.color, label: sl.label, pct: ((sl.value / total) * 100).toFixed(1) }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke="#090b0f" strokeWidth={2} />)}
        {label && <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10} fontFamily="'IBM Plex Sans'">{label}</text>}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {paths.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{p.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: p.color, fontFamily: "'JetBrains Mono'" }}>{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Simple SVG line chart — no external deps
function LineChart({ points, color = '#4a9eff', width = 500, height = 120, yLabel = '' }) {
  if (!points || points.length < 2) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 20 }}>Not enough data for chart.</div>
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys) * 0.95, maxY = Math.max(...ys) * 1.05
  const pad = { top: 16, right: 16, bottom: 28, left: 60 }
  const W = width - pad.left - pad.right
  const H = height - pad.top - pad.bottom
  const px = x => pad.left + ((x - minX) / (maxX - minX || 1)) * W
  const py = y => pad.top + H - ((y - minY) / (maxY - minY || 1)) * H
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x)} ${py(p.y)}`).join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad.top + H * t
        const val = maxY - t * (maxY - minY)
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + W} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="'JetBrains Mono'">
              {val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val.toFixed(0)}`}
            </text>
          </g>
        )
      })}
      {/* X labels */}
      {points.map((p, i) => (
        <text key={i} x={px(p.x)} y={height - 6} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="'JetBrains Mono'">{p.x}</text>
      ))}
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={px(p.x)} cy={py(p.y)} r={4} fill={color} />
          <text x={px(p.x)} y={py(p.y) - 10} textAnchor="middle" fill={color} fontSize={9} fontFamily="'JetBrains Mono'" fontWeight="700">
            {p.y >= 1000 ? `$${(p.y / 1000).toFixed(0)}k` : `$${p.y}`}
          </text>
        </g>
      ))}
    </svg>
  )
}

// Ranking bar — shows position rank among all employees for a category
function RankBar({ rank, total, label, color = '#4a9eff' }) {
  if (!rank || !total) return null
  const pct = ((total - rank + 1) / total) * 100
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'JetBrains Mono'" }}>#{rank} of {total}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// Compare selector
function ComparePanel({ currentPos, allPositions, theme }) {
  const [compareId, setCompareId] = useState('')
  const comparePos = allPositions.find(p => String(p.id) === String(compareId))
  const fields = [
    { label: 'Annual Salary', fn: p => fmtCurrency(p.salary), raw: p => p.salary },
    { label: 'Hours / Week', fn: p => p.hours_per_week ? `${p.hours_per_week} hrs` : '—', raw: p => p.hours_per_week },
    { label: 'Effective Rate', fn: p => p.hours_per_week ? fmtRate(p.salary / (p.hours_per_week * 52)) : '—', raw: p => p.hours_per_week ? p.salary / (p.hours_per_week * 52) : 0 },
    { label: 'FTE Rate (40hr)', fn: p => fmtRate(p.salary / (40 * 52)), raw: p => p.salary / (40 * 52) },
    { label: 'Est. Loaded Cost', fn: p => { const b = p.employment_type === 'employee' ? p.salary * ((p.benefits_pct || 35) / 100) : 0; return fmtCurrency(p.salary + b) }, raw: p => { const b = p.employment_type === 'employee' ? p.salary * ((p.benefits_pct || 35) / 100) : 0; return p.salary + b } },
  ]

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Compare to Another Position</div>
      <select
        value={compareId}
        onChange={e => setCompareId(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#1a1d2e', color: '#fff', fontSize: 12, marginBottom: 16 }}
      >
        <option value="">Select a position...</option>
        {allPositions.filter(p => p.id !== currentPos.id).map(p => (
          <option key={p.id} value={p.id}>{p.name || p.title} — {p.departments?.name}</option>
        ))}
      </select>

      {comparePos && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>Category</div>
            <div style={{ fontSize: 10, color: '#4a9eff', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>{currentPos.name || currentPos.title}</div>
            <div style={{ fontSize: 10, color: '#ff8c00', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>{comparePos.name || comparePos.title}</div>
          </div>
          {fields.map((f, i) => {
            const aVal = f.raw(currentPos), bVal = f.raw(comparePos)
            const aWins = aVal > bVal
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{f.label}</div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: aWins ? '#22c55e' : '#4a9eff', fontFamily: "'JetBrains Mono'" }}>{f.fn(currentPos)}</div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: !aWins ? '#22c55e' : '#ff8c00', fontFamily: "'JetBrains Mono'" }}>{f.fn(comparePos)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function PositionDetail() {
  const params = useParams()
  const id = params?.id
  const [pos, setPos] = useState(null)
  const [allPositions, setAllPositions] = useState([])
  const [history, setHistory] = useState([])
  const [meetingData, setMeetingData] = useState([])
  const [allMeetingData, setAllMeetingData] = useState([])
  const [loading, setLoading] = useState(true)
  const [benefitsPct, setBenefitsPct] = useState(35)
  const [themeId, setThemeId] = useState('mirror')
  const [showLegend, setShowLegend] = useState(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cf_theme') : null
    if (saved) setThemeId(saved)
  }, [])

  const handleThemeChange = (t) => {
    setThemeId(t)
    if (typeof window !== 'undefined') localStorage.setItem('cf_theme', t)
  }

  const theme = getTheme(themeId)

  useEffect(() => {
    if (!id) return
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    const [posRes, allPosRes, histRes, meetRes, allMeetRes] = await Promise.all([
      supabase.from('positions').select('*, departments(name, slug)').eq('id', id).single(),
      supabase.from('positions').select('*, departments(name, slug)').eq('year', new Date().getFullYear()).order('salary', { ascending: false }),
      supabase.from('position_history').select('*').eq('dept_id', null).order('year', { ascending: true }),
      supabase.from('official_attendance_summary').select('*').eq('town_id', 1).order('total_documented_hours', { ascending: false }),
      supabase.from('official_attendance_summary').select('*').eq('town_id', 1).order('total_documented_hours', { ascending: false }),
    ])
    const p = posRes.data
    setPos(p)
    setBenefitsPct(p?.benefits_pct || 35)
    setAllPositions(allPosRes.data || [])
    // Filter history to same position title in same dept
    const filteredHist = (histRes.data || []).filter(h => h.title?.toLowerCase() === p?.title?.toLowerCase())
    setHistory(filteredHist)
    // Find official in meeting data
    const officials = meetRes.data || []
    setAllMeetingData(officials)
    if (p?.name) {
      const lastName = p.name.split(' ').pop().toLowerCase()
      setMeetingData(officials.filter(m => m.official.toLowerCase().includes(lastName)))
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#090b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Loading position data...
    </div>
  )

  if (!pos) return (
    <div style={{ minHeight: '100vh', background: '#090b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Position not found. <a href="/" style={{ color: '#4a9eff', marginLeft: 8 }}>← Back</a>
    </div>
  )

  const hourly = pos.hours_per_week ? pos.salary / (pos.hours_per_week * 52) : null
  const fteRate = pos.salary / (40 * 52)
  const isCon = pos.employment_type === 'contractor'
  const bCost = isCon ? 0 : Math.round(pos.salary * (benefitsPct / 100))
  const loadedCost = pos.salary + bCost
  const official = meetingData[0]

  // Rankings
  const salaryRank = allPositions.findIndex(p => p.id === pos.id) + 1
  const hourlyRanked = [...allPositions].sort((a, b) => {
    const aH = a.hours_per_week ? a.salary / (a.hours_per_week * 52) : 0
    const bH = b.hours_per_week ? b.salary / (b.hours_per_week * 52) : 0
    return bH - aH
  })
  const hourlyRank = hourlyRanked.findIndex(p => p.id === pos.id) + 1
  const loadedRanked = [...allPositions].sort((a, b) => {
    const aL = a.salary + (a.employment_type === 'employee' ? a.salary * ((a.benefits_pct || 35) / 100) : 0)
    const bL = b.salary + (b.employment_type === 'employee' ? b.salary * ((b.benefits_pct || 35) / 100) : 0)
    return bL - aL
  })
  const loadedRank = loadedRanked.findIndex(p => p.id === pos.id) + 1
  const meetingRanked = [...allMeetingData].sort((a, b) => b.total_documented_hours - a.total_documented_hours)
  const meetingRank = official ? meetingRanked.findIndex(m => m.official === official.official) + 1 : null

  // Salary history line chart
  const salaryHistory = history.length > 0
    ? history.map(h => ({ x: h.year, y: h.salary }))
    : [{ x: pos.year || 2026, y: pos.salary }]

  // Meeting pie: this official vs all others
  const totalMeetingHours = allMeetingData.reduce((s, m) => s + (m.total_documented_hours || 0), 0)
  const officialHours = official?.total_documented_hours || 0
  const pieSlices = officialHours > 0 ? [
    { label: pos.name || 'This official', value: officialHours, color: '#4a9eff' },
    { label: 'All others', value: Math.max(0, totalMeetingHours - officialHours), color: 'rgba(255,255,255,0.1)' },
  ] : []

  // Benefits pie
  const benPie = !isCon ? [
    { label: 'Base Salary', value: pos.salary, color: '#22c55e' },
    { label: 'Benefits (est.)', value: bCost, color: '#4a9eff' },
  ] : []

  const T = theme

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.sans, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>

      {/* Header */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.headerBorder}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ fontSize: 11, color: T.accentBlue, textDecoration: 'none', fontWeight: 700 }}>← CANAAN FINANCE</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>{pos.departments?.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>{pos.name || pos.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemePicker current={themeId} onChange={handleThemeChange} />
            <button onClick={() => setShowLegend(!showLegend)} style={{ border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: showLegend ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)', color: showLegend ? '#ffd700' : T.textMuted, fontSize: 10, fontWeight: 700, fontFamily: T.sans }}>
              {showLegend ? 'Hide' : 'Source'} Legend
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Hero header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: T.statFontSize + 4, fontWeight: 900, color: T.text, letterSpacing: -1, lineHeight: 1.1 }}>{pos.name || '—'}</div>
              <div style={{ fontSize: 15, color: T.textMuted, marginTop: 4 }}>{pos.title}</div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{pos.departments?.name} · {pos.year}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {pos.status && <StatusBadge status={pos.status} />}
                {isCon && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 6px', borderRadius: 4, background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>No Benefits</span>}
                {pos.source && <SourceBadge source={pos.source} />}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Annual Salary', value: fmtCurrency(pos.salary), c: T.text },
                { label: 'Hours / Week', value: pos.hours_per_week ? `${pos.hours_per_week} hrs` : '—', c: T.accentBlue },
                { label: 'Effective Rate', value: hourly ? fmtRate(hourly) : '—', c: T.accentOrange },
                { label: 'Rate at 40hr FTE', value: fmtRate(fteRate), c: T.textMuted },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: T.statFontSize, fontWeight: 800, color: s.c, fontFamily: T.mono, letterSpacing: -1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showLegend && <SourceLegendPanel />}
        <DisclaimerBlock status={pos.status} />

        {/* ── SECTION GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 20 }}>

          {/* The Math */}
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>The Math</div>
            {pos.hours_per_week ? (
              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.8 }}>
                <div><strong style={{ color: T.accentBlue }}>{pos.hours_per_week} hrs/week</strong> × 52 weeks = <strong>{(pos.hours_per_week * 52).toLocaleString()} hours/year</strong></div>
                <div>{fmtCurrency(pos.salary)} ÷ {(pos.hours_per_week * 52).toLocaleString()} hrs = <strong style={{ color: T.accentOrange }}>{fmtRate(hourly)}</strong> effective rate</div>
                {pos.hours_per_week < 40 && <div style={{ marginTop: 6, color: T.textMuted }}>Working <strong>{40 - pos.hours_per_week} fewer hours/week</strong> than a standard 40hr FTE.</div>}
                <div style={{ marginTop: 6 }}>At 40hr FTE: {fmtCurrency(pos.salary)} ÷ 2,080 hrs = <strong style={{ color: T.textMuted }}>{fmtRate(fteRate)}</strong></div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textDim }}>Hours not documented — hourly rate cannot be calculated.</div>
            )}
          </div>

          {/* True Cost */}
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>True Cost to Town</div>
            {isCon ? (
              <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.8 }}>
                <div>As a <strong style={{ color: '#a855f7' }}>{pos.employment_type}</strong>, the town pays <strong>{fmtCurrency(pos.salary)}</strong> with no benefits, retirement, or insurance costs.</div>
                <div style={{ marginTop: 8 }}>Comparable FTE at same salary: approx. <strong style={{ color: T.accentOrange }}>{fmtCurrency(Math.round(pos.salary * 1.35))}</strong> fully loaded (est. 35%).</div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>Base Salary</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{fmtCurrency(pos.salary)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: T.textMuted }}>Benefits ({benefitsPct}%)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.accentBlue, fontFamily: T.mono }}>{fmtCurrency(bCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${T.surfaceBorder}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Total Loaded Cost</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.accent, fontFamily: T.mono }}>{fmtCurrency(loadedCost)}</span>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min="0" max="50" value={benefitsPct} onChange={e => setBenefitsPct(Number(e.target.value))} style={{ flex: 1, height: 3, accentColor: T.accentBlue }} />
                  {[30, 35].map(p => (
                    <button key={p} onClick={() => setBenefitsPct(p)} style={{ border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 9, fontWeight: 700, borderRadius: 4, background: benefitsPct === p ? `${T.accentBlue}33` : T.surface, color: benefitsPct === p ? T.accentBlue : T.textDim, fontFamily: T.sans }}>{p}%</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Benefits breakdown pie */}
          {!isCon && benPie.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
              <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>Benefits Breakdown</div>
              <PieChart slices={benPie} size={140} />
            </div>
          )}

          {/* Meeting attendance */}
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>Documented Meeting Hours</div>
            {official ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Meetings Attended', value: official.meetings_attended, c: T.accentBlue },
                    { label: 'Documented Hours', value: `${official.total_documented_hours} hrs`, c: T.accent },
                    { label: 'Committees', value: official.committees?.length || 0, c: T.accentOrange },
                    { label: 'Date Range', value: `${official.first_meeting} — ${official.last_meeting}`, c: T.textMuted },
                  ].map((s, i) => (
                    <div key={i} style={{ background: `${T.accentBlue}08`, border: `1px solid ${T.accentBlue}15`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: i === 3 ? 10 : 16, fontWeight: 700, color: s.c, fontFamily: T.mono }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {official.committees?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {official.committees.map((c, i) => <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: `${T.accentBlue}12`, color: T.accentBlue }}>{c}</span>)}
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 10, color: T.textDim, fontStyle: 'italic' }}>
                  Note: Documented public meeting time only. Does not include prep, travel, training, or non-public sessions. Actual hours likely higher.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: T.textDim }}>No meeting records found for this official. May not attend public meetings or name not matched in minutes.</div>
            )}
          </div>

          {/* Meeting participation pie */}
          {pieSlices.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
              <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>Meeting Participation Share</div>
              <PieChart slices={pieSlices} size={140} label="of total hrs" />
            </div>
          )}

          {/* Budgeted vs Actual */}
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 14 }}>Budgeted vs Actual</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Budgeted Amount', value: pos.budgeted_amount, src: 'MS5' },
                { label: 'Actual Expenditure', value: pos.actual_expenditure, src: pos.actual_expenditure ? 'AR' : 'PND' },
              ].map((s, i) => (
                <div key={i} style={{ background: `rgba(255,255,255,0.02)`, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>{s.label}</div>
                  {s.value ? (
                    <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? T.text : T.accent, fontFamily: T.mono }}>{fmtCurrency(s.value)}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>— <span style={{ fontSize: 9, color: '#6b7280' }}>⏳ pending RSA 91-A</span></div>
                  )}
                </div>
              ))}
            </div>
            {pos.budgeted_amount && pos.actual_expenditure && (
              <div style={{ marginTop: 12, fontSize: 12, color: T.textMuted, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                Variance: <strong style={{ color: pos.actual_expenditure > pos.budgeted_amount ? '#ff4444' : '#22c55e' }}>
                  {pos.actual_expenditure > pos.budgeted_amount ? '+' : ''}{fmtCurrency(pos.actual_expenditure - pos.budgeted_amount)}
                </strong>{' '}({((pos.actual_expenditure / pos.budgeted_amount - 1) * 100).toFixed(1)}%)
              </div>
            )}
          </div>

        </div>

        {/* ── RANKINGS ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Rankings Among All Positions ({pos.year})</div>
          <RankBar rank={salaryRank} total={allPositions.length} label="By Annual Salary" color={T.accent} />
          <RankBar rank={hourlyRank} total={allPositions.length} label="By Effective Hourly Rate" color={T.accentBlue} />
          <RankBar rank={loadedRank} total={allPositions.length} label="By Estimated Loaded Cost" color={T.accentOrange} />
          {meetingRank && <RankBar rank={meetingRank} total={allMeetingData.length} label="By Documented Meeting Hours" color={T.accentPurple} />}
        </div>

        {/* ── SALARY HISTORY ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Salary Over Time — {pos.title}</div>
          <LineChart points={salaryHistory} color={T.accentBlue} width={900} height={150} />
          {salaryHistory.length < 2 && (
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 8, fontStyle: 'italic' }}>
              Only one year of data available. Historical data will populate as annual reports are added.
            </div>
          )}
        </div>

        {/* ── POSITION HISTORY (prior holders) ── */}
        {history.length > 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Prior Holders — {pos.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: `1px solid ${T.surfaceBorder}`, marginBottom: 8 }}>
              {['Year', 'Name', 'Salary', 'Hrs/Wk', 'Type'].map((h, i) => (
                <div key={i} style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5 }}>{h}</div>
              ))}
            </div>
            {history.map((h, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.03)`, alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.accentBlue, fontFamily: T.mono }}>{h.year}</div>
                <div style={{ fontSize: 12, color: T.text }}>{h.name || '—'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{fmtCurrency(h.salary)}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{h.hours_per_week ? `${h.hours_per_week} hrs` : '—'}</div>
                <div style={{ fontSize: 11, color: T.textDim }}>{h.employment_type || '—'}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── NOTES & SOURCE ── */}
        {(pos.notes || pos.source) && (
          <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 12 }}>Notes & Source</div>
            {pos.notes && <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, marginBottom: 10 }}>{pos.notes}</div>}
            {pos.source && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: T.textDim }}>Data source:</span>
                <SourceBadge source={pos.source} />
                <span style={{ fontSize: 11, color: T.textDim }}>{pos.source}</span>
              </div>
            )}
          </div>
        )}

        {/* ── COMPARE ── */}
        <div style={{ marginTop: 16 }}>
          <ComparePanel currentPos={pos} allPositions={allPositions} theme={theme} />
        </div>

        {showLegend && <div style={{ marginTop: 16 }}><SourceLegendPanel /></div>}

        {/* Back link */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 12, color: T.accentBlue, textDecoration: 'none', fontWeight: 600 }}>← Back to Canaan Finance</a>
          {' · '}
          <a href={`/department/${pos.departments?.slug}`} style={{ fontSize: 12, color: T.textMuted, textDecoration: 'none' }}>{pos.departments?.name} Department →</a>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 16px 32px', borderTop: `1px solid rgba(255,255,255,0.04)` }}>
        <p style={{ color: T.textDim, fontSize: 9, lineHeight: 1.6 }}>
          Canaan Finance — OpenSourcePatents · Apache 2.0 · Not affiliated with the Town of Canaan<br />
          All data is public record under NH RSA 91-A · <a href="https://github.com/OpenSourcePatents" target="_blank" rel="noopener noreferrer" style={{ color: T.textMuted }}>github.com/OpenSourcePatents</a>
        </p>
      </div>
    </div>
  )
}
