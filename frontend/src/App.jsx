import React, { useEffect, useState } from 'react';
import './App.css';

import { useAuth } from './auth/AuthContext.jsx';
import { ROLES, ROLE_LABELS, canManageUsers } from './auth/permissions.js';
import { formatKoreanDate, today } from './utils/date.js';

import LoginPage from './pages/LoginPage.jsx';
import SignPage from './pages/SignPage.jsx';
import ContractPage from './pages/ContractPage.jsx';
import CustomerManagement from './components/CustomerManagement.jsx';
import ScheduleManagement from './components/ScheduleManagement.jsx';
import ProgressStatus from './components/ProgressStatus.jsx';
import StatsPage from './pages/StatsPage.jsx';
import AccountManagement from './pages/AccountManagement.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

// 메뉴 정의. 새 메뉴는 여기에 추가하고 필요한 권한(perm)만 지정하면 됩니다.
const MENUS = [
  {
    key: 'contract',
    label: '계약관리',
    icon: '📝',
    perm: 'contract.view',
    subs: [
      { key: 'main', label: '계약관리' },
      { key: 'trash', label: '휴지통', perm: 'contract.delete' },
    ],
  },
  { key: 'customer', label: '계약자관리', icon: '👤', perm: 'customer.view' },
  { key: 'schedule', label: '일정관리', icon: '📅', perm: 'schedule.view' },
  { key: 'progress', label: '진행상황', icon: '📑', perm: 'stats.view' },
  { key: 'stats', label: '통계정보', icon: '📊', perm: 'stats.view' },
  { key: 'accounts', label: '계정관리', icon: '🔑', visible: canManageUsers },
  { key: 'setting', label: '설정', icon: '⚙️', always: true },
];

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const { user, loading } = useAuth();

  // 고객 전자서명 페이지는 로그인 없이 접근
  const signMatch = hash.match(/^#\/sign\/([\w-]+)/);
  if (signMatch) return <SignPage token={signMatch[1]} />;

  if (loading) return <div className="page-loading">불러오는 중...</div>;
  if (!user) return <LoginPage />;
  return <MainLayout />;
}

function MainLayout() {
  const { user, company, logout, can } = useAuth();

  const menus = MENUS.filter((m) => {
    if (user.role === ROLES.SUPER) return m.key === 'accounts' || m.key === 'setting';
    if (m.always) return true;
    if (m.visible) return m.visible(user);
    return can(m.perm);
  });

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('lastActiveTab') || 'contract');
  const [subTab, setSubTab] = useState('main');
  const [openDropdown, setOpenDropdown] = useState(null);
  // 상단 빠른 버튼 → 이동한 화면에서 등록 모달을 한 번 열도록 전달 ('newContract' | 'newCustomer')
  const [pendingAction, setPendingAction] = useState(null);
  const clearAction = () => setPendingAction(null);

  const currentTab = menus.some((m) => m.key === activeTab) ? activeTab : menus[0]?.key;

  const go = (tab, sub = 'main') => {
    setActiveTab(tab);
    setSubTab(sub);
    setOpenDropdown(null);
    localStorage.setItem('lastActiveTab', tab);
  };

  const periodEnd = company?.periodEnd;
  const daysLeft = periodEnd
    ? Math.ceil((new Date(`${periodEnd}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000)
    : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-logo" onClick={() => go(menus[0]?.key)}>
          <span className="logo-box">U</span>
          <span className="logo-text">{company ? `${company.name} UFFICE` : 'UFFICE 운영자'}</span>
        </div>
        <nav className="main-nav-bar">
          {menus.map((m) => {
            const subs = (m.subs || []).filter((s) => !s.perm || can(s.perm));
            return (
              <div
                key={m.key}
                className={`nav-item ${currentTab === m.key ? 'active' : ''}`}
                onMouseEnter={() => subs.length > 1 && setOpenDropdown(m.key)}
                onMouseLeave={() => setOpenDropdown(null)}
                onClick={() => go(m.key)}
              >
                <div className="nav-icon">{m.icon}</div>
                <span className="nav-label">{m.label}</span>
                {openDropdown === m.key && (
                  <div className="dropdown-menu">
                    {subs.map((s) => (
                      <div
                        key={s.key}
                        className={`dropdown-item ${currentTab === m.key && subTab === s.key ? 'active-sub' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          go(m.key, s.key);
                        }}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </header>

      <div className="sub-header">
        <div className="quick-btn-group">
          {can('customer.edit') && (
            <button type="button" className="btn-quick blue" onClick={() => { go('customer'); setPendingAction('newCustomer'); }}>
              👤 계약자 등록
            </button>
          )}
          {can('contract.create') && (
            <button type="button" className="btn-quick primary" onClick={() => { go('contract'); setPendingAction('newContract'); }}>
              ✏️ 빠른계약등록
            </button>
          )}
        </div>
        <div className="welcome">
          <span className="welcome-date">{formatKoreanDate(today())}</span>
          <span>
            {user.name}({ROLE_LABELS[user.role]})님 환영합니다.
          </span>
          {daysLeft !== null && daysLeft <= 14 && (
            <span className="period-warning">이용기간 만료 {daysLeft}일 전 ({periodEnd})</span>
          )}
          <button type="button" className="btn-logout" onClick={logout}>
            로그아웃
          </button>
        </div>
      </div>

      <main className="content">
        {currentTab === 'contract' && (
          <ContractPage
            trash={subTab === 'trash' && can('contract.delete')}
            openNew={pendingAction === 'newContract'}
            onOpenNewHandled={clearAction}
          />
        )}
        {currentTab === 'customer' && (
          <CustomerManagement openNew={pendingAction === 'newCustomer'} onOpenNewHandled={clearAction} />
        )}
        {currentTab === 'schedule' && <ScheduleManagement />}
        {currentTab === 'progress' && <ProgressStatus />}
        {currentTab === 'stats' && <StatsPage />}
        {currentTab === 'accounts' && <AccountManagement />}
        {currentTab === 'setting' && <SettingsPage />}
      </main>
    </div>
  );
}
