import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Heart, MessageSquare, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const ProjectCard = ({ project, showFullDescription = false, onLikeToggle }) => {
    const { isAuthenticated } = useAuth();
    const [isLiked, setIsLiked] = useState(project.is_liked || false);
    const [likeCount, setLikeCount] = useState(project.like_count || 0);
    const [isLiking, setIsLiking] = useState(false);

    const getStageBadge = (stage) => {
        switch (stage) {
            case 'idea':
                return <span className="badge-idea">IDEA</span>;
            case 'in_progress':
                return <span className="badge-in-progress">BUILDING</span>;
            case 'completed':
                return <span className="badge-completed">SHIPPED</span>;
            default:
                return <span className="badge-idea">{stage?.toUpperCase()}</span>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleLike = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!isAuthenticated) {
            toast.error('Please login to like');
            return;
        }

        setIsLiking(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/like`,
                { project_id: project.id },
                { withCredentials: true }
            );
            setIsLiked(response.data.liked);
            setLikeCount(prev => response.data.liked ? prev + 1 : prev - 1);
            if (onLikeToggle) onLikeToggle(project.id, response.data.liked);
        } catch (error) {
            toast.error('Failed to update like');
        } finally {
            setIsLiking(false);
        }
    };

    return (
        <div className="card-brutalist p-6 animate-fade-in" data-testid={`project-card-${project.id}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        {getStageBadge(project.stage)}
                        <span className="text-xs text-text-secondary font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(project.created_at)}
                        </span>
                    </div>
                    <Link to={`/project/${project.id}`}>
                        <h3 className="font-heading font-bold text-xl text-text-primary hover:text-primary transition-colors" data-testid={`project-title-${project.id}`}>
                            {project.title}
                        </h3>
                    </Link>
                </div>
            </div>

            <p className={`text-text-secondary font-body mb-4 ${showFullDescription ? '' : 'line-clamp-2'}`} data-testid={`project-description-${project.id}`}>
                {project.description}
            </p>

            {project.support_needed && (
                <div className="bg-surface border-2 border-black p-3 mb-4">
                    <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-1">Looking for</p>
                    <p className="text-sm font-medium">{project.support_needed}</p>
                </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-gray-200">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <Link 
                        to={`/profile/${project.user_id}`}
                        className="flex min-w-0 flex-1 items-center gap-2 hover:text-primary transition-colors"
                        data-testid={`project-author-${project.id}`}
                        title={`@${project.username}`}
                    >
                        {project.profile_picture_url ? (
                            <img 
                                src={project.profile_picture_url} 
                                alt={project.username}
                                className="w-6 h-6 shrink-0 border border-black object-cover"
                            />
                        ) : (
                            <div className="w-6 h-6 shrink-0 bg-black text-white flex items-center justify-center text-xs font-bold">
                                {project.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                        <span className="truncate text-sm font-bold">@{project.username}</span>
                    </Link>

                    {/* Like Button */}
                    <button
                        onClick={handleLike}
                        disabled={isLiking}
                        className={`flex shrink-0 items-center gap-1 text-sm transition-colors ${
                            isLiked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                        }`}
                        data-testid={`like-btn-${project.id}`}
                    >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{likeCount}</span>
                    </button>

                    {/* Comment Count */}
                    <Link 
                        to={`/project/${project.id}`}
                        className="flex shrink-0 items-center gap-1 text-sm text-text-secondary hover:text-primary"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>{project.comment_count || 0}</span>
                    </Link>
                </div>

                <Link 
                    to={`/project/${project.id}`}
                    className="flex shrink-0 items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary hover:underline"
                    data-testid={`project-view-${project.id}`}
                >
                    View <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
};

export default ProjectCard;
