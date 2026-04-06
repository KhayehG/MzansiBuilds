import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { ArrowLeft, FileText, Target, HandHelping, Save } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const EditProject = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [stage, setStage] = useState('idea');
    const [supportNeeded, setSupportNeeded] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/projects/${projectId}`);
                const project = response.data;
                
                if (project.user_id !== user?.id) {
                    toast.error('Not authorized to edit this project');
                    navigate(`/project/${projectId}`);
                    return;
                }
                
                setTitle(project.title);
                setDescription(project.description);
                setStage(project.stage);
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
                { title, description, stage, support_needed: supportNeeded },
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
                            Current Stage
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'idea', label: 'IDEA', desc: 'Just starting' },
                                { value: 'in_progress', label: 'BUILDING', desc: 'Work in progress' },
                                { value: 'completed', label: 'SHIPPED', desc: 'Ready to use' }
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setStage(option.value)}
                                    className={`p-4 border-2 border-black text-left transition-all ${
                                        stage === option.value 
                                            ? 'bg-primary text-white shadow-brutalist' 
                                            : 'bg-white hover:bg-gray-50'
                                    }`}
                                    data-testid={`edit-stage-${option.value}`}
                                >
                                    <span className="block font-bold text-sm">{option.label}</span>
                                    <span className={`block text-xs mt-1 ${stage === option.value ? 'text-white/80' : 'text-text-secondary'}`}>
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
