import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { Trophy, Rocket, Star, PartyPopper } from 'lucide-react';
import { Link } from 'react-router-dom';

import { API_URL } from '../lib/api';

const CelebrationWall = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/celebration-wall`);
                setProjects(response.data);
            } catch (error) {
                console.error('Error fetching celebration wall:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-black">
            <div className="bg-white">
                <Navbar />
            </div>
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Trophy className="w-10 h-10 text-primary" strokeWidth={2.5} />
                        <h1 className="font-heading font-black text-5xl sm:text-6xl tracking-tighter text-white" data-testid="celebration-title">
                            CELEBRATION WALL
                        </h1>
                        <Trophy className="w-10 h-10 text-primary" strokeWidth={2.5} />
                    </div>
                    <p className="text-white/70 font-body text-lg max-w-2xl mx-auto">
                        These builders shipped. They took an idea and made it real. Celebrate their wins! 🎉
                    </p>
                </div>

                {/* Hero Image */}
                <div 
                    className="relative h-64 mb-12 border-4 border-primary overflow-hidden"
                    style={{
                        backgroundImage: `url('https://images.pexels.com/photos/8127301/pexels-photo-8127301.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="text-center">
                            <PartyPopper className="w-16 h-16 text-primary mx-auto mb-4" strokeWidth={2} />
                            <p className="text-white font-heading font-bold text-3xl">
                                {projects.length} PROJECTS SHIPPED
                            </p>
                        </div>
                    </div>
                </div>

                {/* Projects Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Rocket className="w-8 h-8 animate-pulse text-primary" />
                    </div>
                ) : projects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="celebration-grid">
                        {projects.map((project, index) => (
                            <Link
                                key={project.id}
                                to={`/project/${project.id}`}
                                className="celebration-card group animate-fade-in hover:scale-[1.02] transition-transform"
                                style={{ animationDelay: `${index * 0.05}s` }}
                                data-testid={`celebration-card-${project.id}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <span className="badge-completed flex items-center gap-1">
                                        <Star className="w-3 h-3" fill="currentColor" />
                                        SHIPPED
                                    </span>
                                    <span className="text-white/50 text-xs font-mono">
                                        {formatDate(project.created_at)}
                                    </span>
                                </div>
                                <h3 className="font-heading font-bold text-2xl text-white mb-3 group-hover:text-primary transition-colors">
                                    {project.title}
                                </h3>
                                <p className="text-white/70 line-clamp-3 mb-4">
                                    {project.description}
                                </p>
                                <div className="flex items-center gap-2 pt-4 border-t border-primary/30">
                                    <div className="w-8 h-8 bg-primary text-black flex items-center justify-center font-bold text-sm">
                                        {project.username?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-white font-bold">@{project.username}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed border-primary/30">
                        <Trophy className="w-16 h-16 mx-auto text-primary/50 mb-4" />
                        <p className="text-white/70 text-xl">No completed projects yet</p>
                        <p className="text-white/50 mt-2">Be the first to ship!</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CelebrationWall;
