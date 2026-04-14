import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Rocket, FileText, ArrowRight, Heart, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const UpdateFeed = ({
    updates: initialUpdates,
    showProjectLink = false,
    canManageUpdates = false,
    currentUserId = null,
    onEditUpdate,
    onDeleteUpdate,
}) => {
    const { isAuthenticated } = useAuth();
    const [updates, setUpdates] = useState(initialUpdates || []);
    const [editingUpdateId, setEditingUpdateId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [deletingUpdateId, setDeletingUpdateId] = useState(null);

    useEffect(() => {
        setUpdates(initialUpdates || []);
    }, [initialUpdates]);

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

    const beginEdit = (update) => {
        setEditingUpdateId(update.id);
        setEditingContent(update.content || '');
    };

    const cancelEdit = () => {
        setEditingUpdateId(null);
        setEditingContent('');
    };

    const handleSaveEdit = async (updateId) => {
        const nextContent = editingContent.trim();
        if (!nextContent) {
            toast.error('Update cannot be empty');
            return;
        }
        if (typeof onEditUpdate !== 'function') {
            toast.error('Edit action unavailable');
            return;
        }

        setIsSavingEdit(true);
        try {
            await onEditUpdate(updateId, nextContent);
            setUpdates(prev => prev.map(update => (
                update.id === updateId
                    ? { ...update, content: nextContent }
                    : update
            )));
            cancelEdit();
            toast.success('Update edited');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to edit update');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDelete = async (updateId) => {
        if (typeof onDeleteUpdate !== 'function') {
            toast.error('Delete action unavailable');
            return;
        }
        if (!window.confirm('Delete this update?')) {
            return;
        }

        setDeletingUpdateId(updateId);
        try {
            await onDeleteUpdate(updateId);
            setUpdates(prev => prev.filter(update => update.id !== updateId));
            toast.success('Update deleted');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete update');
        } finally {
            setDeletingUpdateId(null);
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
                (() => {
                    const canManageThisUpdate = canManageUpdates || (currentUserId && update.user_id === currentUserId);
                    return (
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

                            {editingUpdateId === update.id ? (
                                <div className="mb-2 space-y-2">
                                    <textarea
                                        className="input-brutalist w-full min-h-[90px]"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn-primary-brutalist py-1 px-3 text-xs inline-flex items-center gap-1"
                                            onClick={() => handleSaveEdit(update.id)}
                                            disabled={isSavingEdit}
                                        >
                                            <Check className="w-3 h-3" /> {isSavingEdit ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary-brutalist py-1 px-3 text-xs inline-flex items-center gap-1"
                                            onClick={cancelEdit}
                                            disabled={isSavingEdit}
                                        >
                                            <X className="w-3 h-3" /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-text-primary mb-2">{update.content}</p>
                            )}

                            {canManageThisUpdate && editingUpdateId !== update.id && (
                                <div className="flex items-center gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => beginEdit(update)}
                                        className="btn-secondary-brutalist py-1 px-3 text-xs inline-flex items-center gap-1"
                                    >
                                        <Edit2 className="w-3 h-3" /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(update.id)}
                                        disabled={deletingUpdateId === update.id}
                                        className="bg-white text-black border-2 border-black py-1 px-3 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <Trash2 className="w-3 h-3" /> {deletingUpdateId === update.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            )}
                            
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
                    );
                })()
            ))}
        </div>
    );
};

export default UpdateFeed;
