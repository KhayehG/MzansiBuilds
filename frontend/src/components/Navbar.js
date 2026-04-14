import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { Code2, Home, Trophy, PlusCircle, User, LogOut, Wifi, WifiOff, Flag, MessageSquare } from 'lucide-react';
import ReportModal from './ReportModal';
import NotificationCenter from './NotificationCenter';

const Navbar = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const { isConnected, unreadMessageCount } = useWebSocket();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const [reportSystemOpen, setReportSystemOpen] = useState(false);

    const isActive = (path) => location.pathname === path;

    return (
        <header className="header-brutalist" data-testid="navbar">
            <ReportModal
                isOpen={reportSystemOpen}
                onClose={() => setReportSystemOpen(false)}
                reportType="system"
                reportedItemId={null}
                reportedUserId={null}
                contextLabel="a platform issue"
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link 
                        to="/" 
                        className="flex items-center gap-2 font-heading font-black text-xl tracking-tight hover:text-primary transition-colors"
                        data-testid="nav-logo"
                    >
                        <Code2 className="w-6 h-6" strokeWidth={2.5} />
                        <span className="hidden sm:inline">MzansiBuilds</span>
                        <span className="sm:hidden">MB</span>
                    </Link>

                    {/* Navigation */}
                    <nav className="flex items-center gap-1 sm:gap-2">
                        <Link
                            to="/"
                            className={`flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                isActive('/') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                            }`}
                            data-testid="nav-feed"
                        >
                            <Home className="w-4 h-4" strokeWidth={2.5} />
                            <span className="hidden sm:inline">Feed</span>
                        </Link>

                        <Link
                            to="/celebration"
                            className={`flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                isActive('/celebration') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                            }`}
                            data-testid="nav-celebration"
                        >
                            <Trophy className="w-4 h-4" strokeWidth={2.5} />
                            <span className="hidden sm:inline">Wins</span>
                        </Link>

                        {isAuthenticated ? (
                            <>
                                <Link
                                    to="/create"
                                    className={`flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                        isActive('/create') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                                    }`}
                                    data-testid="nav-create"
                                >
                                    <PlusCircle className="w-4 h-4" strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Create</span>
                                </Link>

                                <Link
                                    to="/messages"
                                    className={`relative flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                        isActive('/messages') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                                    }`}
                                    data-testid="nav-messages"
                                >
                                    <MessageSquare className="w-4 h-4" strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Messages</span>
                                    {unreadMessageCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-black font-bold leading-none">
                                            {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                                        </span>
                                    )}
                                </Link>

                                <Link
                                    to="/profile"
                                    className={`flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                        isActive('/profile') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                                    }`}
                                    data-testid="nav-profile"
                                >
                                    <User className="w-4 h-4" strokeWidth={2.5} />
                                    <span className="hidden sm:inline">{user?.username}</span>
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider hover:text-error transition-colors"
                                    data-testid="nav-logout"
                                >
                                    <LogOut className="w-4 h-4" strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Exit</span>
                                </button>

                                {/* Connection Status */}
                                <div className="ml-2 flex items-center" title={isConnected ? 'Live updates active' : 'Connecting...'}>
                                    {isConnected ? (
                                        <Wifi className="w-4 h-4 text-primary" strokeWidth={2.5} />
                                    ) : (
                                        <WifiOff className="w-4 h-4 text-gray-400" strokeWidth={2.5} />
                                    )}
                                </div>

                                {/* Notification Center */}
                                <NotificationCenter />

                                {/* Report a platform issue */}
                                <button
                                    type="button"
                                    onClick={() => setReportSystemOpen(true)}
                                    className="flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider text-text-secondary hover:text-error transition-colors"
                                    title="Report a platform issue"
                                    data-testid="nav-report-system"
                                >
                                    <Flag className="w-4 h-4" strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Report</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className={`flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                        isActive('/login') ? 'text-primary border-b-2 border-primary' : 'hover:text-primary'
                                    }`}
                                    data-testid="nav-login"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    className="btn-primary-brutalist text-xs py-2 px-4"
                                    data-testid="nav-register"
                                >
                                    Join
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
