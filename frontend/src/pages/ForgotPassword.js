import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await axios.post(`${API_BASE}/auth/forgot-password`, { email });
            setSubmitted(true);
        } catch {
            // Show generic message to avoid leaking info
            setSubmitted(true);
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
                            FORGOT PASSWORD
                        </h1>
                        <p className="text-text-secondary">
                            Enter your email and we'll send you a reset link.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="bg-green-50 border-2 border-black p-6 font-mono text-sm space-y-4">
                            <p className="font-bold">Check your inbox!</p>
                            <p>
                                If that email is registered, a password reset link has been sent. It
                                expires in 1 hour.
                            </p>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
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
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary-brutalist w-full flex items-center justify-center gap-2"
                            >
                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </form>
                    )}

                    {!submitted && (
                        <p className="mt-8 text-center text-text-secondary">
                            Remember it?{' '}
                            <Link to="/login" className="text-primary font-bold hover:underline">
                                Back to login
                            </Link>
                        </p>
                    )}
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
                            "Every builder forgets their password at least once."
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

export default ForgotPassword;
