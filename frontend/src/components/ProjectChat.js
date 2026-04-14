import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { API_URL } from '../lib/api';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

const ProjectChat = ({ projectId, canChat }) => {
  const { user } = useAuth();
  const { lastMessage } = useWebSocket();
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Get or create the project conversation, then load messages
  useEffect(() => {
    if (!canChat || !projectId) return;
    const init = async () => {
      try {
        const convRes = await axios.post(`${API_URL}/api/chat/conversations`, {
          type: 'project',
          project_id: projectId,
        }, { withCredentials: true });
        setConversationId(convRes.data.id);
        const msgsRes = await axios.get(`${API_URL}/api/chat/messages/${convRes.data.id}`, { withCredentials: true });
        setMessages(msgsRes.data || []);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projectId, canChat]);

  // Real-time: append incoming chat messages for this conversation
  useEffect(() => {
    if (lastMessage?.type === 'chat_message' && lastMessage?.conversation_id === conversationId) {
      setMessages(prev => {
        const incomingMessage = lastMessage.message || lastMessage;
        if (prev.some(m => m.id === incomingMessage.id)) return prev;
        return [...prev, incomingMessage];
      });
    }
  }, [lastMessage, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;
    try {
      await axios.post(`${API_URL}/api/chat/messages`, {
        conversation_id: conversationId,
        content: input.trim(),
      }, { withCredentials: true });
      setInput('');
    } catch (e) {
      toast.error('Failed to send message');
    }
  };

  if (!canChat) {
    return <div className="p-4 text-center text-text-secondary border-2 border-black">Only collaborators and project owners can access project chat.</div>;
  }

  if (loading) {
    return <div className="p-4 text-center text-text-secondary">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col border-2 border-black bg-white" style={{ height: 400 }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-surface">
        {messages.length === 0 && <div className="text-center text-text-secondary text-sm">No messages yet. Start the conversation!</div>}
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded px-3 py-2 max-w-xs text-sm ${msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-white border border-gray-300'}`}>
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
      <form onSubmit={handleSend} className="flex border-t-2 border-black">
        <input
          className="flex-1 p-2 outline-none text-sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" className="p-3 bg-primary text-white" disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ProjectChat;
