import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { Rocket, FileText, Target, HandHelping, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const CreateProject = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [stage, setStage] = useState('idea');
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
                { title, description, stage, support_needed: supportNeeded },
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
                                    data-testid={`stage-${option.value}`}
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
