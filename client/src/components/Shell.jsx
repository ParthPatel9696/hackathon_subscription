import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Bell, ChevronsLeft, ChevronsRight, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Moon, Package, Percent, Search, Settings, Sun, Tags, Users, Wallet, X } from 'lucide-react';
import api from '../api';
import { useAuthStore } from '../store';

const sections = [
  { title: 'Overview', links: [['/app/dashboard', 'Dashboard', LayoutDashboard, ['admin', 'staff', 'customer']]] },
  { title: 'Business', links: [
    ['/app/customers', 'Customers', Users, ['admin', 'staff']], ['/app/products', 'Products', Package, ['admin']], ['/app/plans', 'Plans', Tags, ['admin', 'staff', 'customer']],
    ['/app/quotations', 'Quotations', FileText, ['admin', 'staff']], ['/app/subscriptions', 'Subscriptions', Wallet, ['admin', 'staff', 'customer']]
  ] },
  { title: 'Finance', links: [
    ['/app/invoices', 'Invoices', FileText, ['admin', 'staff', 'customer']], ['/app/payments', 'Payments', CreditCard, ['admin', 'staff', 'customer']],
    ['/app/discounts', 'Discounts', Percent, ['admin']], ['/app/reports', 'Reports', BarChart3, ['admin', 'staff']]
  ] },
  { title: 'System', links: [['/app/settings', 'Settings', Settings, ['admin', 'staff', 'customer']]] }
];

export default function Shell() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('brightloop_sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('brightloop_theme') || 'light');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedResult, setSelectedResult] = useState(0);
  const searchInput = useRef(null);
  const searchTrigger = useRef(null);
  const restoreSearchFocus = useRef(false);
  const searchQuery = useQuery({
    queryKey: ['global-search', debouncedSearch],
    queryFn: async () => (await api.get('/search', { params: { q: debouncedSearch } })).data,
    enabled: searchOpen && debouncedSearch.length >= 2,
    staleTime: 15000
  });
  const notificationQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
    staleTime: 30000
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('brightloop_theme', theme);
  }, [theme]);
  useEffect(() => { setMobileOpen(false); setNotificationsOpen(false); setProfileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(true); setSelectedResult(0);
      }
      if (event.key === 'Escape') { if (searchOpen) restoreSearchFocus.current = true; setSearchOpen(false); setNotificationsOpen(false); setProfileOpen(false); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [searchOpen]);
  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchInput.current?.focus(), 0);
    else {
      setSearchTerm('');
      if (restoreSearchFocus.current) window.requestAnimationFrame(() => searchTrigger.current?.focus());
      restoreSearchFocus.current = false;
    }
  }, [searchOpen]);

  const activeLabel = useMemo(() => sections.flatMap((section) => section.links).find(([to]) => location.pathname === to || location.pathname.startsWith(`${to}/`))?.[1] || 'Dashboard', [location.pathname]);
  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { clearSession(); queryClient.removeQueries({ queryKey: ['current-user'] }); queryClient.removeQueries({ queryKey: ['notifications'] }); navigate('/login'); }
  };
  const toggleCollapsed = () => setCollapsed((value) => {
    localStorage.setItem('brightloop_sidebar', value ? 'expanded' : 'collapsed');
    return !value;
  });
  const commands = sections.flatMap((section) => section.links
    .filter(([, , , roles]) => roles.includes(user?.role))
    .map(([href, label, Icon]) => ({ href, title: label, subtitle: section.title, Icon, type: 'Page' })));
  const searchResults = searchTerm.trim().length >= 2 ? (searchTerm.trim() === debouncedSearch ? (searchQuery.data?.data || []) : []) : commands
    .filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(searchTerm.trim().toLowerCase())).slice(0, 7);
  const closeSearch = (restoreFocus = true) => { restoreSearchFocus.current = restoreFocus; setSearchOpen(false); setSearchTerm(''); };
  const openResult = (href) => { closeSearch(false); navigate(href); };

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Sidebar">
        <div className="brand-row">
          <NavLink to="/app/dashboard" className="brand-mark" aria-label="Brightloop dashboard"><span className="brand-symbol">b</span></NavLink>
          <div className="brand-copy"><span className="brand-name">brightloop</span><span className="brand-caption">BILLING WORKSPACE</span></div>
          <button className="icon-button sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="workspace-switcher" title={`${user?.role || 'User'} workspace`}>
          <span className="workspace-avatar">{(user?.companyName || user?.name || 'B').slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{user?.companyName || 'My workspace'}</strong><small>{user?.role || 'member'} account</small></span>
        </div>
        <nav aria-label="Primary navigation" className="sidebar-nav">
          {sections.map((section) => {
            const visible = section.links.filter(([, , , roles]) => roles.includes(user?.role));
            if (!visible.length) return null;
            return <section className="nav-section" key={section.title} aria-label={section.title}>
              <h2 className="nav-section-title">{section.title}</h2>
              {visible.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/app/dashboard'} title={collapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span className="nav-label">{label}</span>
              </NavLink>)}
            </section>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-link collapse-control" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}<span className="nav-label">Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{activeLabel}</strong></div>
          </div>
          <div className="topbar-actions">
            <button ref={searchTrigger} className="global-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search Brightloop"><Search size={15}/><span>Search</span><kbd>Ctrl K</kbd></button>
            <span className="topbar-date">{user?.role} workspace</span>
            <div className="topbar-menu-wrap">
              <button className="icon-button notification-trigger" aria-label={`Notifications${notificationQuery.data?.count ? `, ${notificationQuery.data.count} items need attention` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }}><Bell size={17}/>{notificationQuery.data?.count > 0 && <span className="notification-count">{notificationQuery.data.count > 9 ? '9+' : notificationQuery.data.count}</span>}</button>
              {notificationsOpen && <section className="topbar-popover notification-popover" aria-label="Notifications"><div className="popover-heading"><span><strong>Needs attention</strong><small>Overdue invoices and upcoming renewals</small></span><button className="popover-refresh" onClick={() => notificationQuery.refetch()} aria-label="Refresh notifications">Refresh</button></div>{notificationQuery.isLoading ? <p className="popover-empty">Loading…</p> : notificationQuery.isError ? <p className="popover-empty">Notifications could not be loaded.</p> : notificationQuery.data?.data?.length ? <div className="notification-list">{notificationQuery.data.data.map((item) => <button key={`${item.type}-${item.id}`} className="notification-item" onClick={() => { setNotificationsOpen(false); navigate(item.href); }}><span className={`notification-marker ${item.type}`}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={14}/></button>)}</div> : <p className="popover-empty">Nothing needs attention right now.</p>}</section>}
            </div>
            <span className="topbar-divider" />
            <div className="topbar-menu-wrap"><button className="user-menu-trigger" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }} aria-label="Open profile menu"><span className="profile-avatar">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</span><span className="user-menu-name">{user?.name?.split(' ')[0] || 'Account'}</span></button>
              {profileOpen && <div className="topbar-popover profile-popover" role="menu"><div className="popover-user"><strong>{user?.name}</strong><small>{user?.email}</small></div><NavLink role="menuitem" to="/app/settings" onClick={() => setProfileOpen(false)}>Account and settings</NavLink><button role="menuitem" onClick={logout}><LogOut size={14}/> Sign out</button></div>}
            </div>
            <button className="icon-button theme-button" onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex="-1" className="page-content"><AnimatePresence mode="wait" initial={false}><motion.div key={location.pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ duration: 0.16, ease: 'easeOut' }}><Outlet /></motion.div></AnimatePresence></main>
      </div>
      <AnimatePresence>{searchOpen && <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeSearch(); }}>
        <motion.section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search and navigate" initial={{ opacity: 0, y: -7, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.995 }} transition={{ duration: 0.14, ease: 'easeOut' }} onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const focusable = [...event.currentTarget.querySelectorAll('input,button')].filter((element) => !element.disabled);
          if (!focusable.length) return;
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
          <div className="command-input-row"><Search size={18}/><input ref={searchInput} value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSelectedResult(0); }} onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedResult((index) => Math.min(index + 1, Math.max(0, searchResults.length - 1))); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedResult((index) => Math.max(0, index - 1)); }
            if (event.key === 'Enter' && searchResults[selectedResult]) openResult(searchResults[selectedResult].href);
          }} placeholder="Search customers, plans, invoices…" aria-label="Search resources or navigate" /><kbd>ESC</kbd><button className="icon-button" onClick={closeSearch} aria-label="Close search"><X size={16}/></button></div>
          <div className="command-results" role="listbox" aria-label="Search results">
            {!searchTerm.trim() && <p className="command-section-label">GO TO</p>}
            {searchTerm.trim().length === 1 && <p className="command-hint">Type at least two characters to search records.</p>}
            {(searchQuery.isFetching || (searchTerm.trim().length >= 2 && searchTerm.trim() !== debouncedSearch)) && <p className="command-hint">Searching workspace…</p>}
            {searchQuery.isError && searchTerm.trim().length >= 2 && searchTerm.trim() === debouncedSearch && <p className="command-error">Search is unavailable. Please try again.</p>}
            {searchResults.map((item, index) => {
              const Icon = item.Icon || resultIcon(item.type);
              return <button key={`${item.type}-${item.id || item.href}`} role="option" aria-selected={selectedResult === index} className={`command-result ${selectedResult === index ? 'highlighted' : ''}`} onMouseEnter={() => setSelectedResult(index)} onClick={() => openResult(item.href)}>
                <span className="command-result-icon"><Icon size={15}/></span><span className="command-result-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="command-type">{item.type}</span><ArrowRight size={14}/>
              </button>;
            })}
            {!searchQuery.isFetching && searchTerm.trim().length >= 2 && searchTerm.trim() === debouncedSearch && !searchQuery.isError && searchResults.length === 0 && <p className="command-hint">No matching records found.</p>}
          </div>
          <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>ESC</kbd> Close</span></footer>
        </motion.section>
      </motion.div>}</AnimatePresence>
    </div>
  );
}

function resultIcon(type) {
  return ({ Customer: Users, Product: Package, Plan: Tags, Subscription: Wallet, Invoice: FileText, Payment: CreditCard })[type] || Search;
}
