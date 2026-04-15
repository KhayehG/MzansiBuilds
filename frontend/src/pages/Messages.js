import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { API_URL } from '../lib/api';
import { Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const Messages = () => {
  const { user, isAuthenticated } = useAuth();
  const { lastMessage, refreshUnreadMessageCount } = useWebSocket();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newDmUsername, setNewDmUsername] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);

  const emojis = ['😊', '😂', '👍', '❤️', '🔥', '🎉', '😮', '😢', '🤔', '✅'];

  const sortConversations = (list) => [...list].sort((a, b) => {
    const aTime = a.last_message_at || a.created_at || '';
    const bTime = b.last_message_at || b.created_at || '';
    return bTime.localeCompare(aTime);
  });

  const addEmoji = (emoji) => {
    setInput((prev) => prev + emoji);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchConvs = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/chat/conversations`, { withCredentials: true });
        setConversations(sortConversations(res.data || []));
      } catch (e) {
        setConversations([]);
      } finally {
        setLoadingConvs(false);
      }
    };
    fetchConvs();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!activeConv) return;
    setLoadingMsgs(true);
    axios.get(`${API_URL}/api/chat/messages/${activeConv.id}`, { withCredentials: true })
      .then(res => {
        setMessages(res.data || []);
        refreshUnreadMessageCount();
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeConv, refreshUnreadMessageCount]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'chat_message') {
      const incomingMessage = lastMessage.message || lastMessage;
      setConversations(prev => {
        const hasConv = prev.some(c => c.id === lastMessage.conversation_id);
        const updated = prev.map(conv => {
          if (conv.id !== lastMessage.conversation_id) return conv;
          return {
            ...conv,
            last_message: incomingMessage.content,
            last_message_at: incomingMessage.created_at,
          };
        });
        return hasConv ? sortConversations(updated) : prev;
      });

      if (lastMessage.conversation_id === activeConv?.id) {
        setMessages(prev => {
          const incomingMessage = lastMessage.message || lastMessage;
          if (prev.some(m => m.id === incomingMessage.id)) return prev;
          return [...prev, incomingMessage];
        });
      }
    }
  }, [lastMessage, activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConv) return;
    try {
      await axios.post(`${API_URL}/api/chat/messages`, {
        conversation_id: activeConv.id,
        content: input.trim(),
      }, { withCredentials: true });
      setInput('');
    } catch (e) {
      toast.error('Failed to send message');
    }
  };

  const handleStartDm = async (e) => {
    e.preventDefault();
    if (!newDmUsername.trim()) return;
    try {
      // Find user by username
      const usersRes = await axios.get(`${API_URL}/api/users?q=${encodeURIComponent(newDmUsername.trim())}`, { withCredentials: true });
      const found = usersRes.data.find(u => u.username.toLowerCase() === newDmUsername.trim().toLowerCase());
      if (!found) { toast.error('User not found'); return; }
      const convRes = await axios.post(`${API_URL}/api/chat/conversations/dm?target_user_id=${found.id}`, {}, { withCredentials: true });
      setConversations(prev => sortConversations(prev.some(c => c.id === convRes.data.id) ? prev : [convRes.data, ...prev]));
      setActiveConv(convRes.data);
      setNewDmUsername('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start DM');
    }
  };

  const getConvLabel = (conv) => {
    if (conv.type === 'project') return `Project: ${conv.project_title || conv.title || conv.project_id}`;
    return `DM: ${conv.other_participant_username || conv.title || 'Direct Message'}`;
  };

  if (!isAuthenticated) return <div className="min-h-screen bg-background"><Navbar /><div className="p-8 text-center">Please log in to view messages.</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-4 items-center mb-6">
          <MessageSquare className="w-7 h-7" />
          <h1 className="font-heading font-black text-3xl tracking-tighter">Messages</h1>
        </div>
        <div className="flex gap-0 border-2 border-black" style={{ minHeight: 480 }}>
          {/* Sidebar */}
          <div className="w-64 border-r-2 border-black flex flex-col bg-surface">
            <form onSubmit={handleStartDm} className="flex border-b-2 border-black">
              <input
                className="flex-1 p-2 text-sm outline-none bg-white"
                placeholder="Start DM with @username"
                value={newDmUsername}
                onChange={e => setNewDmUsername(e.target.value)}
              />
              <button type="submit" className="px-3 bg-primary text-white text-sm font-bold">+</button>
            </form>
            <div className="flex-1 overflow-y-auto">
              {loadingConvs && <div className="p-4 text-sm text-text-secondary">Loading...</div>}
              {!loadingConvs && conversations.length === 0 && (
                <div className="p-4 text-sm text-text-secondary">No conversations yet.</div>
              )}
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-gray-200 hover:bg-white transition-colors ${activeConv?.id === conv.id ? 'bg-white border-l-4 border-l-primary' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{getConvLabel(conv)}</span>
                    {conv.unread_count > 0 && (
                      <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-full border border-black bg-primary px-1 text-[10px] text-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary truncate">
                    {conv.last_message || 'No messages yet.'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center text-text-secondary">
                Select a conversation or start a new DM.
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b-2 border-black font-bold text-sm bg-surface">
                  {getConvLabel(activeConv)}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                  {loadingMsgs && <div className="text-text-secondary text-sm">Loading messages...</div>}
                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded px-3 py-2 max-w-xs text-sm ${msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-gray-100 border border-gray-300'}`}>
                        {msg.sender_id !== user?.id && (
                          <span className="block text-xs font-bold mb-1">{msg.sender_username || msg.sender_id}</span>
                        )}
                        {msg.content}
                        <div className="text-xs opacity-60 mt-1 text-right">{msg.created_at?.slice(11, 16)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSend} className="flex border-t-2 border-black relative items-center">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(prev => !prev)}
                    className="px-3 text-lg bg-surface border-r-2 border-black"
                    aria-label="Toggle emoji picker"
                  >
                    😊
                  </button>
                  <div className="flex-1 relative">
                    <input
                      className="w-full p-3 outline-none text-sm"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Type a message..."
                    />
                    {showEmojiPicker && (
                      <div className="absolute left-0 bottom-full mb-2 z-10 w-full rounded border border-black bg-white p-2 shadow-lg">
                        <div className="grid grid-cols-5 gap-2">
                          {emojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => addEmoji(emoji)}
                              className="rounded p-2 text-lg hover:bg-gray-100"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="px-4 bg-primary text-white" disabled={!input.trim()}>
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
