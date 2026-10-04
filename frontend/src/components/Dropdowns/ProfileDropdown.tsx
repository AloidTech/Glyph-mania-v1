import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOutIcon, SignInIcon, UserCircleIcon } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase/supabase';
import { useAuth } from '../../lib/supabase/auth/useAuth';
import toast from 'react-hot-toast';

export const ProfileDropdown: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to logout.');
    } else {
      toast.success('Logged out successfully.');
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        bottom: '2rem',
        left: '2rem',
        zIndex: 50
      }}
    >
      {/* Dropdown Menu (Opens Upwards) */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 0.75rem)',
          left: 0,
          background: 'var(--color-bg-panel, #f4f0e6)',
          border: '1px solid var(--color-border, #d3cbb8)',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '160px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.25rem 0',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}>
          {user ? (
            <>
              <div style={{
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--color-border, #d3cbb8)',
                fontSize: '0.8rem',
                color: 'var(--color-text-muted, #68615b)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}>
                {user.email}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text, #3a3532)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <SignOutIcon size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/auth');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text, #3a3532)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <SignInIcon size={16} />
                Login / Sign Up
              </button>
            </>
          )}
        </div>
      )}

      {/* Profile Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '3.2rem',
          height: '3.2rem',
          borderRadius: '50%',
          border: '2px solid var(--color-glass-border-strong)',
          background: 'var(--color-glass)',
          color: 'var(--color-primary, #2c2826)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.background = 'var(--color-glass-raised)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = 'var(--color-glass)';
        }}
        aria-label="Profile Menu"
        title="Profile Options"
      >
        <UserCircleIcon size={56} weight={user ? "fill" : "regular"} />
      </button>
    </div>
  );
};

export default ProfileDropdown;
