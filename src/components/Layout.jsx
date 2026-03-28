import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const navItems = [
  { to: '/', label: '대시보드', icon: '▦' },
  { to: '/assets', label: '자산 관리', icon: '◈' },
  { to: '/history', label: '히스토리', icon: '◷' },
  { to: '/calculator', label: '복리 계산기', icon: '◎' },
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

function Sidebar({ onClose }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
    onClose?.()
  }

  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 h-full">
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          <span className="text-white">Mein</span>
          <span className="text-brand-500"> Geld</span>
        </h1>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none md:hidden">
            ×
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
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
    </div>
  )
}

export default function Layout({ children }) {
  const refreshStatus = useAutoRefresh()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // 페이지 이동 시 드로어 닫기
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex flex-col">
        <Sidebar />
      </aside>

      {/* ── 모바일 드로어 오버레이 ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── 모바일 드로어 사이드바 ── */}
      <aside className={`md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={() => setDrawerOpen(false)} />
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-gray-400 hover:text-white text-xl leading-none p-1"
          >
            ☰
          </button>
          <h1 className="text-base font-bold">
            <span className="text-white">Mein</span>
            <span className="text-brand-500"> Geld</span>
          </h1>
        </header>

        <RefreshBanner status={refreshStatus} />
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}
