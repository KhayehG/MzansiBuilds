import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Code2, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API_URL } from '../lib/api';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!token) {
            setError('No reset token found in URL. Please use the link from your email.');
            return;
        }

        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/auth/reset-password`, {
                token,
                new_password: newPassword,
            });
            toast.success('Password updated! Please sign in.');
            navigate('/login');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Reset failed. Your link may have expired.';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
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
                        <h1 className="font-heading font-black text-4xl tracking-tighter mb-2">
                            RESET PASSWORD
                        </h1>
                        <p className="text-text-secondary">Choose a new password for your account.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-2 border-error text-error p-4 mb-6 font-mono text-sm">
                            {error}
                        </div>
                    )}

                    {!token && !error && (
                        <div className="bg-yellow-50 border-2 border-black text-black p-4 mb-6 font-mono text-sm">
                            No reset token in URL. Please use the link from your email.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="input-brutalist w-full !pl-14 !pr-14"
                                    placeholder="Min. 8 characters"
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((p) => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="input-brutalist w-full !pl-14"
                                    placeholder="Repeat your password"
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !token}
                            className="btn-primary-brutalist w-full flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? 'Updating...' : 'Update Password'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-text-secondary">
                        Back to{' '}
                        <Link to="/login" className="text-primary font-bold hover:underline">
                            Login
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Side - Decorative */}
            <div className="hidden lg:block lg:w-1/2 relative border-l-2 border-black">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1771061863061-8ffdddb28098?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBjb2RpbmclMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzUxNDkxMjB8MA&ixlib=rb-4.1.0&q=85')`,
                    }}
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute bottom-0 left-0 right-0 p-12">
                    <blockquote className="text-white">
                        <p className="font-heading font-bold text-2xl mb-4">
                            "Security is not optional. It's the foundation."
                        </p>
                        <footer className="text-white/70 font-mono text-sm">
                            — The MzansiBuilds team
                        </footer>
                    </blockquote>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
