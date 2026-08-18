import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '@/stores/admin.store';
import { adminSocket } from '@/lib/socket';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',     icon: '📊', exact: true  },
  { to: '/map',          label: 'Live Map',       icon: '🗺️', exact: false },
  { to: '/drivers',      label: 'Drivers',        icon: '🚗', exact: false },
  { to: '/orders',       label: 'Orders',         icon: '📦', exact: false },
  { to: '/notifications',label: 'Notifications',  icon: '🔔', exact: false },
  { to: '/marketing',    label: 'Marketing',      icon: '📣', exact: false },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isDark, toggleDark } = useAdminStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    adminSocket.disconnect();
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const item = NAV_ITEMS.find(n => path.startsWith(n.to) && n.to !== '/');
    return item ? item.label : 'Admin Portal';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-pharmacy-canvas dark:bg-slate-900 font-sans">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-[240px]' : 'w-16'} flex-shrink-0
          flex flex-col bg-pharmacy-ink dark:bg-slate-900
          transition-all duration-300 shadow-xl z-20
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-6 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-pharmacy-primary flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            U
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white whitespace-nowrap">
                United Pharmacy
              </p>
              <p className="text-xs text-pharmacy-inkFaint whitespace-nowrap">Admin Operations</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group overflow-hidden
                ${
                  isActive
                    ? 'bg-pharmacy-primary/10 text-white border-l-4 border-pharmacy-primary'
                    : 'text-pharmacy-inkFaint hover:bg-white/5 hover:text-white border-l-4 border-transparent'
                }`
              }
            >
              <span className="text-lg flex-shrink-0 group-hover:scale-110 transition-transform">{item.icon}</span>
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-lg bg-white/5">
              <div className="w-9 h-9 rounded-full bg-pharmacy-primary/20 flex items-center justify-center text-pharmacy-primaryLight text-sm font-bold flex-shrink-0">
                {user?.fullName?.[0] ?? 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.fullName ?? 'Admin User'}
                </p>
                <p className="text-xs text-pharmacy-inkFaint truncate">
                  {user?.role ?? 'Administrator'}
                </p>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-pharmacy-inkFaint hover:bg-white/5 hover:text-white transition-colors"
          >
            <span className="text-lg flex-shrink-0">{isDark ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span className="whitespace-nowrap">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <span className="text-lg flex-shrink-0">🚪</span>
            {sidebarOpen && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top bar */}
        <header className="h-16 flex items-center gap-4 px-6 bg-white dark:bg-slate-800 border-b border-pharmacy-line dark:border-slate-700 flex-shrink-0 z-10 shadow-sm">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-md hover:bg-pharmacy-canvas dark:hover:bg-slate-700 transition-colors text-pharmacy-inkSoft dark:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-xl font-bold text-pharmacy-ink dark:text-white flex-1 font-sans tracking-tight">
            {getPageTitle()}
          </h1>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-pharmacy-inkSoft hover:bg-pharmacy-canvas rounded-full relative transition-colors">
              <span className="text-lg">🔔</span>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-pharmacy-primary/10 flex items-center justify-center text-pharmacy-primary text-sm font-bold border border-pharmacy-primary/20">
              {user?.fullName?.[0] ?? 'A'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-pharmacy-canvas dark:bg-slate-900">
          <div className="max-w-[1280px] mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

