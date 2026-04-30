"use client";

import { useEffect, useState } from "react";

interface TransferRequest {
  id: string;
  studentId: string;
  fromBranchId: string;
  toBranchId: string;
  reason: string;
  status: string;
  requestedAt: any; // Firestore timestamp
  processedAt?: any; // optional approval timestamp
  studentName?: string;
  studentAccountNumber?: string;
}

export default function AdminTransfersPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBranches();
    fetchRequests();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches/list");
      const data = await res.json();
      const names: Record<string, string> = {};
      data.branches.forEach((b: any) => {
        names[b.id] = b.name;
      });
      setBranchNames(names);
    } catch (err) {
      console.error("Failed to load branch names", err);
    }
  };

  // Helper to convert Firestore timestamp to Date
  const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    // Firestore timestamp serializer gives { seconds, nanoseconds } or { _seconds, _nanoseconds }
    let seconds = timestamp.seconds || timestamp._seconds;
    if (seconds) return new Date(seconds * 1000);
    return null;
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/transfer/list");
      const data = await res.json();
      const requestsWithDetails = await Promise.all(
        data.requests.map(async (req: TransferRequest) => {
          // Fetch student info
          try {
            const studentRes = await fetch(`/api/students/get?branchId=${req.fromBranchId}&studentId=${req.studentId}`);
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              return {
                ...req,
                studentName: studentData.name || "Unknown",
                studentAccountNumber: studentData.accountNumber || "N/A",
              };
            }
          } catch (err) {
            console.error("Failed to fetch student", err);
          }
          return { ...req, studentName: "Unknown", studentAccountNumber: "N/A" };
        })
      );
      setRequests(requestsWithDetails);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessing(requestId);
    try {
      const res = await fetch("/api/transfer/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        await fetchRequests();
      } else {
        alert("Action failed");
      }
    } catch (err) {
      alert("Error");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="p-4 text-amber-950 text-sm sm:text-base">Loading transfer requests...</div>;

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto text-amber-950">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">Student Transfer Requests</h1>

      {pendingRequests.length === 0 && processedRequests.length === 0 && (
        <p className="text-sm sm:text-base">No transfer requests found.</p>
      )}

      {pendingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 text-amber-700">Pending</h2>
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3 sm:p-4 shadow-sm bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm sm:text-base">
                  <div>
                    <strong>Student:</strong> {req.studentName}<br />
                    <span className="text-xs text-gray-500">Account: {req.studentAccountNumber}</span>
                  </div>
                  <div><strong>Requested on:</strong> {toDate(req.requestedAt)?.toLocaleString() || "Unknown date"}</div>
                  <div><strong>From Branch:</strong> {branchNames[req.fromBranchId] || req.fromBranchId}</div>
                  <div><strong>To Branch:</strong> {branchNames[req.toBranchId] || req.toBranchId}</div>
                </div>
                <div className="mt-2 text-sm sm:text-base"><strong>Reason:</strong> <span className="italic">{req.reason}</span></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAction(req.id, "approve")}
                    disabled={processing === req.id}
                    className="bg-green-600 text-white px-3 sm:px-4 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing === req.id ? "Processing..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => handleAction(req.id, "reject")}
                    disabled={processing === req.id}
                    className="bg-red-600 text-white px-3 sm:px-4 py-1 rounded text-sm hover:bg-red-700"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processedRequests.length > 0 && (
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 text-gray-600">Processed</h2>
          <div className="space-y-3">
            {processedRequests.map((req) => (
              <div key={req.id} className="border rounded p-3 sm:p-4 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:justify-between text-sm sm:text-base">
                  <div>
                    <strong>Student:</strong> {req.studentName}<br />
                    <span className="text-xs text-gray-500">Account: {req.studentAccountNumber}</span>
                  </div>
                  <div className="mt-1 sm:mt-0">
                    <strong>Status:</strong>{' '}
                    <span className={req.status === "approved" ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                      {req.status === "approved" ? "Approved ✅" : "Rejected ❌"}
                    </span>
                  </div>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  From: {branchNames[req.fromBranchId] || req.fromBranchId} → To: {branchNames[req.toBranchId] || req.toBranchId}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  <strong>Request submitted:</strong> {toDate(req.requestedAt)?.toLocaleString() || "Unknown"}
                  {req.processedAt && ` • Processed on: ${toDate(req.processedAt)?.toLocaleString()}`}
                </div>
                <div className="text-xs sm:text-sm text-gray-500">Reason: {req.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}