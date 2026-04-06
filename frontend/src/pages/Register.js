import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Code2, Mail, Lock, User, FileText, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register, isAuthenticated } = useAuth();
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

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setIsLoading(false);
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            setIsLoading(false);
            return;
        }

        const result = await register(email, password, username, bio);
        
        if (result.success) {
            toast.success('Welcome to Build in Public!');
            navigate('/');
        } else {
            setError(result.error);
        }
        
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Image */}
            <div className="hidden lg:block lg:w-1/2 relative border-r-2 border-black">
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ 
                        backgroundImage: `url('https://images.pexels.com/photos/29452601/pexels-photo-29452601.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')` 
                    }}
                />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute bottom-0 left-0 right-0 p-12">
                    <div className="text-white">
                        <h2 className="font-heading font-black text-3xl mb-4">
                            Join the movement
                        </h2>
                        <ul className="space-y-2 font-mono text-sm">
                            <li className="flex items-center gap-2">
                                <span className="text-primary">→</span> Share your journey
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary">→</span> Get feedback early
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary">→</span> Find collaborators
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-primary">→</span> Celebrate wins together
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <Link to="/" className="flex items-center gap-2 font-heading font-black text-2xl mb-6">
                            <Code2 className="w-8 h-8" strokeWidth={2.5} />
                            MzansiBuilds
                        </Link>
                        <h1 className="font-heading font-black text-4xl tracking-tighter mb-2" data-testid="register-title">
                            JOIN THE BUILDERS
                        </h1>
                        <p className="text-text-secondary">Start sharing your journey today</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-2 border-error text-error p-4 mb-6 font-mono text-sm" data-testid="register-error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input-brutalist w-full !pl-14"
                                    placeholder="yourhandle"
                                    autoComplete="username"
                                    required
                                    data-testid="register-username"
                                />
                            </div>
                        </div>

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
                                    data-testid="register-email"
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
                                    autoComplete="new-password"
                                    required
                                    data-testid="register-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    data-testid="register-password-toggle"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Bio <span className="text-text-secondary font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <FileText className="pointer-events-none absolute left-4 top-3.5 w-4 h-4 text-text-secondary" />
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    className="input-brutalist w-full !pl-14 min-h-[80px]"
                                    placeholder="What are you building?"
                                    data-testid="register-bio"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                            data-testid="register-submit"
                        >
                            {isLoading ? 'Creating account...' : 'Start Building'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-text-secondary">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary font-bold hover:underline" data-testid="register-login-link">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
