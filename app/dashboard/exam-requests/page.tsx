"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";

interface ExamRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  branchId: string;
  branchName: string;
  requestedClass: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  approvedAt?: Date;
  examDate?: Date;
  examClass?: string;
}

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

export default function AdminExamRequests() {
  // ----- PASSWORD PROTECTION -----
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const ADMIN_PASSWORD = "1234"; // Change this to your desired password

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // ----- EXISTING STATE -----
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Approve modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExamRequest | null>(null);
  const [examDate, setExamDate] = useState("");
  const [examClass, setExamClass] = useState("");

  // Print modal for approved exams
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStartDate, setPrintStartDate] = useState("");
  const [printEndDate, setPrintEndDate] = useState("");
  const [filteredApprovedExams, setFilteredApprovedExams] = useState<ExamRequest[]>([]);

  // ----- EXISTING useEffect -----
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch("/api/branches/list");
        const data = await res.json();
        if (data.branches) setBranches(data.branches);
      } catch (err) {
        console.error("Failed to fetch branches");
      }
    };
    fetchBranches();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, "examRequests"), orderBy("createdAt", "desc"));
      if (selectedBranch !== "all") {
        q = query(collection(db, "examRequests"), where("branchId", "==", selectedBranch), orderBy("createdAt", "desc"));
      }
      const snapshot = await getDocs(q);
      const requestsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) || new Date(),
        approvedAt: toDate(doc.data().approvedAt),
        examDate: toDate(doc.data().examDate),
      })) as ExamRequest[];
      setRequests(requestsList);
    } catch (err) {
      console.error("Failed to fetch exam requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [selectedBranch, isAuthenticated]);

  // ----- EXISTING HANDLERS (unchanged) -----
  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!examDate) {
      alert("Please select an exam date.");
      return;
    }
    if (!examClass) {
      alert("Please select exam class.");
      return;
    }
    setActionLoading(selectedRequest.id);
    try {
      const requestRef = doc(db, "examRequests", selectedRequest.id);
      await updateDoc(requestRef, {
        status: "approved",
        approvedAt: Timestamp.now(),
        examDate: Timestamp.fromDate(new Date(examDate)),
        examClass: examClass,
      });
      await fetchRequests();
      setShowApproveModal(false);
      setSelectedRequest(null);
      setExamDate("");
      setExamClass("");
    } catch (err) {
      alert("Failed to approve request.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm("Reject this exam request?")) return;
    setActionLoading(requestId);
    try {
      const requestRef = doc(db, "examRequests", requestId);
      await updateDoc(requestRef, {
        status: "rejected",
        approvedAt: Timestamp.now(),
      });
      await fetchRequests();
    } catch (err) {
      alert("Failed to reject request.");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">Pending</span>;
      case "approved":
        return <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">Approved</span>;
      case "rejected":
        return <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-semibold">Rejected</span>;
      default:
        return null;
    }
  };

  const filterApprovedByDate = () => {
    if (!printStartDate || !printEndDate) {
      alert("Please select both start and end dates.");
      return;
    }
    const start = new Date(printStartDate);
    const end = new Date(printEndDate);
    end.setHours(23, 59, 59, 999);

    const approved = requests.filter(req => {
      if (req.status !== "approved") return false;
      if (!req.examDate) return false;
      const examDateObj = new Date(req.examDate);
      return examDateObj >= start && examDateObj <= end;
    });
    approved.sort((a, b) => (a.examDate!.getTime() - b.examDate!.getTime()));
    setFilteredApprovedExams(approved);
  };

  const printApprovedList = () => {
    if (filteredApprovedExams.length === 0) {
      alert("No approved exams in the selected date range.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const startFormatted = new Date(printStartDate).toLocaleDateString();
    const endFormatted = new Date(printEndDate).toLocaleDateString();
    const currentDate = new Date().toLocaleDateString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Approved Exams Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { width: 80px; height: auto; margin-bottom: 10px; }
            h2 { margin: 5px 0; color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 12px; }
            th { background-color: #f3f4f6; font-weight: 600; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; }
            @media print { button { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/logopds.jpg" alt="Logo" class="logo" onerror="this.style.display='none'" />
            <h2>Harmflow Driving School</h2>
            <h3>Approved Exam List</h3>
            <div>Period: ${startFormatted} to ${endFormatted}<br>Generated: ${currentDate}</div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Student Name</th><th>ID Number</th><th>Branch</th><th>Exam Class</th><th>Exam Date</th></tr>
            </thead>
            <tbody>
              ${filteredApprovedExams.map((exam, i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${exam.studentName}</td>
                  <td>${exam.studentIdNumber || "N/A"}</td>
                  <td>${exam.branchName}</td>
                  <td>${exam.examClass || exam.requestedClass}</td>
                  <td>${exam.examDate ? exam.examDate.toLocaleDateString() : "N/A"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">System generated report – For admin use only.</div>
          <div style="text-align:center; margin-top:20px;">
            <button onclick="window.print();window.close();">Print Report</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ----- RENDER PASSWORD FORM IF NOT AUTHENTICATED -----
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/30">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Admin Access
            </h2>
            <p className="text-slate-500 text-sm mt-1">Enter password to continue</p>
          </div>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Admin password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800 text-base"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <span>❌</span> {passwordError}
              </p>
            )}
            <button
              type="submit"
              className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----- MAIN ADMIN INTERFACE (COMPLETELY UNCHANGED) -----
  return (
    <div className="p-6 max-w-7xl mx-auto bg-emerald-400">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📝 Exam Requests from Branches</h1>
        <p className="text-gray-600">Approve or reject NTSA exam requests. Set exam date and class for approved requests.</p>
      </div>

      {/* Filter and extra buttons */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="font-medium text-sm">Filter by Branch:</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-amber-700"
          >
            <option value="all">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <button
            onClick={fetchRequests}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
        <button
          onClick={() => setShowPrintModal(true)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
        >
          📅 Print Approved List
        </button>
      </div>

      {/* Main requests table (unchanged) */}
      {loading ? (
        <div className="text-center py-10">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No exam requests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-green-900 border border-gray-200 shadow-sm rounded-lg">
            <thead className="bg-orange-400">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">ID Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Requested Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Note</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Request Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-500">
                  <td className="px-4 py-3 text-sm">{req.branchName}</td>
                  <td className="px-4 py-3 text-sm font-medium">{req.studentName}</td>
                  <td className="px-4 py-3 text-sm">{req.studentIdNumber || "N/A"}</td>
                  <td className="px-4 py-3 text-sm">{req.requestedClass}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate" title={req.note}>{req.note}</td>
                  <td className="px-4 py-3 text-sm">{req.createdAt.toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(req.status)}</td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    {req.status === "pending" && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setExamClass(req.requestedClass);
                            setShowApproveModal(true);
                          }}
                          disabled={actionLoading === req.id}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {req.status === "approved" && req.examDate && (
                      <span className="text-xs text-gray-500">
                        Exam: {req.examDate.toLocaleDateString()} ({req.examClass || req.requestedClass})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Modal (unchanged) */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-emerald-950 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Approve Exam Request</h3>
            <p className="mb-2">
              <strong>Student:</strong> {selectedRequest.studentName}<br />
              <strong>Branch:</strong> {selectedRequest.branchName}<br />
              <strong>Requested Class:</strong> {selectedRequest.requestedClass}
            </p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Exam Date *</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Exam Class *</label>
              <select
                value={examClass}
                onChange={(e) => setExamClass(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                required
              >
                <option value="">Select class...</option>
                <option value="B1">B1/B2 (Light Vehicle)</option>
                <option value="B2">B2 (Light Vehicle Auto)</option>
                <option value="C1">C1 (Light Truck)</option>
                <option value="C">C (Truck)</option>
                <option value="D1">D1 (PSV)</option>
                <option value="A1">A1 (Motorcycle)</option>
                <option value="A2">A2 (Motorcycle)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">You can override the requested class if needed.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedRequest(null);
                  setExamDate("");
                  setExamClass("");
                }}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading === selectedRequest.id}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Approved Modal (NEW) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-300 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-yellow-300 text-white p-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-lg font-bold">🖨️ Print Approved Exams</h2>
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setFilteredApprovedExams([]);
                  setPrintStartDate("");
                  setPrintEndDate("");
                }}
                className="text-red-600 hover:text-gray-500 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-4 items-end mb-6">
                <div>
                  <label className="block text-sm font-medium rounded-lg px-4 bg-amber-400 text-white mb-1">Start Date</label>
                  <input
                    type="date"
                    value={printStartDate}
                    onChange={(e) => setPrintStartDate(e.target.value)}
                    className="border rounded-lg px-3 text-amber-800 py-2 text-sm focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium px-4 rounded-lg bg-amber-500 text-white mb-1">End Date</label>
                  <input
                    type="date"
                    value={printEndDate}
                    onChange={(e) => setPrintEndDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-amber-800 text-sm focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={filterApprovedByDate}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Show
                </button>
              </div>

              {filteredApprovedExams.length > 0 && (
                <>
                  <div className="border rounded-lg overflow-hidden bg-green-800 mb-4">
                    <table className="min-w-full divide-y divide-gray-700 text-sm">
                      <thead className="bg-green-500">
                        <tr>
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Student</th>
                          <th className="px-4 py-2 text-left">ID Number</th>
                          <th className="px-4 py-2 text-left">Branch</th>
                          <th className="px-4 py-2 text-left">Exam Class</th>
                          <th className="px-4 py-2 text-left">Exam Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-500">
                        {filteredApprovedExams.map((exam, i) => (
                          <tr key={exam.id} className="hover:bg-gray-500">
                            <td className="px-4 py-2">{i + 1}</td>
                            <td className="px-4 py-2 font-medium">{exam.studentName}</td>
                            <td className="px-4 py-2">{exam.studentIdNumber || "N/A"}</td>
                            <td className="px-4 py-2">{exam.branchName}</td>
                            <td className="px-4 py-2">{exam.examClass || exam.requestedClass}</td>
                            <td className="px-4 py-2">{exam.examDate ? exam.examDate.toLocaleDateString() : "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={printApprovedList}
                      className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                    >
                      🖨️ Print Report
                    </button>
                  </div>
                </>
              )}

              {filteredApprovedExams.length === 0 && printStartDate && printEndDate && (
                <div className="text-center py-8 text-gray-500">
                  No approved exams found in the selected date range.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}