import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'EngineerOS — AI Workspace for Notes, Tasks & Projects'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const C = {
  appBg:       '#08090e',
  sidebar:     '#060709',
  content:     '#0b0c12',
  panel:       '#0d0e16',
  card:        '#111320',
  border:      '#1a1c28',
  accent:      '#4f46e5',
  accentDim:   'rgba(79,70,229,0.11)',
  accentRing:  'rgba(79,70,229,0.32)',
  accentText:  '#818cf8',
  text:        '#e2e4ee',
  muted:       '#7b7d8e',
  faint:       '#3e4054',
  success:     '#10b981',
  warn:        '#f59e0b',
}

const NAV = ['Notes', 'Tasks', 'Projects', 'Daily']

const CARDS = [
  { title: 'API redesign — auth scope', tag: 'note',    time: '2h ago',    active: true  },
  { title: 'Fix token expiry check',    tag: 'task',    time: 'yesterday', active: false },
  { title: 'EngineerOS v2 roadmap',     tag: 'project', time: 'ongoing',   active: false },
  { title: 'Daily — Aug 6',             tag: 'daily',   time: 'today',     active: false },
]

const CITATIONS = [
  { label: 'API redesign — auth scope', type: 'note'    },
  { label: 'Fix token expiry check',    type: 'task'    },
  { label: 'EngineerOS v2 roadmap',     type: 'project' },
]

const tagColor = (t: string) => {
  if (t === 'task')    return { bg: 'rgba(16,185,129,0.1)',  fg: '#10b981' }
  if (t === 'project') return { bg: 'rgba(79,70,229,0.1)',   fg: '#818cf8' }
  if (t === 'daily')   return { bg: 'rgba(245,158,11,0.1)',  fg: '#f59e0b' }
  return                      { bg: 'rgba(255,255,255,0.05)', fg: '#7b7d8e' }
}

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 1200,
          height: 630,
          background: C.appBg,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* ── Topbar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 52,
            padding: '0 20px',
            background: C.sidebar,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {/* Window dots */}
          <div style={{ display: 'flex', gap: 6, marginRight: 20 }}>
            {['#ff5f57','#febc2e','#28c840'].map((col) => (
              <div key={col} style={{ display: 'flex', width: 11, height: 11, borderRadius: '50%', background: col }} />
            ))}
          </div>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
            <span style={{ color: C.text, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>EngineerOS</span>
          </div>

          <div style={{ display: 'flex', flex: 1 }} />
          <span style={{ color: C.faint, fontSize: 12, letterSpacing: '0.01em', fontFamily: 'monospace' }}>
            engineeros-delta.vercel.app
          </span>
        </div>

        {/* ── Main 3-column layout ── */}
        <div style={{ display: 'flex', flex: 1 }}>

          {/* Sidebar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 188,
              background: C.sidebar,
              borderRight: `1px solid ${C.border}`,
              padding: '14px 8px',
              gap: 3,
            }}
          >
            {NAV.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: item === 'Notes' ? C.accentDim : 'transparent',
                  border: `1px solid ${item === 'Notes' ? C.accentRing : 'transparent'}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: item === 'Notes' ? C.accentText : C.faint,
                  }}
                />
                <span
                  style={{
                    color: item === 'Notes' ? C.accentText : C.muted,
                    fontSize: 13,
                    fontWeight: item === 'Notes' ? 600 : 400,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}

            <div style={{ display: 'flex', height: 1, background: C.border, margin: '10px 0' }} />

            {/* Search pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                background: C.card,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.faint, fontSize: 11, fontFamily: 'monospace' }}>⌘K</span>
              <span style={{ color: C.faint, fontSize: 12 }}>Search...</span>
            </div>

            {/* Spacer + graph link */}
            <div style={{ display: 'flex', flex: 1 }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 12px',
                borderRadius: 6,
              }}
            >
              <div style={{ display: 'flex', width: 5, height: 5, borderRadius: '50%', background: C.faint }} />
              <span style={{ color: C.faint, fontSize: 13 }}>Knowledge Graph</span>
            </div>
          </div>

          {/* Note list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 350,
              background: C.content,
              borderRight: `1px solid ${C.border}`,
            }}
          >
            {/* List header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>Notes</span>
              <span style={{ color: C.faint, fontSize: 12 }}>47 items</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 6 }}>
              {CARDS.map((card) => {
                const tc = tagColor(card.tag)
                return (
                  <div
                    key={card.title}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '10px 12px',
                      background: card.active ? C.card : 'transparent',
                      border: `1px solid ${card.active ? C.border : 'transparent'}`,
                      borderRadius: 7,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: card.active ? C.text : C.muted, fontSize: 13, fontWeight: card.active ? 500 : 400 }}>
                        {card.title}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: tc.bg,
                          color: tc.fg,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        {card.tag}
                      </div>
                    </div>
                    <span style={{ color: C.faint, fontSize: 11 }}>{card.time}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Note editor (stub) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              background: C.content,
              borderRight: `1px solid ${C.border}`,
              padding: '24px 28px',
            }}
          >
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: C.muted }} />
              <span style={{ color: C.text, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                API redesign — auth scope
              </span>
            </div>

            {/* Prose skeleton lines */}
            {[95, 88, 72, 88, 60, 0, 90, 78, 66].map((w, i) =>
              w === 0 ? (
                <div key={i} style={{ display: 'flex', height: 14 }} />
              ) : (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    height: 10,
                    borderRadius: 3,
                    background: i < 2 ? C.border : C.card,
                    width: `${w}%`,
                    marginBottom: 8,
                  }}
                />
              )
            )}

            {/* Wikilink chip */}
            <div style={{ display: 'flex', marginTop: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: C.accentDim,
                  border: `1px solid ${C.accentRing}`,
                  borderRadius: 5,
                }}
              >
                <span style={{ color: C.accentText, fontSize: 11 }}>[[EngineerOS v2 roadmap]]</span>
              </div>
            </div>
          </div>

          {/* AI panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 340,
              background: C.panel,
            }}
          >
            {/* AI header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 18px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: C.accent,
                }}
              />
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
              <div style={{ display: 'flex', flex: 1 }} />
              <div
                style={{
                  display: 'flex',
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: C.accentDim,
                  border: `1px solid ${C.accentRing}`,
                  color: C.accentText,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                SEMANTIC
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 16px 0 16px', gap: 14 }}>
              {/* User query bubble */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    display: 'flex',
                    padding: '9px 13px',
                    background: C.accentDim,
                    border: `1px solid ${C.accentRing}`,
                    borderRadius: '10px 10px 2px 10px',
                    color: C.accentText,
                    fontSize: 12,
                    maxWidth: 240,
                  }}
                >
                  What did I work on this week?
                </div>
              </div>

              {/* Found badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', width: 4, height: 4, borderRadius: '50%', background: C.success }} />
                <span style={{ color: C.muted, fontSize: 11 }}>Found 3 relevant items · cited</span>
              </div>

              {/* Citation cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CITATIONS.map((cite) => {
                  const tc = tagColor(cite.type)
                  return (
                    <div
                      key={cite.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 11px',
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: 'flex', width: 4, height: 4, borderRadius: '50%', background: tc.fg, flexShrink: 0 }} />
                      <span style={{ color: C.muted, fontSize: 12 }}>{cite.label}</span>
                    </div>
                  )
                })}
              </div>

              {/* AI prose skeleton */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[92, 85, 70, 80].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      height: 9,
                      borderRadius: 3,
                      background: C.card,
                      width: `${w}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            display: 'flex',
            height: 3,
            background: `linear-gradient(90deg, transparent 0%, ${C.accent} 30%, #818cf8 70%, transparent 100%)`,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
