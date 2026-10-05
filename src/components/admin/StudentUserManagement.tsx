'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  ShieldCheck,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { fetchAdminUsers, updateUserRole } from '@/lib/services/adminService';

interface StudentUserManagementProps {
  currentAdminUid?: string;
}

export default function StudentUserManagement({ currentAdminUid }: StudentUserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load user directory.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchAdminUsers()
      .then((data) => {
        if (active) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to load user directory.';
          setError(msg);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    setUpdatingUid(targetUid);
    setError(null);
    setSuccessMsg(null);

    try {
      await updateUserRole(targetUid, newRole);
      setSuccessMsg(`Role updated to ${newRole}.`);
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, role: newRole } : u))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user role.';
      setError(msg);
    } finally {
      setUpdatingUid(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.studentId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-[#101621] border border-[#263244] rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>User & Student Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151D2B] border border-[#263244] text-slate-400">
              {filteredUsers.length} accounts
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Minimal authorized student records and privilege management
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, student ID..."
              className="bg-[#151D2B] border border-[#263244] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF] w-52"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by Role"
            className="bg-[#151D2B] border border-[#263244] rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#4F8CFF]"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="admin">Administrators</option>
          </select>

          <button
            onClick={loadUsers}
            aria-label="Refresh Directory"
            className="p-1.5 bg-[#151D2B] border border-[#263244] rounded-xl text-slate-400 hover:text-white hover:bg-[#263244] transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-[#263244]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#151D2B] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#263244]">
            <tr>
              <th className="px-4 py-3">Student ID</th>
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Email Address</th>
              <th className="px-4 py-3">Current Role</th>
              <th className="px-4 py-3">Joined Date</th>
              <th className="px-4 py-3 text-right">Role Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244]/60 bg-[#101621]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#4F8CFF]" />
                    <span>Loading student directory...</span>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-sm font-medium">No users found</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isSelf = user.uid === currentAdminUid;
                const isUpdating = updatingUid === user.uid;

                return (
                  <tr key={user.uid} className="hover:bg-[#151D2B]/50 transition">
                    {/* Student ID */}
                    <td className="px-4 py-3 font-mono font-semibold text-[#38D9C5]">
                      {user.studentId || 'N/A'}
                    </td>

                    {/* Display Name */}
                    <td className="px-4 py-3 font-medium text-white">
                      {user.displayName}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {user.email}
                    </td>

                    {/* Role Badge */}
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          Administrator
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          <GraduationCap className="w-3 h-3" />
                          Student
                        </span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-[11px] text-slate-500 italic">Self (Active Session)</span>
                      ) : (
                        <button
                          onClick={() =>
                            handleRoleChange(user.uid, user.role === 'admin' ? 'student' : 'admin')
                          }
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#151D2B] border border-[#263244] text-slate-300 hover:text-white hover:bg-[#263244] transition disabled:opacity-50"
                        >
                          {isUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                          {user.role === 'admin' ? 'Demote to Student' : 'Promote to Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
