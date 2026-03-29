import { 
    LayoutDashboard, 
    Eye, 
    Tag, 
    Plus, 
    Settings, 
    LogOut 
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTrackedItems } from '../../hooks/useTrackedItems';
import { useToast } from '../../ui/ToastContext';

const Sidebar = () => {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const { items } = useTrackedItems();
    const { showToast } = useToast();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const isTr = user?.language === 'tr';

    const newDealsCount = useMemo(() => {
        const now = Date.now();
        return items.filter((item) => {
            const current = item.product.current_price;
            const target = item.target_price;
            if (current == null || target == null) return false;
            if (current > target) return false;
            const updatedAt = item.product.last_checked_at || item.created_at;
            const ts = new Date(updatedAt).getTime();
            if (Number.isNaN(ts)) return false;
            return now - ts <= 24 * 60 * 60 * 1000;
        }).length;
    }, [items]);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await logout();
            showToast('success', isTr ? 'Cikis yapildi.' : 'Logged out successfully.');
        } catch {
            showToast('info', isTr ? 'Oturum yerelde temizlendi. Tekrar giris yapabilirsin.' : 'Session cleared locally. You can sign in again.');
        } finally {
            setIsLoggingOut(false);
            navigate('/login', { replace: true });
        }
    };

    return (
        <aside className="dashboard-sidebar">
            <div>
                <div className="sidebar-logo">
                    <h1>BORSA PUSULASI</h1>
                    <p>{isTr ? 'DIJITAL GOZLEMLEME' : 'DIGITAL OBSERVATORY'}</p>
                </div>

                <nav className="nav-menu">
                    <NavLink 
                        to="/dashboard" 
                        end 
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={18} />
                        <span>{isTr ? 'Panel' : 'Dashboard'}</span>
                    </NavLink>
                    <NavLink 
                        to="/dashboard/watchlist" 
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Eye size={18} />
                        <span>{isTr ? 'Takip Listesi' : 'Watchlist'}</span>
                    </NavLink>
                    <NavLink 
                        to="/dashboard/deals" 
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Tag size={18} />
                        <span>{isTr ? 'Firsatlar' : 'Deals'}</span>
                        {newDealsCount > 0 && (
                            <span className="deal-badge-dot" title={isTr ? `${newDealsCount} yeni firsat` : `${newDealsCount} new deals`}></span>
                        )}
                    </NavLink>
                </nav>

                <button className="add-track-btn" onClick={() => navigate('/dashboard/watchlist')}>
                    <Plus size={16} />
                    {isTr ? 'Yeni Takip Ekle' : 'Add New Track'}
                </button>
            </div>

            <div className="sidebar-footer">
                <nav className="nav-menu" style={{marginTop: 0, marginBottom: '1rem'}}>
                    <NavLink 
                        to="/dashboard/settings" 
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Settings size={18} />
                        <span>{isTr ? 'Ayarlar' : 'Settings'}</span>
                    </NavLink>
                </nav>
                <button className="logout-btn" onClick={handleLogout} disabled={isLoggingOut}>
                    <LogOut size={18} />
                    <span>{isLoggingOut ? (isTr ? 'Cikis yapiliyor...' : 'Logging out...') : (isTr ? 'Cikis Yap' : 'Logout')}</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;