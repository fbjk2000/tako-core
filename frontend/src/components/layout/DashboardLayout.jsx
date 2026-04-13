import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  LayoutDashboard,
  Users,
  Target,
  CheckSquare,
  Building,
  Mail,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronRight,
  BarChart3,
  HelpCircle,
  MessageSquare,
  Phone
} from 'lucide-react';

const ICONS = { LayoutDashboard, Users, Target, CheckSquare, Building, Mail, Settings, Shield, MessageSquare, Phone, BarChart3, HelpCircle };

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('tako_lang') || 'en');

  const isAdmin = user?.role === 'super_admin' || user?.role === 'deputy_admin' || user?.email === 'florian@unyted.world';

  const labels = {
    en: { dashboard: 'Dashboard', leads: 'Leads', contacts: 'Contacts', deals: 'Deals', tasks: 'Tasks', projects: 'Projects', pipeline: 'Pipeline', companies: 'Companies', campaigns: 'Campaigns', teamChat: 'Team Chat', calls: 'Calls', calendar: 'Calendar', bookings: 'Bookings', admin: 'Admin', settings: 'Settings', support: 'Support', signOut: 'Sign Out' },
    de: { dashboard: 'Dashboard', leads: 'Leads', contacts: 'Kontakte', deals: 'Deals', tasks: 'Aufgaben', projects: 'Projekte', pipeline: 'Pipeline', companies: 'Unternehmen', campaigns: 'Kampagnen', teamChat: 'Team-Chat', calls: 'Anrufe', calendar: 'Kalender', bookings: 'Buchungen', admin: 'Admin', settings: 'Einstellungen', support: 'Support', signOut: 'Abmelden' }
  };
  const l = labels[lang] || labels.en;

  const toggleLang = () => {
    const nl = lang === 'en' ? 'de' : 'en';
    setLang(nl);
    localStorage.setItem('tako_lang', nl);
    try { window.dispatchEvent(new Event('languagechange')); } catch {}
  };

  const navItems = [
    { path: '/dashboard', label: l.dashboard, iconKey: 'LayoutDashboard' },
    { path: '/leads', label: l.leads, iconKey: 'Users' },
    { path: '/contacts', label: l.contacts, iconKey: 'Users' },
    { path: '/deals', label: l.deals, iconKey: 'Target' },
    { path: '/tasks', label: l.tasks, iconKey: 'CheckSquare' },
    { path: '/projects', label: l.projects, iconKey: 'CheckSquare' },
    { path: '/pipeline', label: l.pipeline, iconKey: 'BarChart3' },
    { path: '/companies', label: l.companies, iconKey: 'Building' },
    { path: '/campaigns', label: l.campaigns, iconKey: 'Mail' },
    { path: '/chat', label: l.teamChat, iconKey: 'MessageSquare' },
    { path: '/calls', label: l.calls, iconKey: 'Phone' },
    { path: '/calendar', label: l.calendar, iconKey: 'CheckSquare' },
    { path: '/bookings', label: l.bookings, iconKey: 'Users' },
    { path: '/capture', label: 'Capture', iconKey: 'Users' },
    { path: '/files', label: 'Files', iconKey: 'CheckSquare' },
    { divider: true },
    { path: '/admin', label: l.admin, iconKey: 'Shield', adminOnly: true },
    { path: '/settings', label: l.settings, iconKey: 'Settings' },
    { path: '/support', label: l.support, iconKey: 'HelpCircle' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-layout">
      {/* Mobile Header - always visible on mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-3 shadow-sm">
        <Link to="/dashboard" className="flex items-center">
          <img src="/logo-horizontal.svg" alt="TAKO" className="h-6" />
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-10 h-10 rounded-lg bg-[#0EA5A0] text-white flex items-center justify-center active:bg-[#0B8C88]"
          data-testid="mobile-menu-toggle"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <Link to="/dashboard" className="flex items-center">
              <img src="/logo-horizontal.svg" alt="TAKO" className="h-7" />
            </Link>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-3 space-y-1">
              {navItems.filter(item => !item.adminOnly || isAdmin).map((item, index) =>
                item.divider ? (
                  <div key={index} className="my-4 border-t border-slate-100" />
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                      isActive(item.path)
                        ? 'bg-teal-50 text-[#0EA5A0] font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    {(() => { const Icon = ICONS[item.iconKey]; return Icon ? <Icon className="w-5 h-5" /> : null; })()}
                    <span>{item.label}</span>
                    {isActive(item.path) && (
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    )}
                  </Link>
                )
              )}
            </nav>
          </ScrollArea>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <span className="text-[#0EA5A0] font-medium">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate" data-testid="sidebar-user-name">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" className="flex-1 justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50" onClick={handleLogout} data-testid="sidebar-logout">
                <LogOut className="w-4 h-4 mr-2" />
                {l.signOut}
              </Button>
              <button onClick={toggleLang} className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-600" data-testid="lang-toggle">
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
