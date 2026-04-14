import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { ArrowLeft, FileText, Target, HandHelping, Save } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const SDLC_STAGE_OPTIONS = {
    waterfall: [
        { value: 'planning', label: 'Planning', desc: 'Define goals and scope' },
        { value: 'requirements', label: 'Requirements', desc: 'Capture detailed needs' },
        { value: 'design', label: 'Design', desc: 'Architecture and technical design' },
        { value: 'development', label: 'Development', desc: 'Build core functionality' },
        { value: 'testing', label: 'Testing', desc: 'Validate quality and behavior' },
        { value: 'deployment', label: 'Deployment', desc: 'Release to users' },
        { value: 'maintenance', label: 'Maintenance', desc: 'Operate and improve' }
    ],
    agile: [
        { value: 'backlog', label: 'Backlog', desc: 'Capture and refine work items' },
        { value: 'sprint_planning', label: 'Sprint Planning', desc: 'Define sprint goals and tasks' },
        { value: 'development', label: 'Development', desc: 'Implement sprint work' },
        { value: 'testing', label: 'Testing', desc: 'Verify increment quality' },
        { value: 'review', label: 'Review', desc: 'Review outcomes and iterate' }
    ]
};

const legacyToCurrentStage = (legacyStage, sdlcType) => {
    if (sdlcType === 'agile') {
        if (legacyStage === 'completed') return 'review';
        if (legacyStage === 'in_progress') return 'development';
        return 'backlog';
    }
    if (legacyStage === 'completed') return 'maintenance';
    if (legacyStage === 'in_progress') return 'development';
    return 'planning';
};

const EditProject = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sdlcType, setSdlcType] = useState('waterfall');
    const [currentStage, setCurrentStage] = useState('planning');
    const [supportNeeded, setSupportNeeded] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/projects/${projectId}`, { withCredentials: true });
                const project = response.data;
                
                if (!project.can_edit_project) {
                    toast.error('Not authorized to edit this project');
                    navigate(`/project/${projectId}`);
                    return;
                }
                
                setTitle(project.title);
                setDescription(project.description);
                const nextSdlcType = project.sdlc_type || 'waterfall';
                setSdlcType(nextSdlcType);
                setCurrentStage(project.current_stage || legacyToCurrentStage(project.stage, nextSdlcType));
                setSupportNeeded(project.support_needed || '');
            } catch (error) {
                toast.error('Project not found');
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated && user) {
            fetchProject();
        } else if (!isAuthenticated) {
            navigate('/login');
        }
    }, [projectId, user, isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            await axios.put(
                `${API_URL}/api/projects/${projectId}`,
                { title, description, current_stage: currentStage, support_needed: supportNeeded },
                { withCredentials: true }
            );
            toast.success('Project updated!');
            navigate(`/project/${projectId}`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update project');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex items-center justify-center py-20">
                    <p className="text-text-secondary font-mono">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Back Button */}
                <Link 
                    to={`/project/${projectId}`}
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-6 hover:text-primary transition-colors"
                    data-testid="back-link"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Project
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="font-heading font-black text-4xl tracking-tighter" data-testid="edit-title">
                        EDIT PROJECT
                    </h1>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6" data-testid="edit-form">
                    <div className="card-brutalist p-6">
                        <label className="text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Project Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input-brutalist w-full"
                            required
                            data-testid="edit-title-input"
                        />
                    </div>

                    <div className="card-brutalist p-6">
                        <label className="block text-xs uppercase tracking-widest font-bold mb-3">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input-brutalist w-full min-h-[150px]"
                            required
                            data-testid="edit-description-input"
                        />
                    </div>

                    <div className="card-brutalist p-6">
                        <label className="text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            SDLC Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'waterfall', label: 'WATERFALL', desc: 'Linear, controlled flow' },
                                { value: 'agile', label: 'AGILE', desc: 'Iterative sprint cycles' }
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setSdlcType(option.value);
                                        const defaultStage = SDLC_STAGE_OPTIONS[option.value][0]?.value;
                                        if (defaultStage) setCurrentStage(defaultStage);
                                    }}
                                    className={`p-4 border-2 border-black text-left transition-all ${
                                        sdlcType === option.value
                                            ? 'bg-primary text-white shadow-brutalist'
                                            : 'bg-white hover:bg-gray-50'
                                    }`}
                                    data-testid={`edit-sdlc-${option.value}`}
                                >
                                    <span className="block font-bold text-sm">{option.label}</span>
                                    <span className={`block text-xs mt-1 ${sdlcType === option.value ? 'text-white/80' : 'text-text-secondary'}`}>
                                        {option.desc}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card-brutalist p-6">
                        <label className="text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Current SDLC Stage
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {SDLC_STAGE_OPTIONS[sdlcType].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setCurrentStage(option.value)}
                                    className={`p-4 border-2 border-black text-left transition-all ${
                                        currentStage === option.value
                                            ? 'bg-primary text-white shadow-brutalist' 
                                            : 'bg-white hover:bg-gray-50'
                                    }`}
                                    data-testid={`edit-current-stage-${option.value}`}
                                >
                                    <span className="block font-bold text-sm uppercase">{option.label}</span>
                                    <span className={`block text-xs mt-1 ${currentStage === option.value ? 'text-white/80' : 'text-text-secondary'}`}>
                                        {option.desc}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card-brutalist p-6">
                        <label className="text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                            <HandHelping className="w-4 h-4" />
                            Looking For Help With
                        </label>
                        <input
                            type="text"
                            value={supportNeeded}
                            onChange={(e) => setSupportNeeded(e.target.value)}
                            className="input-brutalist w-full"
                            placeholder="e.g., Frontend developer, UX feedback"
                            data-testid="edit-support-input"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                        data-testid="edit-submit"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                        <Save className="w-5 h-5" />
                    </button>
                </form>
            </main>
        </div>
    );
};

export default EditProject;
