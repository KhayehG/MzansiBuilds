import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import ProjectCard from '../components/ProjectCard';
import { Rocket, Filter, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const Dashboard = () => {
    const [feed, setFeed] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, idea, in_progress, completed
    const [viewMode, setViewMode] = useState('feed'); // feed, projects
    const [feedMode, setFeedMode] = useState('global'); // global, following
    const { lastMessage, isConnected } = useWebSocket();
    const { isAuthenticated } = useAuth();

    const fetchData = useCallback(async () => {
        try {
            const [feedRes, projectsRes] = await Promise.all([
                axios.get(`${API_URL}/api/feed?mode=${feedMode}`, { withCredentials: true }),
                axios.get(`${API_URL}/api/projects${filter !== 'all' ? `?stage=${filter}` : ''}`, { withCredentials: true })
            ]);
            setFeed(feedRes.data);
            setProjects(projectsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }, [filter, feedMode]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle real-time updates
    useEffect(() => {
        if (lastMessage) {
            if (lastMessage.type === 'new_project') {
                setProjects(prev => [lastMessage.data, ...prev]);
                setFeed(prev => [{ type: 'project', ...lastMessage.data }, ...prev]);
                toast.success(`New project: ${lastMessage.data.title}`);
            } else if (lastMessage.type === 'new_update') {
                setFeed(prev => [{ type: 'update', ...lastMessage.data }, ...prev]);
                toast.info(`New update on ${lastMessage.data.project_title}`);
            }
        }
    }, [lastMessage]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredProjects = filter === 'all' 
        ? projects 
        : projects.filter(p => p.stage === filter);

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <Rocket className="w-8 h-8 text-primary" strokeWidth={2.5} />
                        <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter" data-testid="dashboard-title">
                            THE FEED
                        </h1>
                        {isConnected && (
                            <span className="raise-hand-badge">
                                <Zap className="w-3 h-3" /> LIVE
                            </span>
                        )}
                    </div>
                    <p className="text-text-secondary font-body text-lg">
                        Watch builders ship in real-time. Get inspired. Join the journey.
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b-2 border-black">
                    {/* View Mode Toggle */}
                    <div className="flex border-2 border-black">
                        <button
                            onClick={() => setViewMode('feed')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                viewMode === 'feed' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
                            }`}
                            data-testid="view-feed"
                        >
                            Feed
                        </button>
                        <button
                            onClick={() => setViewMode('projects')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                                viewMode === 'projects' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
                            }`}
                            data-testid="view-projects"
                        >
                            Projects
                        </button>
                    </div>

                    {/* Feed Mode Toggle (only when in feed view and authenticated) */}
                    {viewMode === 'feed' && isAuthenticated && (
                        <div className="flex border-2 border-black">
                            <button
                                onClick={() => setFeedMode('global')}
                                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                                    feedMode === 'global' ? 'bg-primary text-white' : 'bg-white text-black hover:bg-gray-100'
                                }`}
                                data-testid="feed-global"
                            >
                                Global
                            </button>
                            <button
                                onClick={() => setFeedMode('following')}
                                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                                    feedMode === 'following' ? 'bg-primary text-white' : 'bg-white text-black hover:bg-gray-100'
                                }`}
                                data-testid="feed-following"
                            >
                                Following
                            </button>
                        </div>
                    )}

                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-text-secondary" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="input-brutalist py-2 text-sm"
                            data-testid="filter-select"
                        >
                            <option value="all">All Stages</option>
                            <option value="idea">Ideas</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    <button
                        onClick={fetchData}
                        className="btn-secondary-brutalist py-2 px-4 flex items-center gap-2"
                        data-testid="refresh-btn"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                            <p className="text-text-secondary font-mono">Loading...</p>
                        </div>
                    </div>
                ) : viewMode === 'projects' ? (
                    /* Projects Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="projects-grid">
                        {filteredProjects.length > 0 ? (
                            filteredProjects.map((project, index) => (
                                <div key={project.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                    <ProjectCard project={project} />
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-300">
                                <Rocket className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-text-secondary text-lg">No projects found</p>
                                <p className="text-text-secondary text-sm mt-2">Be the first to share!</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Feed View */
                    <div className="space-y-0 border-2 border-black" data-testid="feed-list">
                        {feed.length > 0 ? (
                            feed.map((item, index) => (
                                <div 
                                    key={`${item.type}-${item.id}`} 
                                    className="feed-item animate-fade-in"
                                    style={{ animationDelay: `${index * 0.03}s` }}
                                    data-testid={`feed-item-${item.id}`}
                                >
                                    {item.type === 'project' ? (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs px-2 py-1 uppercase tracking-widest font-bold border border-black ${
                                                    item.stage === 'completed' ? 'bg-primary text-white' :
                                                    item.stage === 'in_progress' ? 'bg-yellow-400 text-black' :
                                                    'bg-gray-200 text-black'
                                                }`}>
                                                    {item.stage === 'in_progress' ? 'BUILDING' : item.stage?.toUpperCase()}
                                                </span>
                                                <span className="text-xs text-text-secondary font-mono">
                                                    {formatDate(item.created_at)}
                                                </span>
                                            </div>
                                            <a href={`/project/${item.id}`} className="font-heading font-bold text-xl hover:text-primary transition-colors">
                                                {item.title}
                                            </a>
                                            <p className="text-text-secondary mt-2 line-clamp-2">{item.description}</p>
                                            <p className="text-sm font-bold mt-3">@{item.username}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="raise-hand-badge">
                                                    <Zap className="w-3 h-3" /> UPDATE
                                                </span>
                                                <span className="text-xs text-text-secondary font-mono">
                                                    {formatDate(item.created_at)}
                                                </span>
                                            </div>
                                            <a href={`/project/${item.project_id}`} className="text-xs uppercase tracking-widest text-primary font-bold hover:underline">
                                                {item.project_title}
                                            </a>
                                            <p className="text-text-primary mt-2">{item.content}</p>
                                            <p className="text-sm font-bold mt-3">@{item.username}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20">
                                <Rocket className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-text-secondary text-lg">The feed is empty</p>
                                <p className="text-text-secondary text-sm mt-2">Start building something!</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
