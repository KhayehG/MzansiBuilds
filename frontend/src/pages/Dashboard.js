import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import ProjectCard from '../components/ProjectCard';
import { Rocket, Filter, RefreshCw, Zap, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const Dashboard = () => {
    const [feed, setFeed] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, idea, in_progress, completed
    const [viewMode, setViewMode] = useState('feed'); // feed, projects
    const [feedMode, setFeedMode] = useState('global'); // global, following
    const [searchTerm, setSearchTerm] = useState('');
    const [builders, setBuilders] = useState([]);
    const { lastMessage, isConnected } = useWebSocket();
    const { isAuthenticated } = useAuth();

    const fetchData = useCallback(async () => {
        try {
            const projectParams = new URLSearchParams();
            if (filter !== 'all') {
                projectParams.set('stage', filter);
            }
            if (searchTerm.trim()) {
                projectParams.set('q', searchTerm.trim());
            }

            const requests = [
                axios.get(`${API_URL}/api/feed?mode=${feedMode}`, { withCredentials: true }),
                axios.get(`${API_URL}/api/projects${projectParams.toString() ? `?${projectParams.toString()}` : ''}`, { withCredentials: true }),
            ];

            if (searchTerm.trim()) {
                requests.push(
                    axios.get(`${API_URL}/api/users?q=${encodeURIComponent(searchTerm.trim())}`, { withCredentials: true })
                );
            }

            const [feedRes, projectsRes, usersRes] = await Promise.all(requests);
            setFeed(feedRes.data);
            setProjects(projectsRes.data);
            setBuilders(usersRes?.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load feed');
        } finally {
            setLoading(false);
        }
    }, [filter, feedMode, searchTerm]);

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

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredProjects = filter === 'all' 
        ? projects 
        : projects.filter(p => p.stage === filter);

    const filteredFeed = normalizedSearch
        ? feed.filter((item) => {
            const searchableText = [
                item.title,
                item.description,
                item.content,
                item.project_title,
                item.username,
            ].filter(Boolean).join(' ').toLowerCase();
            return searchableText.includes(normalizedSearch);
        })
        : feed;

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

                    {/* Search */}
                    <div className="flex items-center gap-2 min-w-[240px] flex-1">
                        <Search className="w-4 h-4 text-text-secondary" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-brutalist py-2 text-sm w-full"
                            placeholder="Search projects or builders"
                            data-testid="search-input"
                        />
                    </div>

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

                {searchTerm.trim() && (
                    <div className="mb-6 space-y-4" data-testid="search-results-summary">
                        <p className="text-sm font-mono text-text-secondary">
                            Showing results for <span className="font-bold text-black">“{searchTerm.trim()}”</span>
                        </p>

                        <div className="card-brutalist p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="w-4 h-4 text-primary" />
                                <h2 className="font-heading font-bold uppercase tracking-wide">Builders</h2>
                            </div>
                            {builders.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {builders.map((builder) => (
                                        <Link
                                            key={builder.id}
                                            to={`/profile/${builder.id}`}
                                            className="border-2 border-black bg-white p-3 hover:bg-surface transition-colors"
                                        >
                                            <p className="font-bold">@{builder.username}</p>
                                            <p className="text-sm text-text-secondary line-clamp-2 mt-1">
                                                {builder.bio || 'No bio yet.'}
                                            </p>
                                            <p className="text-xs font-mono mt-2 text-text-secondary">
                                                {builder.project_count || 0} projects · {builder.completed_count || 0} shipped
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-secondary">No builders matched this search yet.</p>
                            )}
                        </div>
                    </div>
                )}

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
                        {filteredFeed.length > 0 ? (
                            filteredFeed.map((item, index) => (
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
