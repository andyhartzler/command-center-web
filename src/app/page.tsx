'use client';
import { AppStateProvider, useAppState } from '@/context/AppState';
import { DashboardDisplay } from '@/components/display/DashboardDisplay';
import { DashboardEditor } from '@/components/editor/DashboardEditor';
import { EOCDisplay } from '@/components/eoc/EOCDisplay';
import { MomentProvider } from '@/components/display/MomentLayer';
import { AmbianceProvider } from '@/components/display/AmbianceProvider';

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
      <MomentProvider>
        <AppContent />
        <AmbianceProvider />
      </MomentProvider>
    </AppStateProvider>
  );
}
