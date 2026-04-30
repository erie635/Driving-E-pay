"use client";

import { useEffect, useState } from "react";

interface BranchStats {
  id: string;
  name: string;
  revenue: number;
  outstanding: number;
  studentCount: number;
}

interface RecentStudent {
  id: string;
  branchName: string;
  name: string;
  accountNumber: string;
  phone: string;
  enrolledAt: Date;
}

// Password – change this to any value you want
const REQUIRED_PASSWORD = "1234";

export default function CompanyDashboard() {
  // --- Password protection state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // --- Existing state ---
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<BranchStats[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentStudent[]>([]);
  const [collectionsByMonth, setCollectionsByMonth] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedBranch, setSelectedBranch] = useState<BranchStats | null>(null);
  const [branchDetails, setBranchDetails] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // --- All Students modal state ---
  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [allStudentsList, setAllStudentsList] = useState<any[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);

  // --- Password handler ---
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // --- Existing fetchStats logic ---
  const fetchStats = async (start?: string, end?: string) => {
    setLoading(true);
    let url = "/api/admin/stats";
    if (start && end) url += `?startDate=${start}&endDate=${end}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setStats(data);
      setBranches(data.branchStats || []);
      setRecentEnrollments(data.recentEnrollments || []);
      setCollectionsByMonth(data.collectionsByMonth || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // --- Fetch all students from API ---
  const fetchAllStudents = async () => {
    setLoadingAllStudents(true);
    try {
      const res = await fetch("/api/admin/all-students");
      const data = await res.json();
      setAllStudentsList(data.students || []);
      setShowAllStudentsModal(true);
    } catch (err) {
      console.error("Failed to load all students", err);
      alert("Could not load all students");
    } finally {
      setLoadingAllStudents(false);
    }
  };

  const handleDateFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats(dateRange.start, dateRange.end);
  };

  const resetFilter = () => {
    setDateRange({ start: "", end: "" });
    fetchStats();
  };

  const viewBranchDetails = async (branch: BranchStats) => {
    setSelectedBranch(branch);
    try {
      const res = await fetch(`/api/branches/details?branchId=${branch.id}`);
      const data = await res.json();
      setBranchDetails(data);
      setShowModal(true);
    } catch (err) {
      alert("Could not load branch details");
    }
  };

  const formatKsh = (amount: number) => `Ksh ${amount.toLocaleString()}`;
  const monthlyEntries = Object.entries(collectionsByMonth).sort((a, b) => a[0].localeCompare(b[0]));

  // --- If not authenticated, show password prompt ---
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md">
          <img src="/logopds.jpg" alt="Logo" className="mx-auto mb-4 w-20 h-20 sm:w-24 sm:h-24 object-contain" />
          <h2 className="text-xl sm:text-2xl text-black font-bold mb-4 text-center">Company Dashboard Access</h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full text-black p-2 border rounded mb-4"
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Original dashboard (with added button) ---
  if (loading) return <div className="p-6 text-center text-red-950">Loading company dashboard...</div>;
  if (!stats) return <div className="p-6 text-center text-red-600">Failed to load data.</div>;

  return (
    <>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Flex row: Title + View All Students button */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-950">🏢 Company Dashboard</h1>
          <button
            onClick={fetchAllStudents}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
          >
            📋 View All Students
          </button>
        </div>

        {/* KPI Cards (unchanged) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-300 rounded-lg shadow p-4 border-l-8 border-green-500">
            <p className="text-sm text-gray-800">Total Revenue (All Branches)</p>
            <p className="text-2xl font-bold text-green-700">{formatKsh(stats.totalRevenue || 0)}</p>
          </div>
          <div className="bg-sky-400 rounded-lg shadow p-4 border-l-8 border-orange-500">
            <p className="text-sm text-gray-800">Total Outstanding</p>
            <p className="text-2xl font-bold text-orange-700">{formatKsh(stats.totalOutstanding || 0)}</p>
          </div>
          <div className="bg-emerald-400 rounded-lg shadow p-4 border-l-8 border-blue-500">
            <p className="text-sm text-gray-800">Total Students</p>
            <p className="text-2xl font-bold text-blue-700">{stats.totalStudents || 0}</p>
          </div>
          <div className="bg-yellow-300 rounded-lg shadow p-4 border-l-8 border-purple-900">
            <p className="text-sm text-gray-800">Active Branches</p>
            <p className="text-2xl font-bold text-purple-700">{stats.totalBranches || 0}</p>
          </div>
        </div>

        {/* Date Range Filter (unchanged) */}
        <div className="bg-gray-100 rounded-lg p-4 mb-8 text-amber-950">
          <h3 className="font-semibold mb-2">📅 Filter Revenue by Date Range</h3>
          <form onSubmit={handleDateFilter} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-950">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="border rounded p-2 text-sm"
              />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Apply Filter
            </button>
            <button type="button" onClick={resetFilter} className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Reset
            </button>
          </form>
        </div>

        {/* Monthly Collection Summary (unchanged) */}
        <div className="bg-white rounded-lg shadow p-4 mb-8 text-amber-950">
          <h3 className="text-lg font-semibold mb-3">📆 Monthly Collections</h3>
          {monthlyEntries.length === 0 ? (
            <p className="text-gray-800">No payment data available for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-300">
                  <tr>
                    <th className="p-2 border">Month</th>
                    <th className="p-2 border">Amount Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyEntries.map(([month, amount]) => (
                    <tr key={month}>
                      <td className="p-2 border">{month}</td>
                      <td className="p-2 border text-right">{formatKsh(amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-amber-950">
                    <td className="p-2 border">Total (filtered)</td>
                    <td className="p-2 border text-right">{formatKsh(monthlyEntries.reduce((sum, [, amt]) => sum + amt, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Branches Overview (unchanged) */}
        <div className="bg-white rounded-lg shadow p-4 mb-8 text-amber-950">
          <h3 className="text-lg font-semibold mb-3">🏫 Branches Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <div key={branch.id} className="border rounded p-3 hover:shadow-md transition">
                <div className="font-bold text-md">{branch.name}</div>
                <div className="text-sm text-gray-600">Students: {branch.studentCount}</div>
                <div className="text-sm text-green-600">Revenue: {formatKsh(branch.revenue)}</div>
                <div className="text-sm text-orange-600">Outstanding: {formatKsh(branch.outstanding)}</div>
                <button
                  onClick={() => viewBranchDetails(branch)}
                  className="mt-2 w-full bg-indigo-100 text-indigo-800 py-1 rounded text-xs hover:bg-indigo-200"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Enrollments (unchanged) */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-amber-950">🆕 Recent Enrollments (Latest 20)</h3>
          </div>
          {recentEnrollments.length === 0 ? (
            <p className="text-gray-700">No recent enrollments.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm bg-emerald-950">
                <thead className="bg-gray-100 text-amber-950">
                  <tr>
                    <th className="p-2 border">Branch</th>
                    <th className="p-2 border">Student Name</th>
                    <th className="p-2 border">Admission No</th>
                    <th className="p-2 border">Phone</th>
                    <th className="p-2 border">Enrolled Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEnrollments.map((student) => (
                    <tr key={student.id}>
                      <td className="p-2 border">{student.branchName}</td>
                      <td className="p-2 border">{student.name}</td>
                      <td className="p-2 border">{student.accountNumber}</td>
                      <td className="p-2 border">{student.phone}</td>
                      <td className="p-2 border">
                        {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Branch Details (unchanged) */}
      {showModal && selectedBranch && branchDetails && (
        <div className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-green-950 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-amber-300 text-amber-950 border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{selectedBranch.name} – Full Details</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl leading-none hover:text-red-600">&times;</button>
            </div>
            <div className="p-4">
              <p className="mb-2"><strong>Total Students:</strong> {branchDetails.students?.length || 0}</p>
              <p className="mb-2"><strong>Total Payments Received (this branch):</strong> {formatKsh(branchDetails.totalPayments || 0)}</p>
              <h3 className="font-semibold mt-4 mb-2">Student List</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-amber-300 text-amber-950">
                    <tr>
                      <th className="p-2 border">Name</th>
                      <th className="p-2 border">Admission No</th>
                      <th className="p-2 border">Phone</th>
                      <th className="p-2 border">Total Fee</th>
                      <th className="p-2 border">Paid</th>
                      <th className="p-2 border">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchDetails.students?.map((s: any) => (
                      <tr key={s.id}>
                        <td className="p-2 border">{s.name}</td>
                        <td className="p-2 border">{s.accountNumber}</td>
                        <td className="p-2 border">{s.phone}</td>
                        <td className="p-2 border text-right">{formatKsh(s.totalFee)}</td>
                        <td className="p-2 border text-right">{formatKsh(s.feePaid)}</td>
                        <td className="p-2 border text-right font-bold text-orange-700">{formatKsh(s.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Modal for All Students (white background, well visible) */}
      {showAllStudentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-indigo-600 text-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">📚</h2>
              <button
                onClick={() => setShowAllStudentsModal(false)}
                className="text-2xl leading-none hover:text-red-300"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {loadingAllStudents ? (
                <p className="text-center py-4">Loading all students...</p>
              ) : allStudentsList.length === 0 ? (
                <p className="text-center text-gray-500">No students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300 text-sm">
                    <thead className="bg-gray-900 sticky top-0">
                      <tr>
                        <th className="p-2 border border-gray-300">#</th>
                        <th className="p-2 border border-gray-300">Branch</th>
                        <th className="p-2 border border-gray-300">Student Name</th>
                        <th className="p-2 border border-gray-300">Admission No</th>
                        <th className="p-2 border border-gray-300">Phone</th>
                        <th className="p-2 border border-gray-300">Enrolled Date</th>
                        <th className="p-2 border border-gray-300">Total Fee (Ksh)</th>
                        <th className="p-2 border border-gray-300">Paid (Ksh)</th>
                        <th className="p-2 border border-gray-300">Balance (Ksh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStudentsList.map((student, idx) => (
                        <tr key={student.id} className="hover:bg-gray-500 text-amber-950">
                          <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                          <td className="p-2 border border-gray-300">{student.branchName}</td>
                          <td className="p-2 border border-gray-300">{student.name}</td>
                          <td className="p-2 border border-gray-300">{student.accountNumber}</td>
                          <td className="p-2 border border-gray-300">{student.phone}</td>
                          <td className="p-2 border border-gray-300">
                            {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="p-2 border border-gray-300 text-right">{student.totalFee.toLocaleString()}</td>
                          <td className="p-2 border border-gray-300 text-right">{student.feePaid.toLocaleString()}</td>
                          <td className="p-2 border border-gray-300 text-right font-bold text-orange-700">{student.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}