'use client';
import { AppStateProvider, useAppState } from '@/context/AppState';
import { DashboardDisplay } from '@/components/display/DashboardDisplay';
import { DashboardEditor } from '@/components/editor/DashboardEditor';
import { EOCDisplay } from '@/components/eoc/EOCDisplay';

function AppContent() {
  const { isDisplayMode, appMode } = useAppState();

  if (appMode === 'eoc') {
    return <EOCDisplay />;
  }

  if (isDisplayMode) {
    return <DashboardDisplay />;
  }

  return <DashboardEditor />;
}

export default function Home() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
