import React from 'react';
import { Link } from 'react-router-dom';
import { HouseIcon } from '@phosphor-icons/react';

export const AboutPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100svh',
        width: '100svw',
        backgroundColor: '#0a0a14',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 600,
          width: '100%',
          padding: '2.5rem',
          borderRadius: '1rem',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          border: '1px solid rgba(201,162,39,0.2)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading, sans-serif)',
            color: 'var(--color-accent, #c9a227)',
            letterSpacing: '0.1em',
            marginBottom: '1rem',
          }}
        >
          ABOUT GLYPH MANIA
        </h1>

        <p style={{ lineHeight: '1.6', color: '#a0aec0', marginBottom: '2rem' }}>
          Glyph Mania is an arcane sigil drawing and craft game powered by Atrament canvas detection and Phaser 3.
        </p>

        <Link
          to="/"
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            textDecoration: 'none',
          }}
        >
          <HouseIcon size={20} />
          Return to Game
        </Link>
      </div>
    </div>
  );
};

export default AboutPage;
