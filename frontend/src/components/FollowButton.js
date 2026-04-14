import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const FollowButton = ({ userId, initialIsFollowing = false, inactiveLabel = 'Follow', onFollowChange, size = 'default' }) => {
    const { isAuthenticated, user } = useAuth();
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isLoading, setIsLoading] = useState(false);

    // Don't show button for own profile
    if (isAuthenticated && user?.id === userId) {
        return null;
    }

    const handleFollow = async () => {
        if (!isAuthenticated) {
            toast.error('Please login to follow');
            return;
        }

        setIsLoading(true);
        try {
            if (isFollowing) {
                await axios.delete(`${API_URL}/api/users/${userId}/follow`, { withCredentials: true });
                setIsFollowing(false);
                if (onFollowChange) onFollowChange(false);
                toast.success('Unfollowed');
            } else {
                await axios.post(`${API_URL}/api/users/${userId}/follow`, {}, { withCredentials: true });
                setIsFollowing(true);
                if (onFollowChange) onFollowChange(true);
                toast.success('Following!');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update follow status');
        } finally {
            setIsLoading(false);
        }
    };

    const sizeClasses = size === 'small' 
        ? 'py-1 px-3 text-xs'
        : 'py-2 px-4 text-sm';

    return (
        <button
            onClick={handleFollow}
            disabled={isLoading}
            className={`${sizeClasses} font-bold uppercase tracking-wider border-2 border-black transition-all flex items-center gap-2 ${
                isFollowing 
                    ? 'bg-white text-black hover:bg-red-50 hover:text-red-600 hover:border-red-600'
                    : 'bg-primary text-white hover:bg-primary-hover shadow-brutalist-sm'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid={`follow-btn-${userId}`}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
                <>
                    <UserMinus className="w-4 h-4" />
                    Following
                </>
            ) : (
                <>
                    <UserPlus className="w-4 h-4" />
                    {inactiveLabel}
                </>
            )}
        </button>
    );
};

export default FollowButton;
