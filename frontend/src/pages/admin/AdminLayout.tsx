import React, { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { useTrainingStore, subscribeToRealtimeTrainingExamples } from '../../lib/ml/training_store';
import { useAdminSigilsStore, subscribeToRealtimeSigils } from '../../lib/stores/admin_sigils_store';
import { useElementsStore, subscribeToRealtimeElements } from '../../lib/stores/elements_store';
import { AdminNavBar } from '../../components/admin/AdminNavBar';

export const AdminLayout: React.FC = () => {
  const untrainedCount = useTrainingStore((state) => state.getUntrainedExamplesCount());
  const sigils = useAdminSigilsStore((state) => state.sigils);
  const firstSigilId = sigils.length > 0 ? sigils[0].id : null;
  const trainLink = firstSigilId ? `/admin_dashboard/sigils/${firstSigilId}/training` : `/admin_dashboard/sigils`;

  useEffect(() => {
    // Initial fetch of cloud data
    useAdminSigilsStore.getState().loadRemoteSigils().catch((e) => console.warn('Could not load remote sigils:', e));
    useTrainingStore.getState().loadRemoteExamples().catch((e) => console.warn('Could not load remote examples:', e));
    useElementsStore.getState().loadElements().catch((e) => console.warn('Could not load remote elements:', e));

    // Live realtime sync from Supabase
    const unsubSigils = subscribeToRealtimeSigils();
    const unsubExamples = subscribeToRealtimeTrainingExamples();
    const unsubElements = subscribeToRealtimeElements();

    return () => {
      unsubSigils();
      unsubExamples();
      unsubElements();
    };
  }, []);

  return (
    <div className="admin-layout">
      {/* Reusable Admin Navigation Bar */}
      <AdminNavBar />

      {untrainedCount > 0 && (
        <div
          style={{
            background: 'var(--admin-accent-subtle)',
            color: 'var(--admin-ink)',
            padding: '0.65rem 1rem',
            textAlign: 'center',
            fontSize: '0.85rem',
            borderBottom: '1px solid var(--admin-accent)',
          }}
        >
          <WarningCircleIcon
            size={16}
            weight="fill"
            style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem', color: 'var(--admin-accent)' }}
          />
          You have <strong>{untrainedCount}</strong> new {untrainedCount === 1 ? 'example' : 'examples'} since your last training.{' '}
          <Link
            to={trainLink}
            state={{ tab: 'train' }}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              borderBottom: '1px dotted var(--admin-ink)',
              fontWeight: 600,
            }}
          >
            Go train the model
          </Link>
        </div>
      )}

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};
