import { useState } from 'react';
import { Web3Provider } from './hooks/useWeb3';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import ProjectsView from './components/ProjectsView';
import JudgingView from './components/JudgingView';
import ScorecardView from './components/ScorecardView';
import LeaderboardView from './components/LeaderboardView';
import AdminView from './components/AdminView';
import TxHistoryView from './components/TxHistoryView';
import ToastContainer from './components/ToastContainer';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView setActiveTab={setActiveTab} />;
      case 'projects':
        return <ProjectsView setActiveTab={setActiveTab} />;
      case 'judging':
        return <JudgingView />;
      case 'scorecard':
        return <ScorecardView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'admin':
        return <AdminView />;
      case 'transactions':
        return <TxHistoryView />;
      default:
        return <DashboardView setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Web3Provider>
      <div className="app-container">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="main-content">
          {renderTab()}
        </main>
        <ToastContainer />
        <AuthModal />
        <ProfileModal />
      </div>
    </Web3Provider>
  );
}
