import { publicAsset } from '../publicAsset.js';
import React from 'react';
import Icon from '../components/Icon';

export default function Intro() {
    return (
        <div className="page intro-page" style={{
            height: '100vh',
            background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            textAlign: 'center',
            padding: '0 10%',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Background Decorative Elements */}
            <div style={{ position: 'absolute', top: '10%', left: '10%', width: 300, height: 300, background: 'rgba(56, 189, 248, 0.05)', borderRadius: '50%', filter: 'blur(80px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 400, height: 400, background: 'rgba(16, 185, 129, 0.05)', borderRadius: '50%', filter: 'blur(100px)' }} />

            <div style={{ animation: 'fadeInUp 1s ease-out' }}>
                <img src={publicAsset('sentinel_logo.png')} alt="Sentinel" style={{ width: 120, height: 120, marginBottom: 40, filter: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.4))' }} />

                <h1 style={{ fontSize: '4rem', fontWeight: 800, letterSpacing: 8, margin: 0, background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    SENTINEL
                </h1>
                <div style={{ fontSize: '1.2rem', color: '#38bdf8', letterSpacing: 4, fontWeight: 600, marginBottom: 60, textTransform: 'uppercase' }}>
                    Decision Operating System
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 1000, margin: '0 auto' }}>
                    <div style={{ textAlign: 'left', padding: '30px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, border: '1px solid rgba(239, 68, 68, 0.3)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -15, left: 20, background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700 }}>THE PAIN POINT</div>
                        <h3 style={{ color: '#fca5a5', marginBottom: 12 }}>Structural Revenue Leakage (SRL)</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                            High-value crops suffer "invisible" profit loss. Traditional agriculture relies on a 12-hour "Decision Vacuum" between data and action.
                        </p>
                    </div>

                    <div style={{ textAlign: 'left', padding: '30px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, border: '1px solid rgba(52, 211, 153, 0.3)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: -15, left: 20, background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700 }}>THE SOLUTION</div>
                        <h3 style={{ color: '#86efac', marginBottom: 12 }}>Deterministic Profit Engine</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                            Sentinel closes the gap with autonomous reasoning. 24/7 proactive monitoring transforms uncertainty into controlled growth.
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: 80, fontSize: '0.8rem', color: '#475569', letterSpacing: 2 }}>
                    PRE-FLIGHT CHECK: SYSTEM INITIALIZING...
                </div>
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
