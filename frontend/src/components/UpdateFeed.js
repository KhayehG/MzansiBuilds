import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Rocket, FileText, ArrowRight, Heart } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const UpdateFeed = ({ updates: initialUpdates, showProjectLink = false }) => {
    const { isAuthenticated } = useAuth();
    const [updates, setUpdates] = useState(initialUpdates || []);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleLike = async (updateId) => {
        if (!isAuthenticated) {
            toast.error('Please login to like');
            return;
        }

        try {
            const response = await axios.post(
                `${API_URL}/api/like`,
                { update_id: updateId },
                { withCredentials: true }
            );
            
            setUpdates(prev => prev.map(u => {
                if (u.id === updateId) {
                    return {
                        ...u,
                        is_liked: response.data.liked,
                        like_count: response.data.liked ? (u.like_count || 0) + 1 : (u.like_count || 0) - 1
                    };
                }
                return u;
            }));
        } catch (error) {
            toast.error('Failed to update like');
        }
    };

    if (!updates || updates.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed border-gray-300" data-testid="updates-empty">
                <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-text-secondary">No updates yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4" data-testid="update-feed">
            {updates.map((update, index) => (
                <div 
                    key={update.id} 
                    className="feed-item animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    data-testid={`update-${update.id}`}
                >
                    <div className="flex items-start gap-4">
                        {update.profile_picture_url ? (
                            <img 
                                src={update.profile_picture_url}
                                alt={update.username}
                                className="flex-shrink-0 w-10 h-10 border-2 border-black object-cover"
                            />
                        ) : (
                            <div className="flex-shrink-0 w-10 h-10 bg-primary text-white flex items-center justify-center border-2 border-black">
                                <Rocket className="w-5 h-5" strokeWidth={2.5} />
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-sm">@{update.username}</span>
                                <span className="text-xs text-text-secondary font-mono">
                                    {formatDate(update.created_at)}
                                </span>
                            </div>
                            
                            {showProjectLink && update.project_title && (
                                <Link 
                                    to={`/project/${update.project_id}`}
                                    className="text-xs uppercase tracking-widest text-primary font-bold mb-2 inline-flex items-center gap-1 hover:underline"
                                >
                                    {update.project_title} <ArrowRight className="w-3 h-3" />
                                </Link>
                            )}
                            
                            <p className="text-text-primary mb-2">{update.content}</p>
                            
                            {/* Like Button */}
                            <button
                                onClick={() => handleLike(update.id)}
                                className={`flex items-center gap-1 text-sm transition-colors ${
                                    update.is_liked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                                }`}
                            >
                                <Heart className={`w-4 h-4 ${update.is_liked ? 'fill-current' : ''}`} />
                                <span>{update.like_count || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UpdateFeed;
