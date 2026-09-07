import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ProjectDrawer } from './components/ProjectDrawer';
import { NewTaskModal } from './components/NewTaskModal';
import { NewProjectModal } from './components/NewProjectModal';
import { NewEquipmentModal } from './components/NewEquipmentModal';
import { NewTeamModal } from './components/NewTeamModal';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/ToastContainer';
import { HubView } from './components/views/HubView';
import { ProjectsView } from './components/views/ProjectsView';
import { TasksView } from './components/views/TasksView';
import { EquipmentView } from './components/views/EquipmentView';
import { TeamView } from './components/views/TeamView';
import { SoonView } from './components/views/SoonView';

const MainContent: React.FC = () => {
  const { curView } = useApp();

  const renderCurrentView = () => {
    switch (curView) {
      case 'hub':
        return <HubView />;
      case 'projects':
        return <ProjectsView />;
      case 'tasks':
        return <TasksView />;
      case 'equipment':
        return <EquipmentView />;
      case 'team':
        return <TeamView />;
      case 'soon':
        return <SoonView />;
      default:
        return <HubView />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0" id="main-scroll">
      <div className="max-w-[1440px] mx-auto w-full">
        {renderCurrentView()}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen w-screen bg-[#09090b] text-[#fafafa] overflow-hidden select-none font-sans">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.06),transparent_65%)]">
          <Topbar />
          <MainContent />
        </main>

        {/* Global Overlays and Modals */}
        <ProjectDrawer />
        <NewTaskModal />
        <NewProjectModal />
        <NewEquipmentModal />
        <NewTeamModal />
        <CommandPalette />
        <ShortcutsModal />
        <ToastContainer />
      </div>
    </AppProvider>
  );
}
