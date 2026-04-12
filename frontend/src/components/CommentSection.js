import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Send, Heart, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const CommentSection = ({ projectId, comments: initialComments, onCommentAdded }) => {
    const { isAuthenticated, user } = useAuth();
    const [comments, setComments] = useState(initialComments || []);
    const [content, setContent] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setComments(initialComments || []);
    }, [initialComments]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/projects/${projectId}/comments`,
                { content: content.trim() },
                { withCredentials: true }
            );
            const newComment = { ...response.data, replies: [] };
            if (onCommentAdded) {
                onCommentAdded(newComment);
            } else {
                setComments(prev => [newComment, ...prev]);
            }
            setContent('');
            toast.success('Comment added!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to add comment');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReply = async (parentId) => {
        if (!replyContent.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/projects/${projectId}/comments`,
                { content: replyContent.trim(), parent_id: parentId },
                { withCredentials: true }
            );
            
            // Add reply to parent comment
            setComments(prev => prev.map(c => {
                if (c.id === parentId) {
                    return {
                        ...c,
                        replies: [...(c.replies || []), response.data],
                        reply_count: (c.reply_count || 0) + 1
                    };
                }
                return c;
            }));
            
            setReplyContent('');
            setReplyingTo(null);
            toast.success('Reply added!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to add reply');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLikeComment = async (commentId, isReply = false, parentId = null) => {
        if (!isAuthenticated) {
            toast.error('Please login to like');
            return;
        }

        try {
            const response = await axios.post(
                `${API_URL}/api/like`,
                { comment_id: commentId },
                { withCredentials: true }
            );
            
            const updateLike = (comment) => {
                if (comment.id === commentId) {
                    return {
                        ...comment,
                        is_liked: response.data.liked,
                        like_count: response.data.liked ? (comment.like_count || 0) + 1 : (comment.like_count || 0) - 1
                    };
                }
                if (comment.replies) {
                    return {
                        ...comment,
                        replies: comment.replies.map(r => updateLike(r))
                    };
                }
                return comment;
            };
            
            setComments(prev => prev.map(updateLike));
        } catch (error) {
            toast.error('Failed to update like');
        }
    };

    const CommentItem = ({ comment, isReply = false }) => (
        <div 
            className={`flex gap-4 p-4 border-2 border-black ${isReply ? 'bg-gray-50 ml-8' : 'bg-surface'}`}
            data-testid={`comment-${comment.id}`}
        >
            {comment.profile_picture_url ? (
                <img 
                    src={comment.profile_picture_url} 
                    alt={comment.username}
                    className="flex-shrink-0 w-10 h-10 border-2 border-black object-cover"
                />
            ) : (
                <div className={`flex-shrink-0 w-10 h-10 ${isReply ? 'bg-gray-400' : 'bg-primary'} text-white flex items-center justify-center border-2 border-black`}>
                    <span className="font-bold text-sm">{comment.username?.[0]?.toUpperCase()}</span>
                </div>
            )}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">@{comment.username}</span>
                    <span className="text-xs text-text-secondary font-mono">
                        {formatDate(comment.created_at)}
                    </span>
                </div>
                <p className="text-text-primary mb-2">{comment.content}</p>
                
                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => handleLikeComment(comment.id, isReply)}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                            comment.is_liked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                        }`}
                    >
                        <Heart className={`w-3 h-3 ${comment.is_liked ? 'fill-current' : ''}`} />
                        <span>{comment.like_count || 0}</span>
                    </button>
                    
                    {!isReply && isAuthenticated && (
                        <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary"
                        >
                            <CornerDownRight className="w-3 h-3" />
                            Reply {comment.reply_count > 0 && `(${comment.reply_count})`}
                        </button>
                    )}
                </div>

                {/* Reply Form */}
                {!isReply && replyingTo === comment.id && (
                    <div className="mt-3 flex gap-2">
                        <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write a reply..."
                            className="input-brutalist flex-1 py-2 text-sm"
                            data-testid={`reply-input-${comment.id}`}
                        />
                        <button
                            onClick={() => handleReply(comment.id)}
                            disabled={isSubmitting || !replyContent.trim()}
                            className="btn-primary-brutalist py-2 px-3 text-xs disabled:opacity-50"
                            data-testid={`reply-submit-${comment.id}`}
                        >
                            <Send className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6" data-testid="comment-section">
            <h3 className="font-heading font-bold text-xl uppercase tracking-tight">
                Comments ({comments?.length || 0})
            </h3>

            {/* Comment Form */}
            {isAuthenticated ? (
                <form onSubmit={handleSubmit} className="flex gap-4" data-testid="comment-form">
                    <div className="flex-shrink-0 w-10 h-10 bg-black text-white flex items-center justify-center border-2 border-black">
                        <span className="font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 flex gap-2">
                        <input
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Add a comment..."
                            className="input-brutalist flex-1"
                            data-testid="comment-input"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim()}
                            className="btn-primary-brutalist py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="comment-submit"
                        >
                            <Send className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                    </div>
                </form>
            ) : (
                <p className="text-text-secondary text-sm border-2 border-dashed border-gray-300 p-4 text-center">
                    <a href="/login" className="text-primary font-bold hover:underline">Login</a> to join the conversation
                </p>
            )}

            {/* Comments List */}
            <div className="space-y-4">
                {comments && comments.length > 0 ? (
                    comments.map((comment) => (
                        <div key={comment.id} className="space-y-2">
                            <CommentItem comment={comment} />
                            {/* Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="space-y-2">
                                    {comment.replies.map((reply) => (
                                        <CommentItem key={reply.id} comment={reply} isReply={true} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300">
                        <p className="text-text-secondary">No comments yet. Be the first!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommentSection;
