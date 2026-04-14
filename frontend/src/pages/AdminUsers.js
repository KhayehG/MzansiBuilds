import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Search, ShieldBan, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '../components/Navbar';
import { API_URL } from '../lib/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyUserId, setBusyUserId] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter === 'active') params.set('suspended', 'false');
      if (statusFilter === 'suspended') params.set('suspended', 'true');

      const response = await axios.get(
        `${API_URL}/api/users/admin/all${params.toString() ? `?${params.toString()}` : ''}`,
        { withCredentials: true }
      );
      setUsers(response.data.users || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateSuspension = async (user, suspended) => {
    setBusyUserId(user.id);
    try {
      const params = new URLSearchParams({ suspended: String(suspended) });
      if (suspended) {
        params.set('reason', 'Admin moderation action');
      }
      await axios.put(`${API_URL}/api/users/admin/${user.id}/suspension?${params.toString()}`, {}, { withCredentials: true });
      toast.success(suspended ? 'User suspended' : 'User restored');
      await fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update suspension');
    } finally {
      setBusyUserId('');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-8 h-8 text-primary" strokeWidth={2.5} />
              <h1 className="font-heading font-black text-4xl tracking-tighter">ADMIN USERS</h1>
            </div>
            <p className="text-text-secondary text-lg">Search users and control account access.</p>
          </div>

          <button onClick={fetchUsers} className="btn-secondary-brutalist flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </section>

        <section className="card-brutalist p-5 flex flex-col gap-4 lg:flex-row lg:items-center">
          <label className="flex-1 flex items-center gap-3 border-2 border-black px-4 py-3 bg-white">
            <Search className="w-4 h-4 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by username, email, or bio"
              className="w-full bg-transparent outline-none"
            />
          </label>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-brutalist py-3">
            <option value="all">All users</option>
            <option value="active">Active only</option>
            <option value="suspended">Suspended only</option>
          </select>

          <button onClick={fetchUsers} className="btn-primary-brutalist">Apply</button>
        </section>

        {loading ? (
          <div className="card-brutalist p-10 text-center">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="card-brutalist p-10 text-center text-text-secondary">No users match the current filters.</div>
        ) : (
          <section className="space-y-4">
            {users.map((user) => (
              <article key={user.id} className="card-brutalist p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt={user.username} className="w-14 h-14 border-2 border-black object-cover" />
                  ) : (
                    <div className="w-14 h-14 border-2 border-black bg-black text-white flex items-center justify-center font-bold text-lg">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-lg">@{user.username}</h2>
                      <span className={user.is_suspended ? 'badge-idea text-error' : 'badge-completed'}>
                        {user.is_suspended ? 'suspended' : 'active'}
                      </span>
                      {user.role === 'admin' && <span className="badge-in-progress">admin</span>}
                    </div>
                    <p className="text-sm text-text-secondary">{user.email}</p>
                    {user.bio && <p className="text-sm mt-2 line-clamp-2">{user.bio}</p>}
                    {user.is_suspended && user.suspension_reason && (
                      <p className="text-sm mt-2 text-error">Reason: {user.suspension_reason}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => updateSuspension(user, !user.is_suspended)}
                  disabled={busyUserId === user.id}
                  className="btn-secondary-brutalist flex items-center justify-center gap-2 min-w-[180px]"
                >
                  {user.is_suspended ? <ShieldCheck className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                  {busyUserId === user.id ? 'Saving...' : user.is_suspended ? 'Restore Access' : 'Suspend User'}
                </button>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminUsers;