'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtCurrency(n) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtHourly(salary, hoursPerWeek) {
  if (!salary || !hoursPerWeek) return '—'
  const rate = salary / (hoursPerWeek * 52)
  return '$' + rate.toFixed(2) + '/hr'
}

const DEPT_COLORS = {
  admin: '#22c55e', clerk: '#06b6d4', highway: '#ff4444',
  police: '#4a9eff', fire: '#ff8c00', transfer: '#a855f7',
  water: '#3b82f6', other: '#6b7280', elected: '#d4d4d4',
}

const btnBase = {
  border: 'none', cursor: 'pointer', fontWeight: 700,
  fontFamily: "'IBM Plex Sans', sans-serif", borderRadius: 8,
}

function VerifiedDot({ verified }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: verified ? '#22c55e' : '#ff8c00',
      marginRight: 6, flexShrink: 0,
    }} title={verified ? 'Verified from official source' : 'Estimated — pending confirmation'} />
  )
}

function SpotlightCard({ position, color = '#ff8c00', meetingData }) {
  if (!position) return null
  const hourly = position.hours_per_week ? position.salary / (position.hours_per_week * 52) : null
  const official = meetingData?.find(m =>
    position.name && m.official.toLowerCase().includes(position.name.split(' ').pop().toLowerCase())
  )
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}11, ${color}05)`,
      border: `1px solid ${color}33`,
      borderRadius: 14, padding: 22, marginBottom: 16,
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        ⚡ Spotlight
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{position.name || position.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{position.title}</div>
          {position.notes && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6, maxWidth: 500, lineHeight: 1.5 }}>{position.notes}</div>}
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Annual Salary', value: fmtCurrency(position.salary), color: '#fff' },
            { label: 'Hours / Week', value: position.hours_per_week ? `${position.hours_per_week} hrs` : '—', color: '#4a9eff' },
            { label: 'Effective Rate', value: hourly ? `$${hourly.toFixed(2)}/hr` : '—', color },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono'", letterSpacing: -1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
      {position.hours_per_week && (
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 8,
          background: `${color}11`, border: `1px solid ${color}22`,
          fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
        }}>
          <strong style={{ color }}>The Math:</strong> {position.hours_per_week} hrs/week × 52 weeks
          = <strong>{(position.hours_per_week * 52).toLocaleString()}</strong> hours/year.
          At {fmtCurrency(position.salary)}/year, that is an effective rate
          of <strong style={{ color }}>${hourly?.toFixed(2)}/hr</strong>
          {position.hours_per_week < 40 && ` — working ${40 - position.hours_per_week} fewer hours per week than a standard full-time employee.`}
        </div>
      )}
      {official && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.15)',
          fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#4a9eff' }}>Documented Meeting Hours:</strong> {official.total_documented_hours} hrs across {official.meetings_attended} meetings
          ({official.committees?.length || 0} committee{official.committees?.length !== 1 ? 's' : ''}).
          <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>
            Source: parsed from official minutes on canaannh.gov
          </span>
        </div>
      )}
    </div>
  )
}

function MeetingAttendanceCard({ meetingData, year }) {
  if (!meetingData || meetingData.length === 0) return null
  return (
    <div style={{
      background: 'rgba(74,158,255,0.04)', border: '1px solid rgba(74,158,255,0.12)',
      borderRadius: 12, padding: 20, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Documented Meeting Attendance — {year}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Parsed from official minutes at canaannh.gov/AgendaCenter
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
          ● From minutes
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 14, lineHeight: 1.6 }}>
        <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Note:</strong> These hours represent only documented public meeting time with recorded start and end times. They do not include prep work, driving, after-hours calls, training, or non-public sessions. Actual hours worked are likely higher.
      </div>

      {meetingData.map((row, idx) => (
        <div key={idx} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 8,
          padding: '10px 12px', borderRadius: 6,
          background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{row.official}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              {row.committees?.join(', ')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4a9eff', fontFamily: "'JetBrains Mono'" }}>
              {row.meetings_attended}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>meetings</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono'" }}>
              {row.total_documented_hours} hrs
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>documented</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {row.first_meeting} — {row.last_meeting}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MeetingsView({ meetings, meetingData, year }) {
  const [expandedMeeting, setExpandedMeeting] = useState(null)

  const committees = [...new Set(meetings.map(m => m.committee))].sort()
  const [filterCommittee, setFilterCommittee] = useState('all')

  const filtered = filterCommittee === 'all'
    ? meetings
    : meetings.filter(m => m.committee === filterCommittee)

  const totalMeetings = filtered.length
  const totalMinutes = filtered.reduce((s, m) => s + (m.duration_minutes || 0), 0)
  const avgDuration = totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Meetings', value: totalMeetings, color: '#fff' },
          { label: 'Total Hours', value: `${(totalMinutes / 60).toFixed(1)}`, color: '#4a9eff' },
          { label: 'Avg Duration', value: `${avgDuration} min`, color: '#22c55e' },
          { label: 'Committees', value: committees.length, color: '#ff8c00' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 14px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono'", letterSpacing: -1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {meetingData && meetingData.length > 0 && (
        <MeetingAttendanceCard meetingData={meetingData} year={year} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Meeting Log — {year}</div>
        <select value={filterCommittee} onChange={e => setFilterCommittee(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 11 }}>
          <option value="all">All Committees</option>
          {committees.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.map((m, idx) => (
        <div key={m.id || idx} style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, marginBottom: 6, overflow: 'hidden',
        }}>
          <div onClick={() => setExpandedMeeting(expandedMeeting === idx ? null : idx)} style={{
            padding: '12px 16px', cursor: 'pointer',
            display: 'grid', gridTemplateColumns: '100px 2fr 1fr 1fr', gap: 8, alignItems: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4a9eff', fontFamily: "'JetBrains Mono'" }}>
              {m.meeting_date}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{m.committee}</div>
              {m.title && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{m.title}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono'" }}>
              {m.start_time && m.end_time ? `${m.start_time} — ${m.end_time}` : '—'}
            </div>
            <div style={{ textAlign: 'right' }}>
              {m.duration_minutes ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono'" }}>
                  {m.duration_minutes} min
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>—</span>
              )}
            </div>
          </div>

          {expandedMeeting === idx && (
            <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ paddingTop: 10 }}>
                {m.officials_present && m.officials_present.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Officials Present</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {m.officials_present.map((name, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(74,158,255,0.1)', color: '#4a9eff' }}>{name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {m.attendees && m.attendees.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>All Attendees</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                      {m.attendees.join(', ')}
                    </div>
                  </div>
                )}
                {m.source_url && (
                  <a href={m.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'rgba(74,158,255,0.6)', textDecoration: 'none' }}>
                    View original minutes →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          No meeting records found. Run the scraper to populate data.
        </div>
      )}
    </div>
  )
}

export default function CanaanFinance() {
  const [view, setView] = useState('departments')
  const [year, setYear] = useState(2026)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [budget, setBudget] = useState(null)
  const [budgetLines, setBudgetLines] = useState([])
  const [expandedDept, setExpandedDept] = useState(null)
  const [sortBy, setSortBy] = useState('salary_desc')
  const [loading, setLoading] = useState(true)
  const [availableYears, setAvailableYears] = useState([2026])
  const [meetings, setMeetings] = useState([])
  const [meetingData, setMeetingData] = useState([])

  useEffect(() => { fetchAll() }, [year])

  const fetchAll = async () => {
    setLoading(true)
    const [deptRes, posRes, budgetRes, linesRes, yearsRes, meetingsRes] = await Promise.all([
      supabase.from('departments').select('*').eq('town_id', 1).order('name'),
      supabase.from('positions').select('*, departments(name, slug)').eq('year', year).order('salary', { ascending: false }),
      supabase.from('budget_years').select('*').eq('town_id', 1).eq('year', year).single(),
      supabase.from('budget_lines').select('*, departments(name, slug)').eq('year', year),
      supabase.from('budget_years').select('year').eq('town_id', 1).order('year', { ascending: false }),
      supabase.from('meeting_records').select('*').eq('town_id', 1).gte('meeting_date', `${year}-01-01`).lte('meeting_date', `${year}-12-31`).order('meeting_date', { ascending: false }),
    ])
    setDepartments(deptRes.data || [])
    setPositions(posRes.data || [])
    setBudget(budgetRes.data || null)
    setBudgetLines(linesRes.data || [])
    setAvailableYears((yearsRes.data || []).map(r => r.year))
    setMeetings(meetingsRes.data || [])

    // Fetch attendance summary view
    const { data: attendanceData } = await supabase
      .from('official_attendance_summary')
      .select('*')
      .eq('town_id', 1)
      .eq('year', year)
      .order('total_documented_minutes', { ascending: false })
    setMeetingData(attendanceData || [])

    setLoading(false)
  }

  const totalSalaries = positions.reduce((s, p) => s + (p.salary || 0), 0)
  const perCapita = budget ? Math.round(budget.operating_budget / 3400) : null
  const interimAdmin = positions.find(p => p.title?.toLowerCase().includes('administrator'))
  const townClerk = positions.find(p => p.title?.toLowerCase().includes('clerk') && p.name)

  const sortedPositions = [...positions].sort((a, b) => {
    const aH = a.hours_per_week ? a.salary / (a.hours_per_week * 52) : 0
    const bH = b.hours_per_week ? b.salary / (b.hours_per_week * 52) : 0
    if (sortBy === 'salary_desc') return b.salary - a.salary
    if (sortBy === 'salary_asc') return a.salary - b.salary
    if (sortBy === 'hourly_desc') return bH - aH
    if (sortBy === 'hourly_asc') return aH - bH
    return 0
  })

  return (
    <div style={{ minHeight: '100vh', background: '#090b0f', color: '#e0e0e0', fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(180deg, #101420, #090b0f)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #22c55e, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono'", boxShadow: '0 0 16px rgba(34,197,94,0.3)' }}>$</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>CANAAN FINANCE</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>YOUR TAX DOLLARS — DIGITIZED</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, fontFamily: "'JetBrains Mono'", cursor: 'pointer' }}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
              {[{ k: 'departments', l: 'Departments' }, { k: 'salaries', l: 'All Salaries' }, { k: 'meetings', l: 'Meetings' }, { k: 'overview', l: 'Overview' }].map(v => (
                <button key={v.k} onClick={() => setView(v.k)} style={{ ...btnBase, padding: '7px 14px', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', background: view === v.k ? 'rgba(255,255,255,0.1)' : 'transparent', color: view === v.k ? '#fff' : 'rgba(255,255,255,0.4)' }}>{v.l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 80px' }}>

        {/* DISCLAIMER */}
        <div style={{ background: 'rgba(255,180,0,0.06)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          <strong style={{ color: '#ffd700' }}>DATA TRANSPARENCY:</strong> <span style={{ color: '#22c55e' }}>●</span> Verified from official sources. <span style={{ color: '#ff8c00' }}>●</span> Estimated — cross-reference with the Annual Report at canaannh.gov. All compensation is public record under <strong style={{ color: '#fff' }}>NH RSA 91-A</strong>. $6.37M operating budget approved by voters March 2026.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</div>
        ) : (
          <>
            {/* DEPARTMENTS VIEW */}
            {view === 'departments' && (
              <div>
                {interimAdmin && <SpotlightCard position={interimAdmin} color="#ff8c00" meetingData={meetingData} />}
                {townClerk && <SpotlightCard position={townClerk} color="#22c55e" meetingData={meetingData} />}

                {meetingData.length > 0 && (
                  <MeetingAttendanceCard meetingData={meetingData} year={year} />
                )}

                {departments.map(dept => {
                  const deptPositions = positions.filter(p => p.departments?.slug === dept.slug)
                  const deptLine = budgetLines.find(l => l.departments?.slug === dept.slug)
                  const isExpanded = expandedDept === dept.id
                  const color = DEPT_COLORS[dept.slug] || '#888'
                  const totalDeptSalary = deptPositions.reduce((s, p) => s + (p.salary || 0), 0)

                  return (
                    <div key={dept.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${isExpanded ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                      <div onClick={() => setExpandedDept(isExpanded ? null : dept.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 4, height: 36, borderRadius: 2, background: color }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{dept.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{deptPositions.length} position{deptPositions.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {deptLine && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(deptLine.amount)}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{year} budget</div>
                            </div>
                          )}
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ paddingTop: 14 }}>
                            {deptPositions.length === 0 ? (
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '10px 0' }}>No position data for this department yet.</div>
                            ) : deptPositions.map((pos, idx) => {
                              const hourly = pos.hours_per_week ? pos.salary / (pos.hours_per_week * 52) : null
                              return (
                                <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '10px 0', borderBottom: idx < deptPositions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'start' }}>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <VerifiedDot verified={pos.verified} />
                                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{pos.title}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 13 }}>
                                      {pos.name || '—'}
                                      {pos.type === 'stipend' && <span style={{ color: '#4a9eff' }}> (stipend)</span>}
                                      {pos.type === 'pool' && <span style={{ color: '#4a9eff' }}> (pool)</span>}
                                    </div>
                                    {pos.notes && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 13, marginTop: 3, lineHeight: 1.4, maxWidth: 400 }}>{pos.notes}</div>}
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(pos.salary)}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>annual</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#4a9eff', fontFamily: "'JetBrains Mono'" }}>{pos.hours_per_week ? `${pos.hours_per_week} hrs` : '—'}</div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>per week</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: hourly ? (hourly > 40 ? '#ff4444' : hourly > 30 ? '#ff8c00' : hourly > 20 ? '#ffd700' : '#22c55e') : 'rgba(255,255,255,0.2)' }}>
                                      {hourly ? `$${hourly.toFixed(2)}/hr` : '—'}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>effective rate</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total salary cost</span>
                            <span style={{ color: '#fff', fontWeight: 700, fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(totalDeptSalary)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ALL SALARIES VIEW */}
            {view === 'salaries' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>All Positions — {year}</div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 11 }}>
                    <option value="salary_desc">Highest Salary</option>
                    <option value="salary_asc">Lowest Salary</option>
                    <option value="hourly_desc">Highest Hourly Rate</option>
                    <option value="hourly_asc">Lowest Hourly Rate</option>
                  </select>
                </div>
                {sortedPositions.map((pos, idx) => {
                  const hourly = pos.hours_per_week ? pos.salary / (pos.hours_per_week * 52) : null
                  return (
                    <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '36px 2.5fr 1fr 1fr 1fr', gap: 8, padding: '12px 16px', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: 8, alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.15)', fontFamily: "'JetBrains Mono'" }}>{idx + 1}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <VerifiedDot verified={pos.verified} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{pos.title}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 13 }}>{pos.departments?.name} · {pos.name || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(pos.salary)}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#4a9eff', fontFamily: "'JetBrains Mono'", fontWeight: 600 }}>{pos.hours_per_week ? `${pos.hours_per_week} hrs/wk` : '—'}</div>
                      <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: hourly ? (hourly > 40 ? '#ff4444' : hourly > 30 ? '#ff8c00' : '#22c55e') : 'rgba(255,255,255,0.2)' }}>
                        {hourly ? `$${hourly.toFixed(2)}/hr` : '—'}
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Total Salary / Compensation</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(totalSalaries)}</span>
                </div>
              </div>
            )}

            {/* MEETINGS VIEW */}
            {view === 'meetings' && (
              <MeetingsView meetings={meetings} meetingData={meetingData} year={year} />
            )}

            {/* OVERVIEW VIEW */}
            {view === 'overview' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: `${year} Operating Budget`, value: fmtCurrency(budget?.operating_budget), sub: 'Voter approved', color: '#fff' },
                    { label: 'Water & Sewer', value: fmtCurrency(budget?.water_sewer), sub: 'Funded by user fees', color: '#4a9eff' },
                    { label: 'Per Capita', value: perCapita ? fmtCurrency(perCapita) : '—', sub: '~3,400 residents', color: '#ff8c00' },
                    { label: 'Total Salary Cost', value: fmtCurrency(totalSalaries), sub: `${positions.length} positions tracked`, color: '#22c55e' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 16px' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono'", letterSpacing: -1 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 22, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Department Budget Breakdown</div>
                  {budgetLines.sort((a, b) => b.amount - a.amount).map(line => {
                    const pct = budget ? (line.amount / budget.operating_budget * 100) : 0
                    const color = DEPT_COLORS[line.departments?.slug] || '#888'
                    return (
                      <div key={line.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{line.departments?.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono'" }}>{fmtCurrency(line.amount)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 5, background: color, width: `${pct}%`, transition: 'width 0.8s ease', opacity: 0.8 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4a9eff', marginBottom: 10 }}>How to Verify This Data</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                    All employee compensation is public record under <strong style={{ color: '#fff' }}>NH RSA 91-A</strong>. Request the annual town report from the Town Office at 1169 US Route 4, call 603-523-4501, or download it from scholars.unh.edu or canaannh.gov. Budget appropriations are in the signed warrant articles and MS-737 form on the town website under Voting &amp; Elections.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 16px 32px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, lineHeight: 1.6 }}>
          Canaan Finance — OpenSourcePatents · CC0 Public Domain · Not affiliated with the Town of Canaan
          <br />All data is public record under NH RSA 91-A · <a href="https://github.com/OpenSourcePatents" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.3)' }}>github.com/OpenSourcePatents</a>
        </p>
      </div>
    </div>
  )
}
