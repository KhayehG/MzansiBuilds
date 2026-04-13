import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Bell } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

const NotificationCenter = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { lastMessage } = useWebSocket();

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/chat/notifications`, { withCredentials: true });
      setNotifications(res.data.notifications || []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchNotifications();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'notification') return;
    const n = lastMessage.data;
    setNotifications(prev => [n, ...prev]);
  }, [lastMessage]);

  const markRead = async (id) => {
    try {
      await axios.put(`${API_URL}/api/chat/notifications/${id}/read`, {}, { withCredentials: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/chat/notifications/read-all`, {}, { withCredentials: true });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  if (!isAuthenticated) return null;

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative p-2 border-2 border-black bg-white hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-black font-bold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50 border-2 border-black bg-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-2 border-b-2 border-black">
            <span className="font-bold uppercase tracking-wide text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary underline">Mark all read</button>
            )}
          </div>
          {loading && <div className="p-4 text-text-secondary text-sm">Loading...</div>}
          {!loading && notifications.length === 0 && (
            <div className="p-4 text-text-secondary text-sm">No notifications.</div>
          )}
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-200">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`p-3 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50 font-semibold' : ''}`}
              >
                <span className="text-sm">{n.message}</span>
                <div className="text-xs text-text-secondary mt-1">{n.created_at?.slice(0, 16).replace('T', ' ')}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
