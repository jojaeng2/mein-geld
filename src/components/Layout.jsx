import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const navItems = [
  { to: '/', label: '대시보드', icon: '▦' },
  { to: '/assets', label: '자산', icon: '◈' },
  { to: '/history', label: '히스토리', icon: '◷' },
  { to: '/calculator', label: '계산기', icon: '◎' },
  { to: '/settings', label: '설정', icon: '⚙' },
]

function RefreshBanner({ status }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'refreshing') {
      setVisible(true)
    } else if (status === 'done') {
      const t = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(t)
    }
  }, [status])

  if (!visible) return null

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs transition-all duration-300
      ${status === 'done'
        ? 'bg-green-950 border-b border-green-900 text-green-400'
        : 'bg-gray-800 border-b border-gray-700 text-gray-400'
      }`}
    >
      {status === 'refreshing' ? (
        <>
          <span className="animate-spin inline-block w-3 h-3 border border-gray-500 border-t-gray-300 rounded-full" />
          현재가 자동 갱신 중...
        </>
      ) : (
        <><span>✓</span> 현재가 갱신 완료</>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const refreshStatus = useAutoRefresh()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col bg-gray-900 border-r border-gray-800">
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold">
            <span className="text-white">Mein</span>
            <span className="text-brand-500"> Geld</span>
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="px-3 py-1 mb-2">
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <span>↩</span>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <RefreshBanner status={refreshStatus} />
        <div className="flex-1 pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* ── 모바일 하단 탭 바 ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40">
        <div className="flex">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-xs font-medium transition ${
                  isActive ? 'text-brand-400' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
