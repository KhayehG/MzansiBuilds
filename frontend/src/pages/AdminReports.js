import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { EyeOff, Filter, RefreshCw, ShieldAlert, User, MessageSquare, FolderKanban, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '../components/Navbar';
import { API_URL } from '../lib/api';

const AdminReports = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchReports = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (typeFilter) params.set('report_type', typeFilter);

            const response = await axios.get(
                `${API_URL}/api/reports/admin/all${params.toString() ? `?${params.toString()}` : ''}`,
                { withCredentials: true }
            );
            setReports(response.data.reports || []);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to load admin reports');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const updateReportStatus = async (reportId, status) => {
        try {
            await axios.put(`${API_URL}/api/reports/admin/${reportId}?status=${status}`, {}, { withCredentials: true });
            toast.success(`Report marked ${status}`);
            await fetchReports();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update report');
        }
    };

    const hideContent = async (reportId) => {
        try {
            await axios.delete(`${API_URL}/api/reports/admin/${reportId}/hide-content`, { withCredentials: true });
            toast.success('Content hidden');
            await fetchReports();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to hide content');
        }
    };

    const renderTarget = (report) => {
        if (report.report_type === 'project' && report.reported_project) {
            return (
                <Link to={`/project/${report.reported_project.id}`} className="hover:text-primary transition-colors">
                    <div className="font-bold">{report.reported_project.title}</div>
                    <div className="text-sm text-text-secondary line-clamp-2">{report.reported_project.description}</div>
                </Link>
            );
        }

        if (report.report_type === 'comment' && report.reported_comment) {
            return (
                <Link to={`/project/${report.reported_comment.project_id}`} className="hover:text-primary transition-colors">
                    <div className="font-bold">Comment on project</div>
                    <div className="text-sm text-text-secondary line-clamp-2">{report.reported_comment.content}</div>
                </Link>
            );
        }

        if (report.report_type === 'user' && report.reported_user) {
            return (
                <Link to={`/profile/${report.reported_user.id}`} className="hover:text-primary transition-colors flex items-center gap-3">
                    {report.reported_user.profile_picture_url ? (
                        <img src={report.reported_user.profile_picture_url} alt={report.reported_user.username} className="w-10 h-10 border-2 border-black object-cover" />
                    ) : (
                        <div className="w-10 h-10 bg-black text-white border-2 border-black flex items-center justify-center font-bold">
                            {report.reported_user.username?.[0]?.toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="font-bold">@{report.reported_user.username}</div>
                        <div className="text-sm text-text-secondary">Reported user</div>
                    </div>
                </Link>
            );
        }

        return <div className="text-sm text-text-secondary">System report or missing target details</div>;
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="w-8 h-8 text-primary" strokeWidth={2.5} />
                        <h1 className="font-heading font-black text-4xl tracking-tighter">ADMIN REPORTS</h1>
                    </div>
                    <p className="text-text-secondary text-lg">Review reported users, comments, and projects.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-text-secondary" />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-brutalist py-2 text-sm">
                            <option value="">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="under_review">Under review</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-text-secondary" />
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-brutalist py-2 text-sm">
                            <option value="">All report types</option>
                            <option value="project">Project</option>
                            <option value="comment">Comment</option>
                            <option value="user">User</option>
                            <option value="system">System</option>
                        </select>
                    </div>

                    <button onClick={fetchReports} className="btn-secondary-brutalist py-2 px-4 flex items-center gap-2" disabled={isRefreshing}>
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="card-brutalist p-12 text-center">
                        <ShieldAlert className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-text-secondary text-lg">No reports match the current filters</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reports.map((report) => (
                            <section key={report._id} className="card-brutalist p-6">
                                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="badge-idea">{report.report_type}</span>
                                            <span className={report.status === 'resolved' ? 'badge-completed' : report.status === 'under_review' ? 'badge-in-progress' : 'badge-idea'}>
                                                {report.status}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-1">Reason</p>
                                            <p className="font-semibold">{report.reason}</p>
                                            {report.description && <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{report.description}</p>}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-2">Reported By</p>
                                                <div className="flex items-center gap-3">
                                                    {report.reported_by_user?.profile_picture_url ? (
                                                        <img src={report.reported_by_user.profile_picture_url} alt={report.reported_by_user.username} className="w-10 h-10 border-2 border-black object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-black text-white border-2 border-black flex items-center justify-center font-bold">
                                                            {report.reported_by_user?.username?.[0]?.toUpperCase() || '!'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold">@{report.reported_by_user?.username || 'Unknown'}</p>
                                                        <p className="text-xs text-text-secondary">{new Date(report.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs uppercase tracking-widest font-bold text-text-secondary mb-2">Target</p>
                                                {renderTarget(report)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-72 space-y-3">
                                        <button onClick={() => updateReportStatus(report._id, 'under_review')} className="btn-secondary-brutalist w-full flex items-center justify-center gap-2">
                                            <MessageSquare className="w-4 h-4" /> Mark Under Review
                                        </button>
                                        <button onClick={() => updateReportStatus(report._id, 'resolved')} className="btn-primary-brutalist w-full flex items-center justify-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" /> Resolve
                                        </button>
                                        <button onClick={() => updateReportStatus(report._id, 'dismissed')} className="btn-secondary-brutalist w-full flex items-center justify-center gap-2">
                                            <XCircle className="w-4 h-4" /> Dismiss
                                        </button>
                                        {(report.report_type === 'project' || report.report_type === 'comment') && (
                                            <button onClick={() => hideContent(report._id)} className="btn-secondary-brutalist w-full flex items-center justify-center gap-2 text-error">
                                                <EyeOff className="w-4 h-4" /> Hide Content
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminReports;