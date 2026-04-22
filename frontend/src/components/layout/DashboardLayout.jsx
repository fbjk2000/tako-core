import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { useTokenUsage } from '../../hooks/useTokenUsage';
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
  Phone,
  Radio,
  Megaphone,
  UserCircle,
  Contact as ContactIcon,
  Briefcase,
  Camera,
  CalendarDays,
  CalendarClock,
  FolderOpen,
  FolderKanban,
  FileText,
  Zap
} from 'lucide-react';

const ICONS = { LayoutDashboard, Users, Target, CheckSquare, Building, Mail, Megaphone, Settings, Shield, MessageSquare, Phone, BarChart3, HelpCircle, Radio, UserCircle, ContactIcon, Briefcase, Camera, CalendarDays, CalendarClock, FolderOpen, FolderKanban, FileText };

const DashboardLayout = ({ children }) => {
  const { user, logout, token } = useAuth();
  const { usage } = useTokenUsage(token);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('tako_lang') || 'en');

  const isAdmin = user?.role === 'super_admin' || user?.role === 'deputy_admin' || user?.email === 'florian@unyted.world';

  const labels = {
    en: { dashboard: 'Dashboard', leads: 'Leads', contacts: 'Contacts', deals: 'Deals', tasks: 'Tasks', projects: 'Projects', pipeline: 'Pipeline', companies: 'Companies', campaigns: 'Campaigns', listeners: 'Listeners', teamChat: 'Team Chat', calls: 'Calls', calendar: 'Calendar', bookings: 'Bookings', admin: 'Admin', settings: 'Settings', support: 'Support', signOut: 'Sign Out', capture: 'Capture', files: 'Files', user: 'User' },
    de: { dashboard: 'Dashboard', leads: 'Leads', contacts: 'Kontakte', deals: 'Deals', tasks: 'Aufgaben', projects: 'Projekte', pipeline: 'Pipeline', companies: 'Unternehmen', campaigns: 'Kampagnen', listeners: 'Listener', teamChat: 'Team-Chat', calls: 'Anrufe', calendar: 'Kalender', bookings: 'Buchungen', admin: 'Admin', settings: 'Einstellungen', support: 'Support', signOut: 'Abmelden', capture: 'Erfassen', files: 'Dateien', user: 'Benutzer' }
  };
  const l = labels[lang] || labels.en;

  const toggleLang = () => {
    const nl = lang === 'en' ? 'de' : 'en';
    setLang(nl);
    localStorage.setItem('tako_lang', nl);
    try { window.dispatchEvent(new Event('languagechange')); } catch {}
  };

  const sectionLabels = {
    en: { overview: 'Overview', crm: 'CRM', sales: 'Sales', engagement: 'Engagement', productivity: 'Productivity', system: 'System' },
    de: { overview: 'Übersicht', crm: 'CRM', sales: 'Vertrieb', engagement: 'Kommunikation', productivity: 'Produktivität', system: 'System' },
  };
  const s = sectionLabels[lang] || sectionLabels.en;

  // Grouped navigation. Pipeline is nested under Deals for clearer IA.
  const navSections = [
    {
      heading: s.overview,
      items: [
        { path: '/dashboard', label: l.dashboard, iconKey: 'LayoutDashboard' },
      ],
    },
    {
      heading: s.crm,
      items: [
        { path: '/leads', label: l.leads, iconKey: 'Users' },
        { path: '/contacts', label: l.contacts, iconKey: 'ContactIcon' },
        { path: '/companies', label: l.companies, iconKey: 'Building' },
      ],
    },
    {
      heading: s.sales,
      items: [
        {
          path: '/deals',
          label: l.deals,
          iconKey: 'Target',
          children: [
            { path: '/pipeline', label: l.pipeline, iconKey: 'BarChart3' },
          ],
        },
        { path: '/capture', label: l.capture, iconKey: 'Camera' },
      ],
    },
    {
      heading: s.engagement,
      items: [
        { path: '/campaigns', label: l.campaigns, iconKey: 'Megaphone' },
        { path: '/listeners', label: l.listeners, iconKey: 'Radio' },
        { path: '/chat', label: l.teamChat, iconKey: 'MessageSquare' },
        { path: '/calls', label: l.calls, iconKey: 'Phone' },
      ],
    },
    {
      heading: s.productivity,
      items: [
        { path: '/tasks', label: l.tasks, iconKey: 'CheckSquare' },
        { path: '/projects', label: l.projects, iconKey: 'FolderKanban' },
        { path: '/calendar', label: l.calendar, iconKey: 'CalendarDays' },
        { path: '/bookings', label: l.bookings, iconKey: 'CalendarClock' },
        { path: '/files', label: l.files, iconKey: 'FileText' },
      ],
    },
    {
      heading: s.system,
      items: [
        { path: '/admin', label: l.admin, iconKey: 'Shield', adminOnly: true },
        { path: '/settings', label: l.settings, iconKey: 'Settings' },
        { path: '/support', label: l.support, iconKey: 'HelpCircle' },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // A parent is "expanded" if itself or any child is the active route
  const isExpanded = (item) =>
    isActive(item.path) || (item.children || []).some((c) => isActive(c.path));

  const renderNavLink = (item, opts = {}) => {
    const { isChild = false } = opts;
    const Icon = ICONS[item.iconKey];
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 ${isChild ? 'pl-9 pr-3' : 'px-3'} py-2 rounded-lg transition-all duration-150 text-sm ${
          isActive(item.path)
            ? 'bg-teal-50 text-[#0EA5A0] font-medium'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
        data-testid={`nav-${item.label.toLowerCase()}`}
      >
        {!isChild && Icon ? <Icon className="w-4 h-4" /> : null}
        {isChild && <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
        <span className="truncate">{item.label}</span>
        {isActive(item.path) && !isChild && <ChevronRight className="w-4 h-4 ml-auto" />}
      </Link>
    );
  };

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
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="sidebar"
      >
        {/* Logo (sticky top inside sidebar) */}
        <div className="shrink-0 h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <Link to="/dashboard" className="flex items-center">
            <img src="/logo-horizontal.svg" alt="TAKO" className="h-7" />
          </Link>
        </div>

        {/* Navigation — scrolls independently so it never pushes logo/user section off-screen */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.heading}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-400">
                  {section.heading}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <div key={item.path}>
                      {renderNavLink(item)}
                      {item.children && isExpanded(item) && (
                        <div className="mt-0.5 space-y-0.5">
                          {item.children.map((child) => renderNavLink(child, { isChild: true }))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Section (sticky bottom inside sidebar) */}
        <div className="shrink-0 p-4 border-t border-slate-100 bg-white">
          {usage && usage.monthly_limit && (
            <div className="mb-3 px-1">
              {/* Trial banner — show from day 21 onwards */}
              {usage.is_trial && usage.trial_days_remaining != null && usage.trial_days_remaining <= 9 && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">AI trial ends in {usage.trial_days_remaining} day{usage.trial_days_remaining !== 1 ? 's' : ''}.</span>{' '}
                  <a href="/pricing" className="underline font-medium">Get TAKO →</a>
                </div>
              )}
              {/* Token usage bar — show from 80% usage */}
              {usage.pct_used >= 80 && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" />{usage.tokens_used} / {usage.monthly_limit} tokens</span>
                    <a href="/pricing" className="text-[#0EA5A0] hover:underline">Get TAKO</a>
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usage.pct_used >= 100 ? 'bg-red-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(usage.pct_used, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
                {user?.name || l.user}
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
