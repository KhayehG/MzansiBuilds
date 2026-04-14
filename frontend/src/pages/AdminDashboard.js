import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { AlertTriangle, EyeOff, FolderKanban, ShieldAlert, Users, Wifi } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '../components/Navbar';
import { API_URL } from '../lib/api';

const summaryCards = [
  { key: 'pending_reports', label: 'Pending Reports', icon: AlertTriangle, accent: 'text-error' },
  { key: 'under_review_reports', label: 'Under Review', icon: ShieldAlert, accent: 'text-primary' },
  { key: 'suspended_users', label: 'Suspended Users', icon: Users, accent: 'text-text-primary' },
  { key: 'hidden_projects', label: 'Hidden Projects', icon: EyeOff, accent: 'text-text-primary' },
  { key: 'total_projects', label: 'Projects', icon: FolderKanban, accent: 'text-primary' },
  { key: 'online_users', label: 'Online Users', icon: Wifi, accent: 'text-primary' },
];

const quickActions = [
  {
    title: 'Moderate Reports',
    description: 'Review pending items, hide or restore content, and close report queues.',
    href: '/admin/reports',
  },
  {
    title: 'Manage Users',
    description: 'Search builders, suspend abusive accounts, and restore access when needed.',
    href: '/admin/users',
  },
];

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/admin/overview`, { withCredentials: true });
        setOverview(response.data);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to load admin overview');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="card-brutalist p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-text-secondary">Control Room</p>
              <h1 className="font-heading font-black text-4xl tracking-tighter mt-2">ADMIN DASHBOARD</h1>
              <p className="text-text-secondary text-lg mt-3 max-w-2xl">
                Moderate reports, manage account access, and monitor hidden content from one place.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/admin/reports" className="btn-primary-brutalist">Open Reports</Link>
              <Link to="/admin/users" className="btn-secondary-brutalist">Open Users</Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {summaryCards.map(({ key, label, icon: Icon, accent }) => (
            <article key={key} className="card-brutalist p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-text-secondary">{label}</p>
                  <p className="font-heading font-black text-4xl mt-3">
                    {loading ? '...' : overview?.[key] ?? 0}
                  </p>
                </div>
                <Icon className={`w-8 h-8 ${accent}`} strokeWidth={2.5} />
              </div>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className="card-brutalist p-6 block hover:-translate-y-1 transition-transform">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-text-secondary">Quick Action</p>
              <h2 className="font-heading font-black text-2xl tracking-tight mt-3">{action.title}</h2>
              <p className="text-text-secondary mt-3">{action.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;