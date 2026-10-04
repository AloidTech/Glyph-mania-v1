import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/supabase/auth/useAuth';
import { CircularSpinner } from '../Common/CircularLoadingComponents';

export const AdminRouteGuard: React.FC = () => {
  const { isLoggedIn, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--admin-bg, #f4f0e6)',
          color: 'var(--admin-ink, #2c2826)',
          gap: '1rem',
        }}
      >
        <CircularSpinner size={40} />
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
          Verifying Sanctum Credentials...
        </p>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Logged in but not an admin -> show Access Denied
  if (!isAdmin) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--admin-bg, #f4f0e6)',
          color: 'var(--admin-ink, #2c2826)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            color: '#8b0000',
            marginBottom: '0.75rem',
          }}
        >
          Sanctum Restricted
        </h2>
        <p style={{ maxWidth: '480px', lineHeight: 1.6, color: '#59524c', marginBottom: '1.5rem' }}>
          Your seal lacks the administrative authority required to inscribe or modify core sigil
          archetypes. Please contact the high mages if you require access.
        </p>
        <a
          href="/"
          className="btn-arcane-secondary"
          style={{
            textDecoration: 'none',
            padding: '0.75rem 1.5rem',
            background: '#3a3532',
            color: '#f4f0e6',
            borderRadius: '2px',
          }}
        >
          Return to Workshop
        </a>
      </div>
    );
  }

  // Admin verified -> render children
  return <Outlet />;
};

export default AdminRouteGuard;
