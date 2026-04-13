import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import Navbar from '../components/Navbar';
import CommentSection from '../components/CommentSection';
import UpdateFeed from '../components/UpdateFeed';
import { 
    ArrowLeft, Clock, User, HandMetal, Rocket, Send, 
    Edit2, Trash2, CheckCircle, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const ProjectDetail = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { lastMessage } = useWebSocket();
    
    const [project, setProject] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [comments, setComments] = useState([]);
    const [stageProgress, setStageProgress] = useState([]);
    const [milestones, setMilestones] = useState([]);
    const [collaborations, setCollaborations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [isRequestingCollab, setIsRequestingCollab] = useState(false);
    const [collabMessage, setCollabMessage] = useState('');
    const [showCollabForm, setShowCollabForm] = useState(false);
    const [activeTab, setActiveTab] = useState('sdlc');

    const fetchData = useCallback(async () => {
        try {
            const [projectRes, updatesRes, commentsRes, stagesRes, milestonesRes] = await Promise.all([
                axios.get(`${API_URL}/api/projects/${projectId}`),
                axios.get(`${API_URL}/api/projects/${projectId}/updates`),
                axios.get(`${API_URL}/api/projects/${projectId}/comments`),
                axios.get(`${API_URL}/api/projects/${projectId}/stages`),
                axios.get(`${API_URL}/api/projects/${projectId}/milestones`)
            ]);
            setProject(projectRes.data);
            setUpdates(updatesRes.data);
            setComments(commentsRes.data);
            setStageProgress(stagesRes.data || []);
            setMilestones(milestonesRes.data || []);

            // Fetch collaborations if authenticated
            if (isAuthenticated) {
                try {
                    const collabRes = await axios.get(
                        `${API_URL}/api/projects/${projectId}/collaborations`,
                        { withCredentials: true }
                    );
                    setCollaborations(collabRes.data);
                } catch (e) {
                    // Ignore collaboration fetch errors
                }
            }
        } catch (error) {
            console.error('Error fetching project:', error);
            toast.error('Project not found');
            navigate('/');
        } finally {
            setLoading(false);
        }
    }, [projectId, isAuthenticated, navigate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle real-time updates
    const mergeIncomingComment = useCallback((existingComments, incomingComment) => {
        const alreadyExists = existingComments.some(comment => (
            comment.id === incomingComment.id
            || (comment.replies || []).some(reply => reply.id === incomingComment.id)
        ));

        if (alreadyExists) {
            return existingComments;
        }

        if (!incomingComment.parent_id) {
            return [incomingComment, ...existingComments];
        }

        let parentFound = false;
        const updatedComments = existingComments.map(comment => {
            if (comment.id !== incomingComment.parent_id) {
                return comment;
            }

            parentFound = true;
            return {
                ...comment,
                replies: [...(comment.replies || []), incomingComment],
                reply_count: (comment.reply_count || 0) + 1,
            };
        });

        return parentFound ? updatedComments : existingComments;
    }, []);

    useEffect(() => {
        if (lastMessage && lastMessage.data?.project_id === projectId) {
            if (lastMessage.type === 'new_update') {
                setUpdates(prev => (
                    prev.some(update => update.id === lastMessage.data.id)
                        ? prev
                        : [lastMessage.data, ...prev]
                ));
            } else if (lastMessage.type === 'new_comment') {
                setComments(prev => mergeIncomingComment(prev, lastMessage.data));
            }
        }
    }, [lastMessage, projectId, mergeIncomingComment]);

    const formatStageLabel = (value) => {
        if (!value) return '';
        return value
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const getCurrentStageBadge = () => {
        const activeStage = stageProgress.find((stage) => stage.status === 'Active' || stage.status === 'Reopened');
        const current = activeStage?.stage_name || project?.current_stage;
        if (current) {
            return <span className="badge-in-progress">{formatStageLabel(current)}</span>;
        }

        switch (project?.stage) {
            case 'idea':
                return <span className="badge-idea">IDEA</span>;
            case 'in_progress':
                return <span className="badge-in-progress">BUILDING</span>;
            case 'completed':
                return <span className="badge-completed">SHIPPED</span>;
            default:
                return <span className="badge-idea">{String(project?.stage || '').toUpperCase()}</span>;
        }
    };

    const getStageStatusBadge = (status) => {
        if (status === 'Completed') return <span className="badge-completed">COMPLETED</span>;
        if (status === 'Active') return <span className="badge-in-progress">ACTIVE</span>;
        if (status === 'Reopened') return <span className="badge-idea">REOPENED</span>;
        if (status === 'Skipped') return <span className="badge-idea">SKIPPED</span>;
        return <span className="badge-idea">PENDING</span>;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;

        setIsSubmittingUpdate(true);
        try {
            const response = await axios.post(
                `${API_URL}/api/projects/${projectId}/updates`,
                { content: newUpdate.trim() },
                { withCredentials: true }
            );
            setUpdates(prev => [response.data, ...prev]);
            setNewUpdate('');
            toast.success('Update posted!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to post update');
        } finally {
            setIsSubmittingUpdate(false);
        }
    };

    const handleRequestCollaboration = async (e) => {
        e.preventDefault();
        setIsRequestingCollab(true);
        try {
            await axios.post(
                `${API_URL}/api/projects/${projectId}/collaborate`,
                { message: collabMessage },
                { withCredentials: true }
            );
            toast.success('Collaboration request sent!');
            setProject(prev => prev ? {
                ...prev,
                has_requested_collab: true,
                collaboration_status: 'pending',
            } : prev);
            setShowCollabForm(false);
            setCollabMessage('');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to send request');
        } finally {
            setIsRequestingCollab(false);
        }
    };

    const handleUpdateCollabStatus = async (collabId, status) => {
        try {
            await axios.put(
                `${API_URL}/api/collaborations/${collabId}?status=${status}`,
                {},
                { withCredentials: true }
            );
            toast.success(`Request ${status}`);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update request');
        }
    };

    const handleDeleteProject = async () => {
        if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            return;
        }
        try {
            await axios.delete(`${API_URL}/api/projects/${projectId}`, { withCredentials: true });
            toast.success('Project deleted');
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete project');
        }
    };

    const isOwner = isAuthenticated && user?.id === project?.user_id;
    const collaborationStatus = project?.collaboration_status;
    const hasRequestedCollab = Boolean(
        project?.has_requested_collab
        || collaborations.some(c => c.requester_id === user?.id && c.status === 'pending')
    );

    const onCommentAdded = (newComment) => {
        setComments(prev => [newComment, ...prev]);
    };

    const milestonesByStage = milestones.reduce((acc, milestone) => {
        if (!acc[milestone.stage_name]) {
            acc[milestone.stage_name] = [];
        }
        acc[milestone.stage_name].push(milestone);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <Rocket className="w-8 h-8 animate-pulse mx-auto text-primary mb-4" />
                        <p className="text-text-secondary font-mono">Loading project...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <Link 
                    to="/" 
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-6 hover:text-primary transition-colors"
                    data-testid="back-link"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Feed
                </Link>

                {/* Project Header */}
                <div className="card-brutalist p-8 mb-8" data-testid="project-header">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                {getCurrentStageBadge()}
                                {project.sdlc_type && (
                                    <span className="badge-idea">{String(project.sdlc_type).toUpperCase()}</span>
                                )}
                                <span className="text-sm text-text-secondary font-mono flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatDate(project.created_at)}
                                </span>
                            </div>
                            <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter" data-testid="project-title">
                                {project.title}
                            </h1>
                        </div>

                        {isOwner && (
                            <div className="flex gap-2">
                                <Link
                                    to={`/project/${projectId}/edit`}
                                    className="btn-secondary-brutalist py-2 px-4 flex items-center gap-2"
                                    data-testid="edit-project"
                                >
                                    <Edit2 className="w-4 h-4" /> Edit
                                </Link>
                                <button
                                    onClick={handleDeleteProject}
                                    className="bg-error text-white border-2 border-black py-2 px-4 font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-red-600 transition-colors"
                                    data-testid="delete-project"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                            </div>
                        )}
                    </div>

                    <p className="text-text-secondary text-lg mb-6" data-testid="project-description">
                        {project.description}
                    </p>

                    {project.support_needed && (
                        <div className="bg-surface border-2 border-black p-4 mb-6">
                            <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-2">Looking for</p>
                            <p className="font-medium">{project.support_needed}</p>
                        </div>
                    )}

                    {/* Author & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t-2 border-gray-200">
                        <Link 
                            to={`/profile/${project.user_id}`}
                            className="flex items-center gap-3 hover:text-primary transition-colors"
                            data-testid="project-author"
                        >
                            <div className="w-10 h-10 bg-black text-white flex items-center justify-center border-2 border-black">
                                <span className="font-bold">{project.username?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                                <p className="font-bold">@{project.username}</p>
                                {project.user_bio && (
                                    <p className="text-sm text-text-secondary line-clamp-1">{project.user_bio}</p>
                                )}
                            </div>
                        </Link>

                        {isAuthenticated && !isOwner && !hasRequestedCollab && collaborationStatus !== 'accepted' && (
                            <button
                                onClick={() => setShowCollabForm(!showCollabForm)}
                                className="btn-primary-brutalist py-2 px-4 flex items-center gap-2"
                                data-testid="raise-hand-btn"
                            >
                                <HandMetal className="w-4 h-4" /> Raise Hand
                            </button>
                        )}

                        {hasRequestedCollab && (
                            <span className="raise-hand-badge py-2">
                                <CheckCircle className="w-4 h-4" /> Request Sent
                            </span>
                        )}

                        {collaborationStatus === 'accepted' && (
                            <span className="raise-hand-badge py-2">
                                <CheckCircle className="w-4 h-4" /> Collaboration Accepted
                            </span>
                        )}

                        {collaborationStatus === 'rejected' && (
                            <span className="inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase tracking-wider text-black">
                                <AlertCircle className="w-4 h-4" /> Request Declined
                            </span>
                        )}
                    </div>

                    {/* Collaboration Form */}
                    {showCollabForm && (
                        <form onSubmit={handleRequestCollaboration} className="mt-6 p-4 bg-surface border-2 border-black" data-testid="collab-form">
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Message (optional)
                            </label>
                            <textarea
                                value={collabMessage}
                                onChange={(e) => setCollabMessage(e.target.value)}
                                className="input-brutalist w-full mb-4"
                                placeholder="Introduce yourself and how you'd like to help..."
                                rows={3}
                                data-testid="collab-message"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={isRequestingCollab}
                                    className="btn-primary-brutalist py-2 px-4"
                                    data-testid="collab-submit"
                                >
                                    {isRequestingCollab ? 'Sending...' : 'Send Request'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCollabForm(false)}
                                    className="btn-secondary-brutalist py-2 px-4"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Collaboration Requests (Owner Only) */}
                {isOwner && collaborations.length > 0 && (
                    <div className="card-brutalist p-6 mb-8" data-testid="collab-requests">
                        <h3 className="font-heading font-bold text-xl uppercase tracking-tight mb-4 flex items-center gap-2">
                            <HandMetal className="w-5 h-5" />
                            Collaboration Requests ({collaborations.filter(c => c.status === 'pending').length} pending)
                        </h3>
                        <div className="space-y-4">
                            {collaborations.map((collab) => (
                                <div 
                                    key={collab.id} 
                                    className={`p-4 border-2 border-black ${collab.status === 'pending' ? 'bg-white' : 'bg-surface'}`}
                                    data-testid={`collab-${collab.id}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-bold">@{collab.requester_username}</p>
                                            {collab.message && (
                                                <p className="text-text-secondary text-sm mt-1">{collab.message}</p>
                                            )}
                                            <p className="text-xs text-text-secondary font-mono mt-2">
                                                {collab.status === 'pending' ? 'Pending' : collab.status.charAt(0).toUpperCase() + collab.status.slice(1)}
                                            </p>
                                        </div>
                                        {collab.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdateCollabStatus(collab.id, 'accepted')}
                                                    className="bg-primary text-white border-2 border-black py-1 px-3 text-sm font-bold uppercase"
                                                    data-testid={`accept-${collab.id}`}
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateCollabStatus(collab.id, 'rejected')}
                                                    className="bg-white text-black border-2 border-black py-1 px-3 text-sm font-bold uppercase hover:bg-gray-100"
                                                    data-testid={`reject-${collab.id}`}
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-2 border-black mb-6">
                    <button
                        onClick={() => setActiveTab('updates')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'updates' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                        }`}
                        data-testid="tab-updates"
                    >
                        Updates ({updates.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('comments')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'comments' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                        }`}
                        data-testid="tab-comments"
                    >
                        Comments ({comments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('sdlc')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'sdlc' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                        }`}
                        data-testid="tab-sdlc"
                    >
                        SDLC Timeline
                    </button>
                </div>

                {/* Updates Tab */}
                {activeTab === 'updates' && (
                    <div data-testid="updates-section">
                        {/* Add Update Form (Owner Only) */}
                        {isOwner && (
                            <form onSubmit={handleAddUpdate} className="mb-6" data-testid="update-form">
                                <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                    Post a Milestone Update
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newUpdate}
                                        onChange={(e) => setNewUpdate(e.target.value)}
                                        className="input-brutalist flex-1"
                                        placeholder="Share your progress..."
                                        data-testid="update-input"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSubmittingUpdate || !newUpdate.trim()}
                                        className="btn-primary-brutalist py-2 px-4 disabled:opacity-50"
                                        data-testid="update-submit"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        )}
                        <UpdateFeed updates={updates} />
                    </div>
                )}

                {/* Comments Tab */}
                {activeTab === 'comments' && (
                    <CommentSection 
                        projectId={projectId} 
                        comments={comments}
                        onCommentAdded={onCommentAdded}
                    />
                )}

                {activeTab === 'sdlc' && (
                    <div className="card-brutalist p-6" data-testid="sdlc-timeline">
                        <h3 className="font-heading font-bold text-xl uppercase tracking-tight mb-5">
                            SDLC Stage Timeline
                        </h3>

                        {stageProgress.length === 0 ? (
                            <p className="text-text-secondary">No stage data available yet.</p>
                        ) : (
                            <div className="space-y-6">
                                {stageProgress.map((stage) => {
                                    const stageMilestones = milestonesByStage[stage.stage_name] || [];
                                    return (
                                        <div key={stage.stage_name} className="sdlc-stage-block">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <h4 className="font-bold uppercase tracking-wider text-sm">
                                                    {formatStageLabel(stage.stage_name)}
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {stage.source === 'External' && (
                                                        <span className="badge-idea">EXTERNAL</span>
                                                    )}
                                                    {getStageStatusBadge(stage.status)}
                                                </div>
                                            </div>

                                            <div className="timeline-vertical">
                                                {stageMilestones.length === 0 ? (
                                                    <div className="timeline-item muted">
                                                        <div className="timeline-node" />
                                                        <div className="timeline-content">
                                                            <p className="text-text-secondary text-sm">No milestones for this stage yet.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    stageMilestones.map((milestone) => (
                                                        <div key={milestone.id} className="timeline-item">
                                                            <div className="timeline-node" />
                                                            <div className="timeline-content">
                                                                <p className="font-semibold text-sm">{milestone.title}</p>
                                                                {milestone.description && (
                                                                    <p className="text-text-secondary text-sm mt-1">{milestone.description}</p>
                                                                )}
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    {milestone.is_retrospective && (
                                                                        <span className="badge-idea">RETROSPECTIVE</span>
                                                                    )}
                                                                    <span className="text-xs text-text-secondary font-mono">
                                                                        {formatDate(milestone.created_at)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ProjectDetail;
