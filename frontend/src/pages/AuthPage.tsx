import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase/supabase';
import { AmbientGlyph } from '../components/BackgroundElements/AmbientGlyph';
import { CornerSigil } from '../components/BackgroundElements/CornerSigil';
import { RuneDivider } from '../components/BackgroundElements/RuneDivider';
import { HeaderOrnament } from '../components/BackgroundElements/HeaderOrnament';
import toast from 'react-hot-toast';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification step state
  const [showVerificationStep, setShowVerificationStep] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const navigate = useNavigate();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showVerificationStep && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [showVerificationStep, countdown]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logbook opened. Welcome back, apprentice.');
        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Trigger the verification slide
        setShowVerificationStep(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'The ink smudged. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-menu-container interactive-ui" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#e8e4db' }}>
      {/* Keeping background elements but overriding opacity to make them look like faded ink on parchment */}
      <div style={{ opacity: 0.15, filter: 'invert(1)' }}>
        <AmbientGlyph />
        <CornerSigil pos="tl" />
        <CornerSigil pos="tr" />
        <CornerSigil pos="bl" />
        <CornerSigil pos="br" />
      </div>

      <div className="main-menu-content" style={{
        background: '#f4f0e6', // Parchment color
        padding: '2.5rem 3.5rem',
        borderRadius: '4px',
        border: '1px solid #d3cbb8',
        boxShadow: 'none', // Removed colored shadow box as requested
        minWidth: '420px',
        color: '#3a3532', // Dark ink text
      }}>
        <div className="main-menu-hero" style={{ marginBottom: '1.5rem', filter: 'invert(1) hue-rotate(180deg)' }}>
          <HeaderOrnament />
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: '#2c2826', letterSpacing: '0.02em', fontWeight: 500 }}>
            {isLogin ? 'Atelier Logbook' : 'Apprentice Enrollment'}
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#68615b', fontStyle: 'italic' }}>
            {isLogin ? 'Ink your signature to resume your studies.' : 'Register your name with the Atelier.'}
          </p>
        </div>

        <div className="main-menu-divider" style={{ margin: '1.5rem 0', opacity: 0.3, filter: 'invert(1)' }}>
          <RuneDivider />
        </div>

        {showVerificationStep ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ color: '#59524c', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Your signature has been inscribed. However, the Atelier requires validation before granting access to the Sanctum.
              <br /><br />
              Please check your letters (email) for the seal of approval.
            </p>

            <button
              type="button"
              disabled={countdown > 0}
              onClick={() => {
                setShowVerificationStep(false);
                setIsLogin(true);
                setCountdown(5);
              }}
              style={{
                marginTop: '1rem', width: '100%', padding: '0.85rem',
                background: countdown > 0 ? '#b5aea5' : '#3a3532',
                color: '#f4f0e6',
                border: 'none', borderRadius: '2px',
                fontSize: '1rem', fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em', cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
            >
              {countdown > 0 ? `Awaiting Seal... (${countdown}s)` : 'Return to Logbook'}
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', color: '#59524c', fontSize: '0.85rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Magical Crest (Email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '0.75rem', background: '#faf8f5',
                    border: '1px solid #c8c0ad', borderRadius: '2px',
                    color: '#2c2826', fontSize: '1rem', outline: 'none', transition: 'all 0.2s',
                    fontFamily: 'var(--font-mono)'
                  }}
                  placeholder="apprentice@atelier.edu"
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#59524c', fontSize: '0.85rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Secret Seal (Password)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '0.75rem', background: '#faf8f5',
                    border: '1px solid #c8c0ad', borderRadius: '2px',
                    color: '#2c2826', fontSize: '1rem', outline: 'none', transition: 'all 0.2s',
                    fontFamily: 'var(--font-mono)'
                  }}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '1rem', width: '100%', padding: '0.85rem',
                  background: '#3a3532', color: '#f4f0e6',
                  border: 'none', borderRadius: '2px',
                  fontSize: '1rem', fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.05em', cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#504a46'}
                onMouseOut={(e) => e.currentTarget.style.background = '#3a3532'}
              >
                {loading ? 'Drawing seal...' : (isLogin ? 'Open Logbook' : 'Submit Enrollment')}
              </button>
            </form>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                style={{
                  background: 'none', border: 'none',
                  color: '#68615b', fontSize: '0.85rem',
                  textDecoration: 'underline', cursor: 'pointer',
                  fontStyle: 'italic'
                }}
              >
                {isLogin ? "A new apprentice? Enroll here." : "Already have a logbook? Open it."}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
