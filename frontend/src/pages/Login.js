import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Code2, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(email, password);
        
        if (result.success) {
            toast.success('Welcome back!');
            navigate('/');
        } else {
            setError(result.error);
        }
        
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <Link to="/" className="flex items-center gap-2 font-heading font-black text-2xl mb-6">
                            <Code2 className="w-8 h-8" strokeWidth={2.5} />
                            MzansiBuilds
                        </Link>
                        <h1 className="font-heading font-black text-4xl tracking-tighter mb-2" data-testid="login-title">
                            WELCOME BACK
                        </h1>
                        <p className="text-text-secondary">Sign in to continue building in public</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-2 border-error text-error p-4 mb-6 font-mono text-sm" data-testid="login-error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-brutalist w-full !pl-14"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                    data-testid="login-email"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-brutalist w-full !pl-14 !pr-14"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    data-testid="login-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    data-testid="login-password-toggle"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                            data-testid="login-submit"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-text-secondary">
                        New here?{' '}
                        <Link to="/register" className="text-primary font-bold hover:underline" data-testid="login-register-link">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative border-l-2 border-black">
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ 
                        backgroundImage: `url('https://images.unsplash.com/photo-1771061863061-8ffdddb28098?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBjb2RpbmclMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzUxNDkxMjB8MA&ixlib=rb-4.1.0&q=85')` 
                    }}
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute bottom-0 left-0 right-0 p-12">
                    <blockquote className="text-white">
                        <p className="font-heading font-bold text-2xl mb-4">
                            "Building in public is the fastest way to learn, grow, and connect with your community."
                        </p>
                        <footer className="text-white/70 font-mono text-sm">
                            — Every indie hacker ever
                        </footer>
                    </blockquote>
                </div>
            </div>
        </div>
    );
};

export default Login;
