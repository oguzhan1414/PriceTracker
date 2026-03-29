// src/pages/Dashboard.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Topbar from '../components/dashboard/Topbar';
import { usePageSeo } from '../lib/seo';
import '../styles/pages/Dashboard.css';
import '../styles/pages/DashboardShared.css';

const Dashboard = () => {
    usePageSeo({
        title: 'Dashboard',
        description: 'Private dashboard for managing tracked items, deals, and notification settings.',
        path: '/dashboard',
        noindex: true,
    });

    return (
        <div className="dashboard-container">
            <Sidebar />
            <main className="dashboard-main">
                <Topbar />
                <div className="dashboard-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;