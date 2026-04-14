import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import Navbar from '../components/Navbar';
import CommentSection from '../components/CommentSection';
import UpdateFeed from '../components/UpdateFeed';
import ProjectChat from '../components/ProjectChat';
import ReportModal from '../components/ReportModal';
import { 
    ArrowLeft, Clock, User, HandMetal, Rocket, Send, 
    Edit2, Trash2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Flag
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
    const [expandedStages, setExpandedStages] = useState({});
    const [milestoneFormByStage, setMilestoneFormByStage] = useState({});
    const [isSubmittingMilestone, setIsSubmittingMilestone] = useState(false);
    const [isCompletingStage, setIsCompletingStage] = useState(false);
    const [isReopeningStage, setIsReopeningStage] = useState(false);
    const [reportModal, setReportModal] = useState({ open: false, type: null, itemId: null, userId: null, label: '' });

    const fetchData = useCallback(async () => {
        try {
            const [projectRes, updatesRes, commentsRes, stagesRes, milestonesRes] = await Promise.all([
                axios.get(`${API_URL}/api/projects/${projectId}`, { withCredentials: true }),
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

    useEffect(() => {
        const nextExpanded = {};
        stageProgress.forEach((stage) => {
            if (expandedStages[stage.stage_name] === undefined) {
                nextExpanded[stage.stage_name] = stage.status === 'Active' || stage.status === 'Reopened';
            } else {
                nextExpanded[stage.stage_name] = expandedStages[stage.stage_name];
            }
        });
        if (Object.keys(nextExpanded).length > 0) {
            setExpandedStages(nextExpanded);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageProgress]);

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
            } else if (lastMessage.type === 'update_edited') {
                setUpdates(prev => prev.map(update => (
                    update.id === lastMessage.data.id
                        ? { ...update, content: lastMessage.data.content, updated_at: lastMessage.data.updated_at }
                        : update
                )));
            } else if (lastMessage.type === 'update_deleted') {
                setUpdates(prev => prev.filter(update => update.id !== lastMessage.data.id));
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

    const handleCancelCollaboration = async () => {
        try {
            const response = await axios.delete(`${API_URL}/api/projects/${projectId}/collaborate`, { withCredentials: true });
            toast.success(response.data?.message || 'Collaboration updated');
            setShowCollabForm(false);
            setCollabMessage('');
            await fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update collaboration');
        }
    };

    const handleEditUpdate = async (updateId, content) => {
        const response = await axios.put(
            `${API_URL}/api/projects/${projectId}/updates/${updateId}`,
            { content },
            { withCredentials: true }
        );
        setUpdates(prev => prev.map(update => (
            update.id === updateId
                ? { ...update, content: response.data.content, updated_at: response.data.updated_at }
                : update
        )));
    };

    const handleDeleteUpdate = async (updateId) => {
        await axios.delete(`${API_URL}/api/projects/${projectId}/updates/${updateId}`, { withCredentials: true });
        setUpdates(prev => prev.filter(update => update.id !== updateId));
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

    const handleRemoveCollaborator = async (collabId) => {
        if (!window.confirm('Remove this collaborator from the project?')) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/api/collaborations/${collabId}`, { withCredentials: true });
            toast.success('Collaborator removed');
            await fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to remove collaborator');
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
    const isCollaborator = Boolean(project?.is_collaborator);
    const canEditProject = Boolean(project?.can_edit_project);
    const canManageCollaborationRequests = Boolean(project?.can_manage_collaboration_requests);
    const canManageCollaborators = Boolean(project?.can_manage_collaborators);
    const canDeleteProject = Boolean(project?.can_delete_project);
    const collaborationStatus = project?.collaboration_status;
    const collaborators = project?.collaborators || [];
    const hasActiveCollabRequest = collaborationStatus === 'pending' || collaborationStatus === 'accepted';
    const canRaiseHand = isAuthenticated && !isOwner && !hasActiveCollabRequest;

    const onCommentAdded = (newComment) => {
        setComments(prev => mergeIncomingComment(prev, newComment));
    };

    const toggleStage = (stageName) => {
        setExpandedStages(prev => ({ ...prev, [stageName]: !prev[stageName] }));
    };

    const handleMilestoneFieldChange = (stageName, field, value) => {
        setMilestoneFormByStage(prev => ({
            ...prev,
            [stageName]: {
                title: prev[stageName]?.title || '',
                description: prev[stageName]?.description || '',
                ...prev[stageName],
                [field]: value,
            },
        }));
    };

    const handleAddMilestone = async (stageName) => {
        const payload = milestoneFormByStage[stageName] || {};
        if (!payload.title?.trim() || !payload.description?.trim()) {
            toast.error('Please provide milestone title and description');
            return;
        }
        setIsSubmittingMilestone(true);
        try {
            await axios.post(
                `${API_URL}/api/projects/${projectId}/milestones`,
                {
                    stage_name: stageName,
                    title: payload.title.trim(),
                    description: payload.description.trim(),
                },
                { withCredentials: true }
            );
            setMilestoneFormByStage(prev => ({ ...prev, [stageName]: { title: '', description: '' } }));
            await fetchData();
            toast.success('Milestone added');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to add milestone');
        } finally {
            setIsSubmittingMilestone(false);
        }
    };

    const handleCompleteStage = async () => {
        setIsCompletingStage(true);
        try {
            await axios.post(`${API_URL}/api/projects/${projectId}/stages/complete`, {}, { withCredentials: true });
            await fetchData();
            toast.success('Stage completed');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to complete stage');
        } finally {
            setIsCompletingStage(false);
        }
    };

    const handleReopenStage = async (stageName) => {
        const reason = window.prompt(`Reason for reopening ${formatStageLabel(stageName)}:`)?.trim();
        if (!reason) return;

        setIsReopeningStage(true);
        try {
            await axios.post(
                `${API_URL}/api/projects/${projectId}/stages/move`,
                { to_stage: stageName, reason },
                { withCredentials: true }
            );
            await fetchData();
            toast.success('Stage reopened');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to reopen stage');
        } finally {
            setIsReopeningStage(false);
        }
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
            <ReportModal
                isOpen={reportModal.open}
                onClose={() => setReportModal({ open: false, type: null, itemId: null, userId: null, label: '' })}
                reportType={reportModal.type || 'project'}
                reportedItemId={reportModal.itemId}
                reportedUserId={reportModal.userId}
                contextLabel={reportModal.label || 'this project'}
            />
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <Link 
                    to="/"
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-6 hover:text-primary transition-colors"
                    data-testid="back-link"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Feed
                </Link>

                <section className="card-brutalist p-6 mb-6" data-testid="project-summary">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                {getCurrentStageBadge()}
                                <span className="text-xs text-text-secondary font-mono flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(project.created_at)}
                                </span>
                            </div>

                            <h1 className="font-heading font-black text-3xl uppercase tracking-tight mb-3 break-words">
                                {project.title}
                            </h1>
                            <p className="text-text-secondary leading-relaxed whitespace-pre-wrap mb-4">
                                {project.description}
                            </p>

                            {project.tech_stack?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {project.tech_stack.map((item) => (
                                        <span key={item} className="badge-idea">{item}</span>
                                    ))}
                                </div>
                            )}

                            {project.support_needed && (
                                <div className="bg-surface border-2 border-black p-4 mb-4">
                                    <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-1">Looking for</p>
                                    <p className="font-medium">{project.support_needed}</p>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <Link to={`/profile/${project.user_id}`} className="inline-flex items-center gap-2 font-bold hover:text-primary transition-colors">
                                    {project.profile_picture_url ? (
                                        <img
                                            src={project.profile_picture_url}
                                            alt={project.username}
                                            className="w-8 h-8 border-2 border-black object-cover"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center border-2 border-black font-bold text-xs">
                                            {project.username?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <span>@{project.username}</span>
                                </Link>
                                <span className="inline-flex items-center gap-2 text-text-secondary">
                                    <User className="w-4 h-4" />
                                    {project.user_bio || 'Builder on MzansiBuilds'}
                                </span>
                            </div>
                        </div>

                        <div className="w-full lg:w-80 space-y-4">
                            <div className="border-2 border-black bg-white p-4 space-y-3">
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="font-bold uppercase tracking-wide">Owner</span>
                                    <span className="text-text-secondary">@{project.username}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="font-bold uppercase tracking-wide">Comments</span>
                                    <span>{project.comment_count || 0}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="font-bold uppercase tracking-wide">Likes</span>
                                    <span>{project.like_count || 0}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="font-bold uppercase tracking-wide">Collaborators</span>
                                    <span>{project.collaborator_count || 0}</span>
                                </div>
                                <div className="text-sm">
                                    <div className="font-bold uppercase tracking-wide mb-2">Team</div>
                                    <div className="text-text-secondary space-y-1">
                                        <div>@{project.username} (Owner)</div>
                                        {collaborators.length === 0 ? (
                                            <div>No collaborators yet</div>
                                        ) : (
                                            collaborators.map((collaborator) => (
                                                <div key={collaborator.id}>@{collaborator.username}</div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {canEditProject ? (
                                <div className="space-y-3">
                                    <Link
                                        to={`/project/${projectId}/edit`}
                                        className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" /> Edit Project
                                    </Link>
                                    {canDeleteProject && (
                                        <button
                                            type="button"
                                            onClick={handleDeleteProject}
                                            className="btn-secondary-brutalist w-full flex items-center justify-center gap-2 text-error"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete Project
                                        </button>
                                    )}
                                    {isCollaborator && (
                                        <button type="button" onClick={handleCancelCollaboration} className="btn-secondary-brutalist w-full">
                                            Leave Project
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {!isAuthenticated && (
                                        <div className="border-2 border-black bg-surface p-4 text-sm text-text-secondary">
                                            Log in to collaborate or join project chat.
                                        </div>
                                    )}

                                    {canRaiseHand && !showCollabForm && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCollabForm(true)}
                                            className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                                        >
                                            <HandMetal className="w-4 h-4" /> Raise Your Hand
                                        </button>
                                    )}

                                    {isAuthenticated && collaborationStatus && (
                                        <div className="border-2 border-black bg-surface p-4 text-sm">
                                            <div className="font-bold uppercase tracking-wide mb-1">Collaboration Status</div>
                                            <div className="inline-flex items-center gap-2">
                                                {collaborationStatus === 'accepted' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                                                <span className="font-medium">{String(collaborationStatus || 'pending').toUpperCase()}</span>
                                            </div>
                                            {collaborationStatus === 'pending' && (
                                                <div className="mt-3 flex gap-2">
                                                    <button type="button" className="btn-primary-brutalist flex-1 opacity-70 cursor-not-allowed" disabled>
                                                        Request Sent
                                                    </button>
                                                    <button type="button" onClick={handleCancelCollaboration} className="btn-secondary-brutalist">
                                                        Revoke
                                                    </button>
                                                </div>
                                            )}
                                            {collaborationStatus === 'accepted' && (
                                                <div className="mt-3">
                                                    <button type="button" onClick={handleCancelCollaboration} className="btn-secondary-brutalist w-full">
                                                        Leave Project
                                                    </button>
                                                </div>
                                            )}
                                            {collaborationStatus === 'rejected' && (
                                                <p className="mt-2 text-text-secondary">
                                                    This request was rejected. You can update your message and raise your hand again.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {canRaiseHand && showCollabForm && (
                                        <form onSubmit={handleRequestCollaboration} className="border-2 border-black bg-white p-4 space-y-3">
                                            <label className="block text-xs uppercase tracking-widest font-bold">
                                                Tell the owner how you can help
                                            </label>
                                            <textarea
                                                value={collabMessage}
                                                onChange={(e) => setCollabMessage(e.target.value)}
                                                className="input-brutalist w-full min-h-[120px]"
                                                placeholder="Share your skills, availability, or why you want to join this project..."
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowCollabForm(false); setCollabMessage(''); }}
                                                    className="btn-secondary-brutalist"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isRequestingCollab}
                                                    className="btn-primary-brutalist disabled:opacity-50"
                                                >
                                                    {isRequestingCollab ? 'Sending...' : 'Send Request'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {isAuthenticated && (
                                        <button
                                            type="button"
                                            onClick={() => setReportModal({ open: true, type: 'project', itemId: project.id, userId: null, label: 'this project' })}
                                            className="btn-secondary-brutalist w-full flex items-center justify-center gap-2"
                                        >
                                            <Flag className="w-4 h-4" /> Report Project
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {canManageCollaborationRequests && collaborations.length > 0 && (
                    <section className="card-brutalist p-6 mb-6" data-testid="collaboration-requests">
                        <h2 className="font-heading font-bold text-xl uppercase tracking-tight mb-4">
                            Collaboration Requests
                        </h2>
                        <div className="space-y-4">
                            {collaborations.map((collab) => (
                                <div key={collab.id} className="border-2 border-black bg-white p-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            {collab.requester_profile_picture ? (
                                                <img
                                                    src={collab.requester_profile_picture}
                                                    alt={collab.requester_username}
                                                    className="w-10 h-10 border-2 border-black object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-black text-white flex items-center justify-center border-2 border-black font-bold">
                                                    {collab.requester_username?.[0]?.toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <Link to={`/profile/${collab.requester_id}`} className="font-bold hover:text-primary transition-colors">
                                                    @{collab.requester_username}
                                                </Link>
                                                <p className="text-xs text-text-secondary font-mono">{formatDate(collab.created_at)}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{collab.message || 'No message provided.'}</p>
                                    </div>

                                    <div className="flex flex-col gap-2 md:items-end">
                                        <span className="badge-idea">{String(collab.status).toUpperCase()}</span>
                                        {collab.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateCollabStatus(collab.id, 'accepted')}
                                                    className="btn-primary-brutalist py-2 px-3 text-xs"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateCollabStatus(collab.id, 'rejected')}
                                                    className="btn-secondary-brutalist py-2 px-3 text-xs"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {canManageCollaborators && collab.status === 'accepted' && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCollaborator(collab.id)}
                                                className="btn-secondary-brutalist py-2 px-3 text-xs"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
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
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'chat' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                        }`}
                        data-testid="tab-chat"
                    >
                        Project Chat
                    </button>
                </div>

                {/* Updates Tab */}
                {activeTab === 'updates' && (
                    <div data-testid="updates-section">
                        {/* Add Update Form (Owner Only) */}
                        {canEditProject && (
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
                        <UpdateFeed
                            updates={updates}
                            canManageUpdates={isOwner}
                            currentUserId={user?.id}
                            onEditUpdate={handleEditUpdate}
                            onDeleteUpdate={handleDeleteUpdate}
                        />
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

                {/* Chat Tab */}
                {activeTab === 'chat' && (
                    <ProjectChat
                        projectId={projectId}
                        canChat={isOwner || collaborationStatus === 'accepted'}
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
                                    const isExpanded = expandedStages[stage.stage_name];
                                    const isEditable = stage.status === 'Active' || stage.status === 'Reopened';
                                    return (
                                        <div key={stage.stage_name} className="sdlc-stage-block">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleStage(stage.stage_name)}
                                                    className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm"
                                                >
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    {formatStageLabel(stage.stage_name)}
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    {stage.source === 'External' && (
                                                        <span className="badge-idea">EXTERNAL</span>
                                                    )}
                                                    {getStageStatusBadge(stage.status)}
                                                    {canEditProject && stage.status === 'Completed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReopenStage(stage.stage_name)}
                                                            className="btn-secondary-brutalist py-1 px-2 text-[10px]"
                                                            disabled={isReopeningStage}
                                                        >
                                                            REOPEN
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && (
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

                                                {canEditProject && isEditable && (
                                                    <div className="timeline-item">
                                                        <div className="timeline-node" />
                                                        <div className="timeline-content space-y-2">
                                                            <p className="font-semibold text-sm">Add Milestone</p>
                                                            <input
                                                                type="text"
                                                                className="input-brutalist w-full py-2 text-sm"
                                                                placeholder="Milestone title"
                                                                value={milestoneFormByStage[stage.stage_name]?.title || ''}
                                                                onChange={(e) => handleMilestoneFieldChange(stage.stage_name, 'title', e.target.value)}
                                                            />
                                                            <textarea
                                                                className="input-brutalist w-full py-2 text-sm min-h-[90px]"
                                                                placeholder="Milestone description"
                                                                value={milestoneFormByStage[stage.stage_name]?.description || ''}
                                                                onChange={(e) => handleMilestoneFieldChange(stage.stage_name, 'description', e.target.value)}
                                                            />
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    type="button"
                                                                    className="btn-primary-brutalist py-2 px-3 text-xs"
                                                                    disabled={isSubmittingMilestone}
                                                                    onClick={() => handleAddMilestone(stage.stage_name)}
                                                                >
                                                                    {isSubmittingMilestone ? 'ADDING...' : 'ADD MILESTONE'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {canEditProject && (
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleCompleteStage}
                                    className="btn-primary-brutalist py-2 px-4 text-xs"
                                    disabled={isCompletingStage}
                                >
                                    {isCompletingStage ? 'COMPLETING...' : 'MARK CURRENT STAGE COMPLETE'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ProjectDetail;
