"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// Mock data – replace with your actual API calls
const branches = [
  { id: 1, name: "Main Branch", studentCount: 45 },
  { id: 2, name: "North Branch", studentCount: 32 },
  { id: 3, name: "South Branch", studentCount: 28 },
  { id: 4, name: "East Branch", studentCount: 19 },
];

export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showBranchSelection, setShowBranchSelection] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<{
    id: number;
    name: string;
    studentCount: number;
  } | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);

  // Reset branch selection when navigating away
  const resetBranchSelection = () => {
    setShowBranchSelection(false);
    setSelectedBranch(null);
    setStudentCount(null);
  };

  const handleStudentClick = () => {
    resetBranchSelection(); // Clear any previous selection
    setShowBranchSelection(true);
  };

  const handleBranchSelect = (branch: (typeof branches)[0]) => {
    setSelectedBranch(branch);
    setStudentCount(branch.studentCount);
    // Optionally fetch from API:
    // fetch(`/api/students?branchId=${branch.id}`).then(...).then(setStudentCount)
  };

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-gray-50">
      {/* Modern sidebar – clean, light, with subtle shadow */}
      <nav className="w-38 bg-white shadow-lg z-10 flex flex-col border-r border-gray-300">
        <div className="p-6 border-b border-gray-900">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Control Panel</p>
        </div>

        <ul className="flex-1 py-3 space-y-1">
          <li>
            <Link
              href="/dashboard/admin/branch-created"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">🏠</span>
              <span className="font-medium">Home</span>
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/set-admin-claims"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">👑</span>
              <span className="font-medium">Admin</span>
            </Link>
          </li>
            <li>
            <Link
              href="/dashboard/adminBranch"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">👑</span>
              <span className="font-medium">Admin2</span>
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/admin/branch"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">🏢</span>
              <span className="font-medium">Our Branches</span>
            </Link>
          </li>

           <li>
            <Link
              href="/dashboard/admin/AdminAccess"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">🏢</span>
              <span className="font-medium">Admin Access</span>
            </Link>
          </li>
          <li>
            <button
              onClick={handleStudentClick}
              className="flex items-center w-full px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">🎓</span>
              <span className="font-medium">Branch Label</span>
            </button>
          </li>
          <li>
            <Link
              href="/dashboard/admin/add-branch"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">➕</span>
              <span className="font-medium">Add Branch</span>
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/utils/sms"
              onClick={resetBranchSelection}
              className="flex items-center px-6 py-3 text-gray-700 hover:text-gray-600 hover:bg-indigo-700 transition-all duration-200 rounded-lg mx-3 group"
            >
              <span className="mr-3 text-xl">💬</span>
              <span className="font-medium">SMS</span>
            </Link>
          </li>
        </ul>

        <div className="p-6 border-t border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm">
              A
            </div>
            <div className="flex-1">
              <p className="text-gray-800 text-sm font-medium">Admin User</p>
              <p className="text-gray-500 text-xs">Administrator</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600 transition">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main content – clean white card */}
      <main className="flex-1 p-2 z-10 overflow-auto">
        <div className="bg-[#980002] rounded-2xl shadow-sm border border-gray-300 p-6">
          {showBranchSelection ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Select a Branch
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSelect(branch)}
                    className="bg-gray-50 hover:bg-indigo-50 transition-all p-5 rounded-xl text-left border border-gray-200 hover:border-indigo-200 shadow-sm hover:shadow"
                  >
                    <div className="text-gray-800 font-semibold text-lg">
                      {branch.name}
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      Click to view student count
                    </div>
                  </button>
                ))}
              </div>
              {selectedBranch && studentCount !== null && (
                <div className="mt-6 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-gray-800 text-base">
                    <span className="font-semibold">{selectedBranch.name}</span>{" "}
                    has <span className="font-bold text-indigo-600">{studentCount}</span>{" "}
                    students.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedBranch(null);
                      setStudentCount(null);
                    }}
                    className="mt-3 px-4 py-2 bg-white hover:bg-gray-100 rounded-lg text-gray-700 text-sm transition border border-gray-200"
                  >
                    Clear selection
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowBranchSelection(false)}
                className="mt-4 px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm transition font-medium"
              >
                ← Back to dashboard
              </button>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}