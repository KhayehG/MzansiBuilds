import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import { useAuth } from './AuthContext';
import { API_URL, WS_URL } from '../lib/api';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const isAuthenticatedRef = useRef(isAuthenticated);
    const refreshUnreadMessageCountRef = useRef(null);
    const maxReconnectAttempts = 5;

    const refreshUnreadMessageCount = useCallback(async () => {
        if (!isAuthenticated) {
            setUnreadMessageCount(0);
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/api/chat/conversations`, { withCredentials: true });
            const conversations = response.data || [];
            setUnreadMessageCount(
                conversations.reduce((total, conversation) => total + (conversation.unread_count || 0), 0)
            );
        } catch (error) {
            setUnreadMessageCount(0);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        isAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated]);

    useEffect(() => {
        refreshUnreadMessageCountRef.current = refreshUnreadMessageCount;
    }, [refreshUnreadMessageCount]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            wsRef.current = new WebSocket(`${WS_URL}/ws`);

            wsRef.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttempts.current = 0;
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);
                    if (data.type === 'chat_message' && isAuthenticatedRef.current) {
                        refreshUnreadMessageCountRef.current?.();
                    }
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                
                // Attempt to reconnect
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    reconnectAttempts.current += 1;
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    reconnectTimeoutRef.current = setTimeout(connect, timeout);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Error creating WebSocket:', error);
        }
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    useEffect(() => {
        refreshUnreadMessageCount();
    }, [refreshUnreadMessageCount]);

    return (
        <WebSocketContext.Provider value={{ 
            isConnected, 
            lastMessage, 
            unreadMessageCount,
            refreshUnreadMessageCount,
            sendMessage,
            connect,
            disconnect
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

export default WebSocketContext;
