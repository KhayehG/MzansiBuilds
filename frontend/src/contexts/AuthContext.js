import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

import { API_URL } from '../lib/api';

const AuthContext = createContext(null);

// Helper to format API error detail
function formatApiErrorDetail(detail) {
    if (detail == null) return "Something went wrong. Please try again.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
    if (detail && typeof detail.msg === "string") return detail.msg;
    return String(detail);
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // null = checking, false = not authenticated, object = authenticated
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/auth/me`, {
                withCredentials: true
            });
            setUser(response.data);
        } catch (error) {
            setUser(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/login`, 
                { email, password },
                { withCredentials: true }
            );
            setUser(response.data);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: formatApiErrorDetail(error.response?.data?.detail) || error.message 
            };
        }
    };

    const register = async (email, password, username, bio = '') => {
        try {
            const response = await axios.post(`${API_URL}/api/auth/register`,
                { email, password, username, bio },
                { withCredentials: true }
            );
            setUser(response.data);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: formatApiErrorDetail(error.response?.data?.detail) || error.message 
            };
        }
    };

    const logout = async () => {
        try {
            await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(false);
        }
    };

    const refreshAuth = async () => {
        try {
            await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
            await checkAuth();
            return true;
        } catch (error) {
            setUser(false);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            login, 
            register, 
            logout, 
            refreshAuth,
            isAuthenticated: !!user && user !== false
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
