import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { Rocket, FileText, Target, HandHelping, ArrowRight } from 'lucide-react';
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

const CreateProject = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sdlcType, setSdlcType] = useState('waterfall');
    const [currentStage, setCurrentStage] = useState('planning');
    const [supportNeeded, setSupportNeeded] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await axios.post(
                `${API_URL}/api/projects`,
                {
                    title,
                    description,
                    sdlc_type: sdlcType,
                    current_stage: currentStage,
                    support_needed: supportNeeded,
                },
                { withCredentials: true }
            );
            toast.success('Project created successfully!');
            navigate(`/project/${response.data.id}`);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create project');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            
            <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <Rocket className="w-8 h-8 text-primary" strokeWidth={2.5} />
                        <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter" data-testid="create-title">
                            NEW PROJECT
                        </h1>
                    </div>
                    <p className="text-text-secondary font-body text-lg">
                        Share what you're building with the community
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6" data-testid="create-form">
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
                            placeholder="What are you building?"
                            required
                            data-testid="create-title-input"
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
                            placeholder="Tell us more about your project. What problem does it solve? Who is it for?"
                            required
                            data-testid="create-description-input"
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
                                    data-testid={`sdlc-${option.value}`}
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
                                    data-testid={`current-stage-${option.value}`}
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
                            Looking For Help With <span className="text-text-secondary font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={supportNeeded}
                            onChange={(e) => setSupportNeeded(e.target.value)}
                            className="input-brutalist w-full"
                            placeholder="e.g., Frontend developer, UX feedback, Beta testers"
                            data-testid="create-support-input"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                        data-testid="create-submit"
                    >
                        {isLoading ? 'Creating...' : 'Launch Project'}
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </form>
            </main>
        </div>
    );
};

export default CreateProject;
