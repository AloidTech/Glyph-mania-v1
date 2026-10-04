import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOutIcon, SignInIcon, UserCircleIcon } from '@phosphor-icons/react';
import { supabase } from '../../lib/supabase/supabase';
import { useAuth } from '../../lib/supabase/auth/useAuth';
import toast from 'react-hot-toast';

interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 8 directional frames from alex_idle_rotation_spritesheet_config.json
const FRAMES: FrameRect[] = [
  { x: 0, y: 0, width: 256, height: 256 },
  { x: 256, y: 0, width: 256, height: 256 },
  { x: 512, y: 0, width: 256, height: 256 },
  { x: 768, y: 0, width: 256, height: 256 },
  { x: 1024, y: 0, width: 256, height: 256 },
  { x: 1280, y: 0, width: 256, height: 256 },
  { x: 1536, y: 0, width: 256, height: 256 },
  { x: 1792, y: 0, width: 256, height: 256 },
];

export const CharacterRotatingStand: React.FC = () => {
  const { user } = useAuth();
  const [frameIndex, setFrameIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startFrame, setStartFrame] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();

  // Automatic rotation tick (smooth ~6 frames per second when idle)
  useEffect(() => {
    if (isDragging) return;

    const intervalTime = isHovered ? 120 : 180;
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isDragging, isHovered]);

  // Pointer drag controls to spin the character manually
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setStartX(e.clientX);
    setStartFrame(frameIndex);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    // Every 24px of drag rotates one frame
    const frameOffset = Math.floor(deltaX / 24);
    const newIndex = (((startFrame + frameOffset) % FRAMES.length) + FRAMES.length) % FRAMES.length;
    setFrameIndex(newIndex);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to log out.');
    } else {
      toast.success('Logged out successfully.');
      setShowProfileModal(false);
    }
  };

  const currentFrame = FRAMES[frameIndex];
  const username = user?.email ? user.email.split('@')[0] : 'Apprentice';

  return (
    <>
      <div className="character-stand-container">
        {/* Character Title / Name Badge (like Minecraft player name tag) */}
        <div className="character-name-badge">
          <span className="character-name-text">{username}</span>
        </div>

        {/* Character Stage & Rotating Model */}
        <div
          className="character-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Drag to spin apprentice"
        >
          {/* Arcane Pedestal Glow */}
          <div className="pedestal-arcane-glow" />

          {/* Stepped Arcane Inscribed Pedestal / Base */}
          <div className="pedestal-stepped-base">
            <div className="pedestal-ring pedestal-ring-outer" />
            <div className="pedestal-ring pedestal-ring-inner" />
          </div>

          {/* Sprite Frame Cropper */}
          <div
            className="character-sprite-crop"
            style={{
              backgroundImage: `url('/sprites/alex_idle_rotation_spritesheet.png')`,
              backgroundPosition: `-${currentFrame.x}px -${currentFrame.y}px`,
            }}
          />
        </div>

        {/* Action Button Below Pedestal (Replaces Minecraft 'Dressing Room') */}
        <div className="character-stand-actions">
          {user ? (
            <button
              onClick={() => setShowProfileModal(true)}
              className="character-action-btn"
              title="View your Atelier credentials and profile"
            >
              <UserCircleIcon size={16} weight="bold" />
              <span>Profile / Sanctum</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="character-action-btn character-action-btn-primary"
              title="Sign in with your Atelier Logbook"
            >
              <SignInIcon size={16} weight="bold" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile & Account Modal Dialog */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div
            className="settings-modal character-profile-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '380px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--color-primary, #3a3532)',
                  color: '#f4f0e6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <UserCircleIcon size={44} weight="fill" />
              </div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.4rem' }}>Atelier Logbook</h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  wordBreak: 'break-all',
                }}
              >
                {user?.email}
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface-raised, #fbf9f4)',
                border: '1px solid var(--color-border, #d3cbb8)',
                borderRadius: '4px',
                padding: '0.85rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
                <strong style={{ color: 'var(--color-text-primary)' }}>Inscribed Mage</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Apprentice ID:</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-dim)',
                  }}
                >
                  {user?.id ? `${user.id.slice(0, 8)}...` : 'Local'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                onClick={handleLogout}
                className="btn-arcane-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  color: 'var(--color-destructive, #8a3028)',
                  borderColor: 'rgba(138, 48, 40, 0.3)',
                }}
              >
                <SignOutIcon size={18} weight="bold" />
                <span>Close Logbook (Logout)</span>
              </button>

              <button
                onClick={() => setShowProfileModal(false)}
                className="btn-arcane-ghost"
                style={{ padding: '0.5rem 1rem' }}
              >
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CharacterRotatingStand;
