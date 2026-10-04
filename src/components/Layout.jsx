import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useStore from '../engine/store';
import { aiWatchdog } from '../data/mockData';
import PageClock from './PageClock';
import Icon from './Icon';
import SubtitleOverlay from './SubtitleOverlay';
import IterativeReasoningOverlay from './IterativeReasoningOverlay';
import { pick, formatLocaleTime } from '../i18n/locale.js';

const navItems = [
    { path: '/game', label: 'Farm Game', labelZh: '农场试玩', iconName: 'dashboard' },
    { path: '/', label: 'Dashboard', labelZh: '指挥中心', iconName: 'dashboard' },
    { path: '/sensors', label: 'Sensor Telemetry', labelZh: '传感数据', iconName: 'sensors' },
    { path: '/risk', label: 'Risk Assessment', labelZh: '风险评估', iconName: 'risk', alertKey: 'risk' },
    { path: '/prescription', label: 'Prescription', labelZh: '处方', iconName: 'prescription' },
    { path: '/execution', label: 'Execution', labelZh: '执行', iconName: 'execution' },
    { path: '/audit', label: 'Audit Report', labelZh: '审计', iconName: 'audit' },
    { path: '/history', label: 'History', labelZh: '历史', iconName: 'history' },
    { path: '/scenarios', label: 'Scenarios', labelZh: '场景', iconName: 'scenarios' },
    { path: '/admin', label: 'Admin', labelZh: '配置', iconName: 'admin' },
];

export default function Layout() {
    const {
        activeFieldId,
        setActiveField,
        fields,
        activeScenario,
        scenarioStep,
        initSimulation,
        currentDay,
        approvalQueue,
        loadScenario,
        autonomousMode,
        setAutonomousMode,
        autonomousState,
        startAutonomousLoop,
        stopAutonomousLoop,
        riskResults,
        operatorAlerts,
        activeExecution,
        locale,
        setLocale,
    } = useStore();
    const navigate = useNavigate();
    const t = (en, zh) => pick(locale, en, zh);

    useEffect(() => {
        initSimulation();
        startAutonomousLoop();
        return () => stopAutonomousLoop();
    }, [initSimulation, startAutonomousLoop, stopAutonomousLoop]);

    const topRiskScore = riskResults?.[0]?.score || 0;
    const showRiskBadge = approvalQueue.length > 0
        || (operatorAlerts?.length || 0) > 0
        || (topRiskScore >= 70 && !activeExecution?.comparisonReport);

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <img src="/sentinel_logo.png" alt="Sentinel" className="sidebar-logo" style={{ width: 52, height: 52, filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.3))' }} />
                    <div>
                        <div className="sidebar-title" style={{ fontSize: '1.4rem', letterSpacing: 4, fontWeight: 800 }}>SENTINEL</div>
                        <div className="sidebar-subtitle" style={{ letterSpacing: 2, fontSize: '0.6rem', color: '#64748b' }}>{t('Decision OS', '决策操作系统')}</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            end={item.path === '/'}
                            style={{ position: 'relative' }}
                        >
                            {({ isActive }) => (
                                <>
                                    <span className="sidebar-icon">
                                        <Icon name={item.iconName} size={16} className="nav-icon" color={isActive ? '#38bdf8' : '#64748b'} />
                                    </span>
                                    <span className="sidebar-label">{t(item.label, item.labelZh)}</span>
                                    {item.alertKey === 'risk' && showRiskBadge && <span className="nav-badge" />}
                                    {item.path === '/prescription' && approvalQueue.length > 0 && (
                                        <span className="nav-approval-badge">{approvalQueue.length}</span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div style={{ fontSize: '0.6rem', color: '#475569', marginBottom: 4 }}>
                        {t('Season', '季节阶段')}: {t('Flowering', '开花期')} {'->'} {t('Harvest', '采收期')}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#475569' }}>
                        {t('Day', '第')} {currentDay || 18} / 120
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 6 }}>
                        {t('Sentinel Engine v4.2', 'Sentinel 引擎 v4.2')}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                        {t('Build 2026.03', '构建 2026.03')}
                    </div>
                </div>
            </aside>

            <div className="main-wrapper">
                <header className="topbar">
                    <div className="topbar-left">
                        <select
                            className="field-selector"
                            value={activeFieldId}
                            onChange={e => setActiveField(e.target.value)}
                        >
                            {Object.values(fields).map(f => (
                                <option key={f.id} value={f.id}>{locale === 'zh' ? (f.nameZh || f.name) : f.name}</option>
                            ))}
                        </select>

                        {activeScenario && (
                            <>
                                <div className="scenario-indicator">
                                    <span className="scenario-dot" style={{ background: activeScenario.riskLevel === 'critical' ? '#ef4444' : activeScenario.riskLevel === 'high' ? '#f59e0b' : '#3dabf5' }} />
                                    <span>{t('Scenario', '场景')} {activeScenario.id}: {locale === 'zh' ? (activeScenario.nameZh || activeScenario.name) : activeScenario.name}</span>
                                    <span className="scenario-progress">{t('Step', '步骤')} {scenarioStep}/{activeScenario.events.length}</span>
                                </div>
                                <button
                                    className="btn-return-scenarios"
                                    onClick={() => { loadScenario(null); navigate('/scenarios'); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '5px 14px', borderRadius: 8,
                                        background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(100,116,139,0.25)',
                                        color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.2s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.12)'; e.currentTarget.style.color = '#34d399'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,41,59,0.7)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(100,116,139,0.25)'; }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                    {t('Return to Scenarios', '返回场景中心')}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="topbar-right">
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                            <button
                                type="button"
                                className={`btn ${locale === 'en' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ minWidth: 54, padding: '5px 10px', fontSize: '0.68rem' }}
                                onClick={() => setLocale('en')}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={`btn ${locale === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ minWidth: 54, padding: '5px 10px', fontSize: '0.68rem', marginLeft: 6 }}
                                onClick={() => setLocale('zh')}
                            >
                                {t('Chinese', '中文')}
                            </button>
                        </div>
                        <button
                            className={`btn ${autonomousMode ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => setAutonomousMode(!autonomousMode)}
                            style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <Icon name={autonomousMode ? 'play' : 'pause'} size={12} />
                            {t('Auto Loop', '自动循环')} {autonomousMode ? t('On', '开') : t('Off', '关')}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(56,189,248,0.08)', borderRadius: 8, marginRight: 8, border: '1px solid rgba(56,189,248,0.2)' }}>
                            <Icon name="activity" size={12} color="#38bdf8" />
                            <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700 }}>{t('Cycle', '轮次')} {autonomousState.cycleCount}</span>
                            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                                {autonomousState.status === 'running'
                                    ? t('running', '运行中')
                                    : autonomousState.status === 'paused'
                                        ? t('paused', '已暂停')
                                        : autonomousState.status === 'stopped'
                                            ? t('stopped', '已停止')
                                            : autonomousState.status}
                            </span>
                        </div>

                        {approvalQueue.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 8, marginRight: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                                <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="warning" size={12} color="#f59e0b" /> {approvalQueue.length} {t('Pending Approval', '待人工审批')}</span>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(52,211,153,0.06)', borderRadius: 8, marginRight: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', animation: 'watchdog-pulse 2s infinite' }} />
                            <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 600 }}>{t('AI Active', 'AI 在线')}</span>
                            <span style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                {t('Last scan', '最近扫描')}{' '}
                                {formatLocaleTime(locale, aiWatchdog.lastScan, { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                        </div>

                        <PageClock />

                        <div className="topbar-status">
                            <span className="status-light" />
                            <span>{t('System Online', '系统在线')}</span>
                        </div>
                    </div>
                </header>

                <main className="main-content">
                    <Outlet />
                </main>
                <SubtitleOverlay />
            </div>
            <IterativeReasoningOverlay />
        </div>
    );
}
