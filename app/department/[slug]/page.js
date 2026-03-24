'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { SourceBadge, SourceLegendPanel } from '../../../lib/dataSourceLegend'
import { ThemePicker, getTheme, NavPopover } from '../../../lib/themes'

function fmtCurrency(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtRate(n) {
  if (!n) return '—'
  return '$' + Number(n).toFixed(2) + '/hr'
}

const DEPT_COLORS = {
  admin: '#22c55e', clerk: '#06b6d4', highway: '#ff4444',
  police: '#4a9eff', fire: '#ff8c00', transfer: '#a855f7',
  water: '#3b82f6', other: '#6b7280', elected: '#d4d4d4',
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

function VerifiedDot({ verified }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: verified ? '#22c55e' : '#ff8c00', marginRight: 6, flexShrink: 0 }} title={verified ? 'Verified' : 'Estimated'} />
}

// Simple SVG bar chart for dept spending over time
function BarChart({ bars, color = '#4a9eff', height = 140 }) {
  if (!bars || bars.length === 0) return <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 20 }}>No historical data yet.</div>
  const max = Math.max(...bars.map(b => b.value))
  const pad = { top: 16, right: 16, bottom: 28, left: 64 }
  const W = 500, H = height
  const bw = Math.min(60, (W - pad.left - pad.right) / bars.length - 8)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = pad.top + (H - pad.top - pad.bottom) * t
        const val = max * (1 - t)
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="'JetBrains Mono'">
              {val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val.toFixed(0)}`}
            </text>
          </g>
        )
      })}
      {bars.map((b, i) => {
        const availW = W - pad.left - pad.right
        const x = pad.left + (i / bars.length) * availW + (availW / bars.length - bw) / 2
        const barH = max > 0 ? ((b.value / max) * (H - pad.top - pad.bottom)) : 0
        const y = H - pad.bottom - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={barH} rx={4} fill={color} opacity={0.8} />
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="'JetBrains Mono'">{b.year}</text>
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fill={color} fontSize={8} fontFamily="'JetBrains Mono'" fontWeight="700">
              {b.value >= 1000 ? `$${(b.value / 1000).toFixed(0)}k` : `$${b.value}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Clickable name with popover
function ClickableName({ positionId, name, onSidePanel }) {
  const [open, setOpen] = useState(false)
  if (!name || !positionId) return <span style={{ color: 'rgba(255,255,255,0.4)' }}>{name || '—'}</span>
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => setOpen(!open)} style={{ color: '#4a9eff', cursor: 'pointer', fontWeight: 600, borderBottom: '1px dotted rgba(74,158,255,0.4)' }}>{name}</span>
      {open && <NavPopover positionId={positionId} onSidePanel={(id) => { onSidePanel && onSidePanel(id); setOpen(false) }} onClose={() => setOpen(false)} />}
    </span>
  )
}

export default function DepartmentDetail() {
  const params = useParams()
  const slug = params?.slug
  const [dept, setDept] = useState(null)
  const [positions, setPositions] = useState([])
  const [budgetLine, setBudgetLine] = useState(null)
  const [budgetHistory, setBudgetHistory] = useState([])
  const [allDepts, setAllDepts] = useState([])
  const [allBudgetLines, setAllBudgetLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [themeId, setThemeId] = useState('mirror')
  const [showLegend, setShowLegend] = useState(false)
  const [year, setYear] = useState(2026)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('cf_theme') : null
    if (saved) setThemeId(saved)
  }, [])

  const handleThemeChange = (t) => {
    setThemeId(t)
    if (typeof window !== 'undefined') localStorage.setItem('cf_theme', t)
  }

  const theme = getTheme(themeId)
  const T = theme

  useEffect(() => {
    if (!slug) return
    fetchData()
  }, [slug, year])

  const fetchData = async () => {
    setLoading(true)
    const [deptRes, posRes, lineRes, histRes, allDeptsRes, allLinesRes] = await Promise.all([
      supabase.from('departments').select('*').eq('slug', slug).single(),
      supabase.from('positions').select('*, departments(name, slug)').eq('year', year).order('salary', { ascending: false }),
      supabase.from('budget_lines').select('*, departments(name, slug)').eq('year', year),
      supabase.from('budget_lines').select('year, amount, actual_spent').order('year', { ascending: true }),
      supabase.from('departments').select('*').eq('town_id', 1).order('name'),
      supabase.from('budget_lines').select('*, departments(name, slug)').eq('year', year),
    ])

    const d = deptRes.data
    setDept(d)
    const deptPositions = (posRes.data || []).filter(p => p.departments?.slug === slug)
    setPositions(deptPositions)
    const deptLine = (lineRes.data || []).find(l => l.departments?.slug === slug)
    setBudgetLine(deptLine || null)
    // History for this dept — filter by dept id
    if (d) {
      const deptHist = (histRes.data || []).filter(l => l.dept_id === d.id)
      setBudgetHistory(deptHist)
    }
    setAllDepts(allDeptsRes.data || [])
    setAllBudgetLines(allLinesRes.data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#090b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Loading department data...
    </div>
  )

  if (!dept) return (
    <div style={{ minHeight: '100vh', background: '#090b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Department not found. <a href="/" style={{ color: '#4a9eff', marginLeft: 8 }}>← Back</a>
    </div>
  )

  const color = DEPT_COLORS[slug] || '#888'
  const totalSalaries = positions.reduce((s, p) => s + (p.salary || 0), 0)
  const totalLoaded = positions.reduce((s, p) => {
    const b = p.employment_type === 'employee' ? p.salary * ((p.benefits_pct || 35) / 100) : 0
    return s + (p.salary || 0) + b
  }, 0)

  // Rankings vs other departments
  const sortedByBudget = [...allBudgetLines].sort((a, b) => b.amount - a.amount)
  const budgetRank = sortedByBudget.findIndex(l => l.departments?.slug === slug) + 1

  // Per-position cost ranking
  const deptCostPerPos = allDepts.map(d => {
    const dLines = allBudgetLines.filter(l => l.departments?.slug === d.slug)
    const dLine = dLines[0]
    return { slug: d.slug, name: d.name, costPerPos: dLine ? dLine.amount : 0 }
  }).sort((a, b) => b.costPerPos - a.costPerPos)
  const costRank = deptCostPerPos.findIndex(d => d.slug === slug) + 1

  // Bar chart data — budget history for this dept
  const barData = budgetHistory.map(h => ({ year: h.year, value: h.amount }))
  if (barData.length === 0 && budgetLine) barData.push({ year, value: budgetLine.amount })

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.sans, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>

      {/* Header */}
      <div style={{ background: T.header, borderBottom: `1px solid ${T.headerBorder}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/" style={{ fontSize: 11, color: T.accentBlue, textDecoration: 'none', fontWeight: 700 }}>← CANAAN FINANCE</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>{dept.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: '#1a1d2e', color: '#fff', fontSize: 10, fontFamily: T.mono, cursor: 'pointer' }}>
              {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ThemePicker current={themeId} onChange={handleThemeChange} />
            <button onClick={() => setShowLegend(!showLegend)} style={{ border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: showLegend ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)', color: showLegend ? '#ffd700' : T.textMuted, fontSize: 10, fontWeight: 700, fontFamily: T.sans }}>
              Source Legend
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ width: 6, height: 64, borderRadius: 3, background: color, flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.statFontSize + 6, fontWeight: 900, color: T.text, letterSpacing: -1, lineHeight: 1.1 }}>{dept.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Town of Canaan, NH · {year} · {positions.length} position{positions.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: `${year} Budget`, value: fmtCurrency(budgetLine?.amount), c: T.text },
              { label: 'Total Salaries', value: fmtCurrency(totalSalaries), c: T.accent },
              { label: 'Est. Loaded Cost', value: fmtCurrency(totalLoaded), c: T.accentBlue },
              { label: 'Positions', value: positions.length, c: T.accentOrange },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: T.statFontSize, fontWeight: 800, color: s.c, fontFamily: T.mono, letterSpacing: -1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {showLegend && <SourceLegendPanel />}

        {/* ── BUDGET BREAKDOWN ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Budget Breakdown — {year}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Appropriated', value: budgetLine?.amount, color: T.text, src: 'Voter-approved budget' },
              { label: 'Encumbered', value: budgetLine?.encumbered, color: T.accentOrange, src: budgetLine?.encumbered ? 'Budget line data' : null },
              { label: 'Actual Spent', value: budgetLine?.actual_spent, color: T.accent, src: budgetLine?.actual_spent ? 'Annual Report' : null },
            ].map((col, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{col.label}</div>
                {col.value ? (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: col.color, fontFamily: T.mono }}>{fmtCurrency(col.value)}</div>
                    <div style={{ fontSize: 9, color: T.textDim, marginTop: 4 }}>{col.src}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#6b7280', fontFamily: T.mono }}>—</div>
                    <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>⏳ pending RSA 91-A</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sub-line breakdown */}
          {budgetLine && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Sub-line Detail</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Salary Lines', value: budgetLine.salary_line },
                  { label: 'Benefits', value: budgetLine.benefits_line },
                  { label: 'Retirement', value: budgetLine.retirement_line },
                  { label: 'Insurance', value: budgetLine.insurance_line },
                  { label: 'Training', value: budgetLine.training_line },
                  { label: 'Contracted Svcs', value: budgetLine.contracted_services_line },
                ].filter(s => s.value).map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.accentBlue, fontFamily: T.mono }}>{fmtCurrency(s.value)}</div>
                  </div>
                ))}
                {![budgetLine.salary_line, budgetLine.benefits_line, budgetLine.retirement_line, budgetLine.insurance_line, budgetLine.training_line, budgetLine.contracted_services_line].some(Boolean) && (
                  <div style={{ fontSize: 11, color: T.textDim, padding: '8px 0', fontStyle: 'italic' }}>Sub-line data not yet available — pending RSA 91-A response. ⏳</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SPENDING OVER TIME ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Appropriated Budget Over Time</div>
          <BarChart bars={barData} color={color} height={160} />
          {barData.length < 2 && (
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 8, fontStyle: 'italic' }}>
              Only one year available. Historical data will populate as annual reports are parsed.
            </div>
          )}
        </div>

        {/* ── ALL POSITIONS ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>All Positions — {dept.name}</div>
          {positions.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textDim, padding: '10px 0' }}>No position data for this year.</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: `1px solid ${T.surfaceBorder}`, marginBottom: 8 }}>
                {['Name / Title', 'Salary', 'Hrs/Wk', 'Eff. Rate', 'Loaded Cost'].map((h, i) => (
                  <div key={i} style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: 1.5, textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
                ))}
              </div>
              {positions.map((pos, idx) => {
                const hr = pos.hours_per_week ? pos.salary / (pos.hours_per_week * 52) : null
                const isCon = pos.employment_type === 'contractor' || pos.employment_type === 'stipend' || pos.employment_type === 'pool'
                const lc = isCon ? pos.salary : Math.round(pos.salary * (1 + (pos.benefits_pct || 35) / 100))
                return (
                  <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, padding: T.rowPadding, borderBottom: idx < positions.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <VerifiedDot verified={pos.verified} />
                        <a href={`/position/${pos.id}`} style={{ fontSize: 12, fontWeight: 600, color: T.text, textDecoration: 'none' }}>{pos.title}</a>
                        {pos.status && pos.status !== 'active' && <StatusBadge status={pos.status} />}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginLeft: 13 }}>
                        <ClickableName positionId={pos.id} name={pos.name} />
                      </div>
                      {pos.source && <div style={{ marginLeft: 13, marginTop: 3 }}><SourceBadge source={pos.source} /></div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{fmtCurrency(pos.salary)}</div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: T.accentBlue, fontFamily: T.mono }}>{pos.hours_per_week ? `${pos.hours_per_week}h` : '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: hr ? (hr > 40 ? '#ff4444' : hr > 30 ? '#ff8c00' : T.accent) : T.textDim }}>{hr ? fmtRate(hr) : '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, fontFamily: T.mono, color: isCon ? 'rgba(168,85,247,0.7)' : T.textMuted }}>{fmtCurrency(lc)}</div>
                  </div>
                )
              })}
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.textMuted }}>Department total</span>
                <div style={{ display: 'flex', gap: 24 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{fmtCurrency(totalSalaries)} base</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.accentBlue, fontFamily: T.mono }}>{fmtCurrency(totalLoaded)} loaded</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RANKINGS vs other depts ── */}
        <div style={{ background: T.surface, border: `1px solid ${T.surfaceBorder}`, borderRadius: T.cardRadius, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: T.sectionTitleSize, fontWeight: 700, color: T.text, marginBottom: 16 }}>Rankings vs Other Departments</div>

          {/* Budget rank bar */}
          {budgetRank > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>By Appropriated Budget</span>
                <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: T.mono }}>#{budgetRank} of {sortedByBudget.length}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', borderRadius: 4, background: color, width: `${((sortedByBudget.length - budgetRank + 1) / sortedByBudget.length) * 100}%`, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          )}

          {/* All dept comparison table */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>All Departments Compared</div>
            {sortedByBudget.map((line, idx) => {
              const isThis = line.departments?.slug === slug
              const pct = sortedByBudget[0]?.amount > 0 ? (line.amount / sortedByBudget[0].amount) * 100 : 0
              const c = DEPT_COLORS[line.departments?.slug] || '#888'
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <div style={{ width: 3, height: 20, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: isThis ? 700 : 400, color: isThis ? T.text : T.textMuted }}>{line.departments?.name}{isThis && ' ◀'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: T.mono }}>{fmtCurrency(line.amount)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: c, width: `${pct}%`, opacity: isThis ? 1 : 0.5 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {showLegend && <div style={{ marginBottom: 16 }}><SourceLegendPanel /></div>}

        {/* Back */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: T.accentBlue, textDecoration: 'none', fontWeight: 600 }}>← Back to Canaan Finance</a>
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
