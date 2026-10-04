import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PhaserCanvas } from './components/PhaserCanvas';
import { MainMenuUi } from './components/SceneUi/MainMenuUi';
import MobileOrientationWarning from './components/MobileOrientationWarning';
import { SettingsModal } from './components/SettingsModal';
import { WorkshopSceneUi } from './components/SceneUi/WorkshopSceneUi';
import { AboutPage } from './pages/AboutPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { SigilsListPage } from './pages/admin/SigilsListPage';
import { SigilCreatePage } from './pages/admin/SigilCreatePage';
import { SigilDetailPage } from './pages/admin/SigilDetailPage';
import { SigilTrainingPage } from './pages/admin/SigilTrainingPage';
import { GlyphsListPage } from './pages/admin/GlyphsListPage';
import { GlyphTestingPage } from './pages/admin/GlyphTestingPage';
import { ElementsListPage } from './pages/admin/ElementsListPage';
import { ElementDetailPage } from './pages/admin/ElementDetailPage';
import { EffectsListPage } from './pages/admin/EffectsListPage';
import { SpriteStudioPage } from './pages/admin/SpriteStudioPage';
import { VideoFramePickerPage } from './pages/admin/VideoFramePickerPage';
import { AuthPage } from './pages/AuthPage';
import { TestingGroundUi } from './components/SceneUi/TestingGroundUi';
import { useGameStore } from './lib/stores/store';

const GameView: React.FC = () => {
  const activeScreen = useGameStore((state) => state.activeScreen);

  return (
    <div className="app-container">
      <MobileOrientationWarning />
      {/* Transparent Phaser 3 Canvas Background */}
      <PhaserCanvas />

      {/* React UI Floating Overlays */}
      {activeScreen === 'MAIN_MENU' && <MainMenuUi />}
      {activeScreen === 'SETTINGS' && <SettingsModal />}
      {(activeScreen === 'IN_GAME' || activeScreen === 'PAUSED') && <WorkshopSceneUi />}
      {activeScreen === 'TESTING_GROUND' && <TestingGroundUi />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameView />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Admin Dashboard Sigils Studio Routes */}
        <Route path="/admin_dashboard/sigils" element={<AdminLayout />}>
          <Route index element={<SigilsListPage />} />
          <Route path="create" element={<SigilCreatePage />} />
          <Route path=":id" element={<SigilDetailPage />} />
          <Route path=":id/training" element={<SigilTrainingPage />} />
        </Route>

        {/* Admin Dashboard Elements Routes */}
        <Route path="/admin_dashboard/elements" element={<AdminLayout />}>
          <Route index element={<ElementsListPage />} />
          <Route path=":id" element={<ElementDetailPage />} />
        </Route>

        <Route path="/admin/elements" element={<AdminLayout />}>
          <Route index element={<ElementsListPage />} />
          <Route path=":id" element={<ElementDetailPage />} />
        </Route>

        {/* Admin Dashboard Master Effects Routes */}
        <Route path="/admin_dashboard/effects" element={<AdminLayout />}>
          <Route index element={<EffectsListPage />} />
        </Route>

        <Route path="/admin/effects" element={<AdminLayout />}>
          <Route index element={<EffectsListPage />} />
        </Route>

        {/* Admin Dashboard Glyphs Catalog & Testing Routes */}
        <Route path="/admin_dashboard/glyphs" element={<AdminLayout />}>
          <Route index element={<GlyphsListPage />} />
          <Route path="testing" element={<GlyphTestingPage />} />
        </Route>

        {/* Aliased Direct Routes for /admin/glyph, /admin/glyphs, and /glyph/testing */}
        <Route path="/admin/glyph" element={<AdminLayout />}>
          <Route index element={<GlyphsListPage />} />
          <Route path="testing" element={<GlyphTestingPage />} />
        </Route>

        <Route path="/admin/glyphs" element={<AdminLayout />}>
          <Route index element={<GlyphsListPage />} />
          <Route path="testing" element={<GlyphTestingPage />} />
        </Route>

        <Route path="/glyph/testing" element={<AdminLayout />}>
          <Route index element={<GlyphTestingPage />} />
        </Route>

        {/* Admin Dashboard Sprite Studio Routes */}
        <Route path="/admin_dashboard/sprites" element={<AdminLayout />}>
          <Route index element={<SpriteStudioPage />} />
        </Route>

        <Route path="/admin/sprites" element={<AdminLayout />}>
          <Route index element={<SpriteStudioPage />} />
        </Route>

        {/* Admin Dashboard Video Frame Picker Routes */}
        <Route path="/admin_dashboard/frame_picker" element={<AdminLayout />}>
          <Route index element={<VideoFramePickerPage />} />
        </Route>
        <Route path="/admin/frame_picker" element={<AdminLayout />}>
          <Route index element={<VideoFramePickerPage />} />
        </Route>

        {/* Fallback to sigils catalog */}
        <Route path="/admin" element={<Navigate to="/admin_dashboard/sigils" replace />} />
        <Route path="/admin_dashboard" element={<Navigate to="/admin_dashboard/sigils" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
