import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import ProjectCard from '../components/ProjectCard';
import FollowButton from '../components/FollowButton';
import { User, Calendar, Rocket, Trophy, Edit2, Save, X, Github, Linkedin, Users, Circle } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const Profile = () => {
    const { userId } = useParams();
    const { user: currentUser, isAuthenticated } = useAuth();
    const [profile, setProfile] = useState(null);
    const [projects, setProjects] = useState([]);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('projects');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        username: '',
        bio: '',
        profile_picture_url: '',
        skills: [],
        github_url: '',
        linkedin_url: ''
    });
    const [newSkill, setNewSkill] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const targetUserId = userId || currentUser?.id;
    const isOwnProfile = isAuthenticated && currentUser?.id === targetUserId;

    const fetchProfile = useCallback(async () => {
        if (!targetUserId) {
            setLoading(false);
            return;
        }
        try {
            const [profileRes, projectsRes] = await Promise.all([
                axios.get(`${API_URL}/api/users/${targetUserId}`, { withCredentials: true }),
                axios.get(`${API_URL}/api/projects?user_id=${targetUserId}`, { withCredentials: true })
            ]);
            setProfile(profileRes.data);
            setProjects(projectsRes.data);
            setEditData({
                username: profileRes.data.username,
                bio: profileRes.data.bio || '',
                profile_picture_url: profileRes.data.profile_picture_url || '',
                skills: profileRes.data.skills || [],
                github_url: profileRes.data.github_url || '',
                linkedin_url: profileRes.data.linkedin_url || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [targetUserId]);

    const fetchFollowers = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/users/${targetUserId}/followers`);
            setFollowers(response.data);
        } catch (error) {
            console.error('Error fetching followers:', error);
        }
    }, [targetUserId]);

    const fetchFollowing = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/users/${targetUserId}/following`);
            setFollowing(response.data);
        } catch (error) {
            console.error('Error fetching following:', error);
        }
    }, [targetUserId]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        if (activeTab === 'followers') fetchFollowers();
        if (activeTab === 'following') fetchFollowing();
    }, [activeTab, fetchFollowers, fetchFollowing]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await axios.put(
                `${API_URL}/api/users/me`,
                editData,
                { withCredentials: true }
            );
            setProfile(prev => ({ ...prev, ...editData }));
            setIsEditing(false);
            toast.success('Profile updated!');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const addSkill = () => {
        if (newSkill.trim() && editData.skills.length < 10) {
            setEditData(prev => ({
                ...prev,
                skills: [...prev.skills, newSkill.trim()]
            }));
            setNewSkill('');
        }
    };

    const removeSkill = (index) => {
        setEditData(prev => ({
            ...prev,
            skills: prev.skills.filter((_, i) => i !== index)
        }));
    };

    const handleProfileImageSelection = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please choose a valid image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Please choose an image under 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setEditData(prev => ({ ...prev, profile_picture_url: reader.result }));
            }
        };
        reader.onerror = () => toast.error('Failed to read the selected image');
        reader.readAsDataURL(file);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const handleFollowChange = (isNowFollowing) => {
        setProfile(prev => ({
            ...prev,
            follower_count: isNowFollowing ? prev.follower_count + 1 : prev.follower_count - 1,
            is_following: isNowFollowing
        }));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex items-center justify-center py-20">
                    <Rocket className="w-8 h-8 animate-pulse text-primary" />
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                    <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-text-secondary text-xl">Profile not found</p>
                    {!isAuthenticated && (
                        <Link to="/login" className="btn-primary-brutalist inline-block mt-4">
                            Login to view your profile
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Profile Sidebar */}
                    <div className="md:col-span-1">
                        <div className="card-brutalist p-6 sticky top-24" data-testid="profile-card">
                            {/* Avatar */}
                            <div className="relative">
                                {profile.profile_picture_url ? (
                                    <img 
                                        src={profile.profile_picture_url}
                                        alt={profile.username}
                                        className="w-24 h-24 border-4 border-black mx-auto mb-4 object-cover"
                                    />
                                ) : (
                                    <div className="w-24 h-24 bg-primary text-white flex items-center justify-center border-4 border-black mx-auto mb-4">
                                        <span className="font-heading font-black text-4xl">
                                            {profile.username?.[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                {/* Online Status */}
                                {profile.is_online && (
                                    <div className="absolute bottom-4 right-1/2 translate-x-8">
                                        <Circle className="w-4 h-4 text-green-500 fill-green-500" />
                                    </div>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">Username</label>
                                        <input
                                            type="text"
                                            value={editData.username}
                                            onChange={(e) => setEditData(prev => ({ ...prev, username: e.target.value }))}
                                            className="input-brutalist w-full text-sm"
                                            data-testid="edit-username"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">Bio</label>
                                        <textarea
                                            value={editData.bio}
                                            onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                                            className="input-brutalist w-full text-sm"
                                            rows={3}
                                            data-testid="edit-bio"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">Profile Image</label>
                                        <input
                                            type="url"
                                            value={editData.profile_picture_url}
                                            onChange={(e) => setEditData(prev => ({ ...prev, profile_picture_url: e.target.value }))}
                                            className="input-brutalist w-full text-sm"
                                            placeholder="https://example.com/avatar.jpg"
                                        />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleProfileImageSelection}
                                            className="mt-2 block w-full text-xs"
                                        />
                                        <p className="text-[10px] text-text-secondary mt-1">
                                            Paste an image URL or choose a local file for testing.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">Skills</label>
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {editData.skills.map((skill, i) => (
                                                <span key={i} className="badge-idea flex items-center gap-1">
                                                    {skill}
                                                    <button onClick={() => removeSkill(i)} className="hover:text-red-500">&times;</button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                value={newSkill}
                                                onChange={(e) => setNewSkill(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                                placeholder="Add skill"
                                                className="input-brutalist flex-1 text-xs py-1"
                                            />
                                            <button onClick={addSkill} className="btn-secondary-brutalist py-1 px-2 text-xs">+</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">GitHub URL</label>
                                        <input
                                            type="url"
                                            value={editData.github_url}
                                            onChange={(e) => setEditData(prev => ({ ...prev, github_url: e.target.value }))}
                                            className="input-brutalist w-full text-sm"
                                            placeholder="https://github.com/username"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase tracking-widest font-bold mb-1">LinkedIn URL</label>
                                        <input
                                            type="url"
                                            value={editData.linkedin_url}
                                            onChange={(e) => setEditData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                                            className="input-brutalist w-full text-sm"
                                            placeholder="https://linkedin.com/in/username"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSaving}
                                            className="btn-primary-brutalist py-2 px-3 text-xs flex-1 flex items-center justify-center gap-1"
                                            data-testid="save-profile"
                                        >
                                            <Save className="w-3 h-3" /> Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="btn-secondary-brutalist py-2 px-3 text-xs"
                                            data-testid="cancel-edit"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h1 className="font-heading font-bold text-2xl text-center mb-1" data-testid="profile-username">
                                        @{profile.username}
                                    </h1>
                                    
                                    {profile.bio && (
                                        <p className="text-text-secondary text-center text-sm mb-4" data-testid="profile-bio">
                                            {profile.bio}
                                        </p>
                                    )}

                                    {/* Skills */}
                                    {profile.skills && profile.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 justify-center mb-4">
                                            {profile.skills.map((skill, i) => (
                                                <span key={i} className="badge-idea">{skill}</span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Social Links */}
                                    <div className="flex justify-center gap-3 mb-4">
                                        {profile.github_url && (
                                            <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                                <Github className="w-5 h-5" />
                                            </a>
                                        )}
                                        {profile.linkedin_url && (
                                            <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                                <Linkedin className="w-5 h-5" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Follow Button */}
                                    {!isOwnProfile && (
                                        <div className="mb-4 flex justify-center">
                                            <FollowButton 
                                                userId={targetUserId} 
                                                initialIsFollowing={profile.is_following}
                                                onFollowChange={handleFollowChange}
                                            />
                                        </div>
                                    )}

                                    <div className="border-t-2 border-gray-200 pt-4 mt-4 space-y-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar className="w-4 h-4 text-text-secondary" />
                                            <span>Joined {formatDate(profile.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Rocket className="w-4 h-4 text-text-secondary" />
                                            <span>{profile.project_count || 0} projects</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Trophy className="w-4 h-4 text-primary" />
                                            <span className="text-primary font-bold">{profile.completed_count || 0} shipped</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="w-4 h-4 text-text-secondary" />
                                            <span>{profile.follower_count || 0} followers · {profile.following_count || 0} following</span>
                                        </div>
                                    </div>

                                    {isOwnProfile && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="btn-secondary-brutalist w-full py-2 mt-4 text-xs flex items-center justify-center gap-2"
                                            data-testid="edit-profile"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit Profile
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="md:col-span-3">
                        {/* Tabs */}
                        <div className="flex border-2 border-black mb-6">
                            <button
                                onClick={() => setActiveTab('projects')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                                    activeTab === 'projects' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                Projects ({projects.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('followers')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                                    activeTab === 'followers' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                Followers ({profile.follower_count || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab('following')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                                    activeTab === 'following' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                Following ({profile.following_count || 0})
                            </button>
                        </div>

                        {/* Projects Tab */}
                        {activeTab === 'projects' && (
                            <>
                                {isOwnProfile && (
                                    <div className="flex justify-end mb-4">
                                        <Link to="/create" className="btn-primary-brutalist py-2 px-4 text-sm">
                                            New Project
                                        </Link>
                                    </div>
                                )}
                                {projects.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="profile-projects">
                                        {projects.map((project) => (
                                            <ProjectCard key={project.id} project={project} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="card-brutalist p-12 text-center" data-testid="no-projects">
                                        <Rocket className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                        <p className="text-text-secondary text-lg">
                                            {isOwnProfile ? "You haven't created any projects yet" : "No projects yet"}
                                        </p>
                                        {isOwnProfile && (
                                            <Link to="/create" className="btn-primary-brutalist inline-block mt-4">
                                                Start Your First Project
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Followers Tab */}
                        {activeTab === 'followers' && (
                            <div className="space-y-4">
                                {followers.length > 0 ? (
                                    followers.map((follower) => (
                                        <div key={follower.id} className="card-brutalist p-4 flex items-center justify-between">
                                            <Link to={`/profile/${follower.id}`} className="flex items-center gap-3 hover:text-primary">
                                                {follower.profile_picture_url ? (
                                                    <img src={follower.profile_picture_url} alt={follower.username} className="w-10 h-10 border-2 border-black object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-primary text-white flex items-center justify-center border-2 border-black font-bold">
                                                        {follower.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold">@{follower.username}</p>
                                                    {follower.bio && <p className="text-sm text-text-secondary line-clamp-1">{follower.bio}</p>}
                                                </div>
                                            </Link>
                                            <FollowButton userId={follower.id} size="small" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-300">
                                        <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                        <p className="text-text-secondary">No followers yet</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Following Tab */}
                        {activeTab === 'following' && (
                            <div className="space-y-4">
                                {following.length > 0 ? (
                                    following.map((user) => (
                                        <div key={user.id} className="card-brutalist p-4 flex items-center justify-between">
                                            <Link to={`/profile/${user.id}`} className="flex items-center gap-3 hover:text-primary">
                                                {user.profile_picture_url ? (
                                                    <img src={user.profile_picture_url} alt={user.username} className="w-10 h-10 border-2 border-black object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-primary text-white flex items-center justify-center border-2 border-black font-bold">
                                                        {user.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-bold">@{user.username}</p>
                                                    {user.bio && <p className="text-sm text-text-secondary line-clamp-1">{user.bio}</p>}
                                                </div>
                                            </Link>
                                            <FollowButton userId={user.id} initialIsFollowing={true} size="small" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-300">
                                        <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                        <p className="text-text-secondary">Not following anyone yet</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
