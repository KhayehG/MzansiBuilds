import React, { useState } from 'react';
import axios from 'axios';
import { Flag, X } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../lib/api';

const REASONS = [
    { value: 'spam', label: 'Spam or advertising' },
    { value: 'abuse', label: 'Harassment or abuse' },
    { value: 'fake_content', label: 'Fake or misleading content' },
    { value: 'safety', label: 'Safety issue' },
    { value: 'plagiarism', label: 'Plagiarism' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
];

/**
 * ReportModal – reusable report dialog.
 *
 * Props:
 *   isOpen          – bool
 *   onClose         – fn
 *   reportType      – "project" | "user" | "comment" | "system"
 *   reportedItemId  – string | null  (project_id or comment_id)
 *   reportedUserId  – string | null  (user being reported)
 *   contextLabel    – string shown in heading, e.g. "this project"
 */
const ReportModal = ({
    isOpen,
    onClose,
    reportType,
    reportedItemId = null,
    reportedUserId = null,
    contextLabel = 'this content',
}) => {
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) {
            toast.error('Please select a reason');
            return;
        }

        setIsSubmitting(true);
        try {
            const params = new URLSearchParams({
                report_type: reportType,
                reason,
                description,
            });
            if (reportedItemId) params.append('reported_item_id', reportedItemId);
            if (reportedUserId) params.append('reported_user_id', reportedUserId);

            await axios.post(
                `${API_URL}/api/reports?${params.toString()}`,
                {},
                { withCredentials: true }
            );

            toast.success('Report submitted. Thank you for helping keep MzansiBuilds safe.');
            setReason('');
            setDescription('');
            onClose();
        } catch (error) {
            const detail = error.response?.data?.detail;
            if (error.response?.status === 400 && detail?.includes('already reported')) {
                toast.info('You have already submitted a report for this content.');
                onClose();
            } else {
                toast.error(detail || 'Failed to submit report');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div className="relative z-10 bg-background border-2 border-black w-full max-w-md mx-4 shadow-[4px_4px_0_black]">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-black px-6 py-4">
                    <h2 className="font-heading font-black text-xl uppercase tracking-tight flex items-center gap-2">
                        <Flag className="w-5 h-5" />
                        Report {contextLabel}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-secondary hover:text-black transition-colors"
                        aria-label="Close report dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                            Reason <span className="text-error">*</span>
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="input-brutalist w-full"
                            required
                        >
                            <option value="">— Select a reason —</option>
                            {REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-widest font-bold mb-2">
                            Additional details <span className="text-text-secondary font-normal normal-case">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input-brutalist w-full min-h-[90px]"
                            placeholder="Describe the issue in more detail…"
                            maxLength={1000}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason}
                            className="btn-primary-brutalist flex-1 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting…' : 'Submit Report'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary-brutalist flex-1"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReportModal;
