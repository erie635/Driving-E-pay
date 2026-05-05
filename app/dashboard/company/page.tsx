"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

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

const REQUIRED_PASSWORD = "1234";

export default function CompanyDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<BranchStats[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentStudent[]>(
    [],
  );
  const [collectionsByMonth, setCollectionsByMonth] = useState<
    Record<string, number>
  >({});
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedBranch, setSelectedBranch] = useState<BranchStats | null>(
    null,
  );
  const [branchDetails, setBranchDetails] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  const [lessonStartDate, setLessonStartDate] = useState("");
  const [lessonEndDate, setLessonEndDate] = useState("");
  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [weeklyEnrollments, setWeeklyEnrollments] = useState<any[]>([]);
  const [loadingWeeklyEnrollments, setLoadingWeeklyEnrollments] =
    useState(false);
  const [weeklyLessonCounts, setWeeklyLessonCounts] = useState<
    Record<string, number>
  >({});

  const [showAllStudentsModal, setShowAllStudentsModal] = useState(false);
  const [allStudentsList, setAllStudentsList] = useState<any[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);

  const [exportedReports, setExportedReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFleetInstructorModal, setShowFleetInstructorModal] =
    useState(false);
  const [fleetData, setFleetData] = useState<{
    instructors: any[];
    vehicles: any[];
  }>({ instructors: [], vehicles: [] });
  const [loadingFleetData, setLoadingFleetData] = useState(false);
  const [showReportsSection, setShowReportsSection] = useState(false);

  // NEW: unread reports state
  const [lastViewedReports, setLastViewedReports] = useState<Date>(new Date());
  const [hasUnreadReports, setHasUnreadReports] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

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

  const fetchAndCleanReports = async () => {
    try {
      const q = query(
        collection(db, "fleetReports"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(q);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const freshReports: any[] = [];

      for (const docSnap of snapshot.docs) {
        const report = { id: docSnap.id, ...docSnap.data() };

        const createdAt = report.createdAt?.toDate
          ? report.createdAt.toDate()
          : new Date(report.createdAt);

        // ✅ Keep only last 24 hours
        if (createdAt >= oneDayAgo) {
          freshReports.push({ ...report, createdAt });
        } else {
          await deleteDoc(doc(db, "fleetReports", docSnap.id));
          console.log(`Deleted expired report: ${docSnap.id}`);
        }
      }

      setExportedReports(freshReports);

      // ✅ unread detection
      const hasNew = freshReports.some(
        (report) => new Date(report.createdAt) > lastViewedReports,
      );
      setHasUnreadReports(hasNew);
    } catch (err) {
      console.error("Failed to load/clean reports", err);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (confirm("Are you sure you want to delete this report permanently?")) {
      try {
        await deleteDoc(doc(db, "fleetReports", reportId));
        setExportedReports((prev) => prev.filter((r) => r.id !== reportId));
        const newLastViewed = lastViewedReports;
        const hasNew = exportedReports.some(
          (r) => r.id !== reportId && new Date(r.createdAt) > newLastViewed,
        );
        setHasUnreadReports(hasNew);
      } catch (err) {
        console.error("Failed to delete report:", err);
        alert("Could not delete report. Please try again.");
      }
    }
  };

  const fetchFleetInstructorData = async () => {
    setLoadingFleetData(true);
    try {
      const instructorSnap = await getDocs(collection(db, "instructors"));
      const instructors = instructorSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const vehicleSnap = await getDocs(collection(db, "vehicles"));
      const vehicles = vehicleSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFleetData({ instructors, vehicles });
      setShowFleetInstructorModal(true);
    } catch (err) {
      alert("Failed to load fleet data");
    } finally {
      setLoadingFleetData(false);
    }
  };

  const printReport = (report: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print.");
      return;
    }
    const headers = report.headers;
    const rows = report.data;
    const rowsHtml = rows
      .map(
        (rowObj: any) => `
      <tr>
        ${headers.map((h: string) => `<td style="border:1px solid #ddd; padding:6px;">${rowObj[h]}</td>`).join("")}
      </tr>
    `,
      )
      .join("");
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Fleet Report</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
        </head>
        <body>
          <h1>Fleet Report</h1>
          <p>Generated: ${new Date(report.createdAt).toLocaleString()}</p>
          <p>Filter: ${report.startDate || "any"} to ${report.endDate || "any"}</p>
          <table>
            <thead><tr>${headers.map((h: string) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <button onclick="window.print()">Print</button>
        </body>
      </html>
    `;
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchStats();
    fetchAndCleanReports();
    setLastViewedReports(new Date());
  }, []);

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

  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  };

  const viewBranchDetails = async (branch: BranchStats) => {
    setSelectedBranch(branch);
    try {
      const res = await fetch(`/api/branches/details?branchId=${branch.id}`);
      const data = await res.json();
      setBranchDetails(data);
      setShowModal(true);
      const { start, end } = getCurrentWeekRange();
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];
      setLessonStartDate(startStr);
      setLessonEndDate(endStr);
      if (data.students && data.students.length > 0) {
        await fetchLessonsForBranch(branch.id, start, end, data.students);
        await fetchEnrollmentsForBranch(branch.id, start, end, data.students);
      } else {
        setLessonsList([]);
        setWeeklyEnrollments([]);
        setWeeklyLessonCounts({});
        alert("No students found in this branch.");
      }
    } catch (err) {
      alert("Could not load branch details");
    }
  };

  const fetchLessonsForBranch = async (
    branchId: string,
    startDate: Date,
    endDate: Date,
    studentsList: any[],
  ) => {
    setLoadingLessons(true);
    console.log(
      `🔍 Fetching lessons for branch ${branchId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );
    console.log(
      `📚 Students in this branch:`,
      studentsList.map((s) => ({ id: s.id, name: s.name })),
    );
    try {
      let allLessons: any[] = [];

      for (const student of studentsList) {
        const studentName = student.name;
        const studentId = student.id;
        const lessonsRef = collection(
          db,
          "branches",
          branchId,
          "students",
          studentId,
          "lessons",
        );
        const lessonsSnap = await getDocs(lessonsRef);
        console.log(
          `  - Student "${studentName}" (${studentId}) has ${lessonsSnap.size} total lessons`,
        );

        lessonsSnap.docs.forEach((lessonDoc) => {
          const lessonData = lessonDoc.data();
          let lessonDate = null;
          if (lessonData.date && typeof lessonData.date.toDate === "function") {
            lessonDate = lessonData.date.toDate();
          } else if (lessonData.date) {
            lessonDate = new Date(lessonData.date);
          }
          if (lessonDate) {
            const isInRange = lessonDate >= startDate && lessonDate <= endDate;
            if (isInRange) {
              allLessons.push({
                id: lessonDoc.id,
                studentName: studentName,
                date: lessonDate,
                type: lessonData.type || "General",
                lessonNumber: lessonData.lessonNumber,
                duration: lessonData.duration || 1,
              });
            }
          } else {
            console.warn(`Lesson ${lessonDoc.id} has no valid date field.`);
          }
        });
      }

      console.log(`✅ Total lessons in date range: ${allLessons.length}`);
      if (allLessons.length > 0) {
        allLessons.sort((a, b) => a.date.getTime() - b.date.getTime());
        setLessonsList(allLessons);
        const dayCounts: Record<string, number> = {
          Mon: 0,
          Tue: 0,
          Wed: 0,
          Thu: 0,
          Fri: 0,
          Sat: 0,
          Sun: 0,
        };
        allLessons.forEach((lesson) => {
          const dayIndex = lesson.date.getDay();
          const dayMap: Record<number, string> = {
            0: "Sun",
            1: "Mon",
            2: "Tue",
            3: "Wed",
            4: "Thu",
            5: "Fri",
            6: "Sat",
          };
          dayCounts[dayMap[dayIndex]]++;
        });
        setWeeklyLessonCounts(dayCounts);
      } else {
        setLessonsList([]);
        setWeeklyLessonCounts({
          Mon: 0,
          Tue: 0,
          Wed: 0,
          Thu: 0,
          Fri: 0,
          Sat: 0,
          Sun: 0,
        });
        alert(
          `No lessons found for the selected period (${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}).`,
        );
      }
    } catch (err) {
      console.error("❌ Error fetching lessons:", err);
      alert("Failed to load lessons. Check console for details.");
    } finally {
      setLoadingLessons(false);
    }
  };

  const fetchEnrollmentsForBranch = async (
    branchId: string,
    startDate: Date,
    endDate: Date,
    studentsList: any[],
  ) => {
    setLoadingWeeklyEnrollments(true);
    try {
      let enrollments = studentsList.filter((student) => {
        let enrolledDate = student.enrolledAt
          ? new Date(student.enrolledAt)
          : null;
        if (!enrolledDate) return false;
        return enrolledDate >= startDate && enrolledDate <= endDate;
      });
      enrollments.sort((a, b) => {
        const dateA = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
        const dateB = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
        return dateA - dateB;
      });
      setWeeklyEnrollments(enrollments);
      if (enrollments.length === 0) {
        console.log("No students enrolled in this period.");
      }
    } catch (err) {
      console.error("Error fetching enrollments:", err);
    } finally {
      setLoadingWeeklyEnrollments(false);
    }
  };

  const fetchLessons = async () => {
    if (!selectedBranch || !branchDetails?.students) return;
    if (!lessonStartDate || !lessonEndDate) {
      alert("Please select both start and end dates for lessons.");
      return;
    }
    const start = new Date(lessonStartDate);
    const end = new Date(lessonEndDate);
    end.setHours(23, 59, 59, 999);
    await fetchLessonsForBranch(
      selectedBranch.id,
      start,
      end,
      branchDetails.students,
    );
    await fetchEnrollmentsForBranch(
      selectedBranch.id,
      start,
      end,
      branchDetails.students,
    );
  };

  const formatKsh = (amount: number) => `Ksh ${amount.toLocaleString()}`;
  const monthlyEntries = Object.entries(collectionsByMonth).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const toggleReportsSection = async () => {
    if (!showReportsSection) {
      await fetchAndCleanReports();
      setLastViewedReports(new Date());
      setHasUnreadReports(false);
    }
    setShowReportsSection(!showReportsSection);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md">
          <img
            src="/logopds.jpg"
            alt="Logo"
            className="mx-auto mb-4 w-20 h-20 sm:w-24 sm:h-24 object-contain"
          />
          <h2 className="text-xl sm:text-2xl text-black font-bold mb-4 text-center">
            Company Dashboard Access
          </h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full text-black p-2 border rounded mb-4"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-500 text-sm mb-4">{passwordError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="p-6 text-center text-red-950">
        Loading company dashboard...
      </div>
    );
  if (!stats)
    return (
      <div className="p-6 text-center text-red-600">Failed to load data.</div>
    );

  return (
    <>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-amber-950">
            🏢 Company Dashboard
          </h1>
          <div className="flex gap-2">
            <button
              onClick={fetchAllStudents}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
            >
              📋 View All Students
            </button>
            <div className="relative">
              <button
                onClick={toggleReportsSection}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              >
                📄 Reports
              </button>
              {hasUnreadReports && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600"></span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-300 rounded-lg shadow p-4 border-l-8 border-green-500">
            <p className="text-sm text-gray-800">
              Total Revenue (All Branches)
            </p>
            <p className="text-2xl font-bold text-green-700">
              {formatKsh(stats.totalRevenue || 0)}
            </p>
          </div>
          <div className="bg-sky-400 rounded-lg shadow p-4 border-l-8 border-orange-500">
            <p className="text-sm text-gray-800">Total Outstanding</p>
            <p className="text-2xl font-bold text-orange-700">
              {formatKsh(stats.totalOutstanding || 0)}
            </p>
          </div>
          <div className="bg-emerald-400 rounded-lg shadow p-4 border-l-8 border-blue-500">
            <p className="text-sm text-gray-800">Total Students</p>
            <p className="text-2xl font-bold text-blue-700">
              {stats.totalStudents || 0}
            </p>
          </div>
          <div className="bg-yellow-300 rounded-lg shadow p-4 border-l-8 border-purple-900">
            <p className="text-sm text-gray-800">Active Branches</p>
            <p className="text-2xl font-bold text-purple-700">
              {stats.totalBranches || 0}
            </p>
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 mb-8 text-amber-950">
          <h3 className="font-semibold mb-2">
            📅 Filter Revenue by Date Range
          </h3>
          <form
            onSubmit={handleDateFilter}
            className="flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
                className="border rounded p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
                className="border rounded p-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={resetFilter}
              className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-700"
            >
              Reset
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-8 text-amber-950">
          <h3 className="text-lg font-semibold mb-3">📆 Monthly Collections</h3>
          {monthlyEntries.length === 0 ? (
            <p className="text-gray-800">
              No payment data available for the selected period.
            </p>
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
                      <td className="p-2 border text-right">
                        {formatKsh(amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold text-amber-950">
                    <td className="p-2 border">Total (filtered)</td>
                    <td className="p-2 border text-right">
                      {formatKsh(
                        monthlyEntries.reduce((sum, [, amt]) => sum + amt, 0),
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-8 text-amber-950">
          <h3 className="text-lg font-semibold mb-3">🏫 Branches Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="border rounded p-3 hover:shadow-md transition"
              >
                <div className="font-bold text-md">{branch.name}</div>
                <div className="text-sm text-gray-600">
                  Students: {branch.studentCount}
                </div>
                <div className="text-sm text-green-600">
                  Revenue: {formatKsh(branch.revenue)}
                </div>
                <div className="text-sm text-orange-600">
                  Outstanding: {formatKsh(branch.outstanding)}
                </div>
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

        {/* Recent Enrollments */}
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h3 className="text-lg font-semibold mb-3 text-amber-950">
            🆕 Recent Enrollments (Latest 20)
          </h3>
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
                        {student.enrolledAt
                          ? new Date(student.enrolledAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showReportsSection && (
          <div className="bg-gray-400 rounded-lg shadow p-4 mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-amber-950">
                📄 Exported Company Reports
              </h3>
              <button
                onClick={toggleReportsSection}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                ✕ Close
              </button>
            </div>
            {exportedReports.length === 0 ? (
              <p className="text-gray-500">
                No reports available (only last 24h are kept).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-green-500">
                    <tr>
                      <th className="p-2 border">Date</th>
                      <th className="p-2 border">Department (Type)</th>
                      <th className="p-2 border">Date Range</th>
                      <th className="p-2 border">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportedReports.map((report) => (
                      <tr key={report.id}>
                        <td className="p-2 border">
                          {new Date(report.createdAt).toLocaleString()}
                        </td>
                        <td className="p-2 border">{report.type}</td>
                        <td className="p-2 border">
                          {report.startDate || "any"} →{" "}
                          {report.endDate || "any"}
                        </td>
                        <td className="p-2 border space-x-2">
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setShowReportModal(true);
                            }}
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                          >
                            View
                          </button>
                          <button
                            onClick={() => printReport(report)}
                            className="bg-purple-600 text-white px-2 py-1 rounded text-xs"
                          >
                            Print
                          </button>
                          <button
                            onClick={() => deleteReport(report.id)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center mb-8">
          <button
            onClick={fetchFleetInstructorData}
            className="bg-indigo-700 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-800"
          >
            🚗 View Current Fleet & Instructors
          </button>
        </div>
      </div>

      {/* Branch Details Modal */}
      {showModal && selectedBranch && branchDetails && (
        <div className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-green-950 rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-amber-300 text-amber-950 border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {selectedBranch.name} – Full Details
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-2xl leading-none hover:text-red-600"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <p className="mb-2">
                <strong>Total Students:</strong>{" "}
                {branchDetails.students?.length || 0}
              </p>
              <p className="mb-2">
                <strong>Total Payments Received (this branch):</strong>{" "}
                {formatKsh(branchDetails.totalPayments || 0)}
              </p>

              <h3 className="font-semibold mt-4 mb-2">Student List</h3>
              <div className="overflow-x-auto mb-6">
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
                        <td className="p-2 border text-right">
                          {formatKsh(s.totalFee)}
                        </td>
                        <td className="p-2 border text-right">
                          {formatKsh(s.feePaid)}
                        </td>
                        <td className="p-2 border text-right font-bold text-orange-700">
                          {formatKsh(s.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <hr className="my-4 border-t-2 border-amber-500" />
              <h3 className="text-lg font-semibold mb-3 text-amber-200">
                📊 Lessons Taken (Date Range)
              </h3>
              <div className="flex flex-wrap gap-3 items-end mb-4">
                <div>
                  <label className="block text-sm text-white">From Date</label>
                  <input
                    type="date"
                    value={lessonStartDate}
                    onChange={(e) => setLessonStartDate(e.target.value)}
                    className="p-1 border rounded bg-blue-300 text-orange-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white">To Date</label>
                  <input
                    type="date"
                    value={lessonEndDate}
                    onChange={(e) => setLessonEndDate(e.target.value)}
                    className="p-1 border bg-blue-300 rounded text-orange-800"
                  />
                </div>
                <button
                  onClick={fetchLessons}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Load Lessons
                </button>
              </div>

              {!loadingLessons && lessonsList.length > 0 && (
                <div className="mb-4 p-3 bg-gray-700 rounded">
                  <h4 className="text-md font-semibold text-white mb-2">
                    📈 Weekly Lesson Totals (by day)
                  </h4>
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <div key={day} className="bg-gray-800 rounded p-2">
                          <div className="text-xs text-gray-300">{day}</div>
                          <div className="text-xl font-bold text-yellow-300">
                            {weeklyLessonCounts[day] || 0}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {loadingLessons ? (
                <p className="text-white">Loading lessons...</p>
              ) : lessonsList.length > 0 ? (
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full border text-sm bg-gray-800 text-white">
                    <thead className="bg-gray-600">
                      <tr>
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Student Name</th>
                        <th className="p-2 border">Lesson/Ticket #</th>
                        <th className="p-2 border">Lesson Type</th>
                        <th className="p-2 border">Duration (hrs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessonsList.map((lesson) => (
                        <tr key={lesson.id}>
                          <td className="p-2 border">
                            {lesson.date.toLocaleDateString()}
                          </td>
                          <td className="p-2 border">{lesson.studentName}</td>
                          <td className="p-2 border">
                            {lesson.lessonNumber || "—"}
                          </td>
                          <td className="p-2 border">{lesson.type}</td>
                          <td className="p-2 border">{lesson.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-right text-white font-bold">
                    Total Lessons: {lessonsList.length}
                  </div>
                </div>
              ) : (
                lessonStartDate &&
                lessonEndDate && (
                  <p className="text-gray-300 mb-4">
                    No lessons found for the selected period.
                  </p>
                )
              )}

              {loadingWeeklyEnrollments ? (
                <p className="text-white">Loading weekly enrollments...</p>
              ) : weeklyEnrollments.length > 0 ? (
                <div className="overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-2 text-amber-200">
                    📅 Students Enrolled in Selected Period
                  </h3>
                  <table className="min-w-full border text-sm bg-gray-800 text-white">
                    <thead className="bg-gray-600">
                      <tr>
                        <th className="p-2 border">Name</th>
                        <th className="p-2 border">Admission No</th>
                        <th className="p-2 border">Phone</th>
                        <th className="p-2 border">Enrolled Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyEnrollments.map((student) => (
                        <tr key={student.id}>
                          <td className="p-2 border">{student.name}</td>
                          <td className="p-2 border">
                            {student.accountNumber}
                          </td>
                          <td className="p-2 border">{student.phone}</td>
                          <td className="p-2 border">
                            {student.enrolledAt
                              ? new Date(
                                  student.enrolledAt,
                                ).toLocaleDateString()
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                lessonStartDate &&
                lessonEndDate && (
                  <p className="text-gray-300">
                    No students enrolled in this period.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Students Modal */}
      {showAllStudentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-indigo-600 text-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">📚 All Students</h2>
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
                        <th className="p-2 border border-gray-300">
                          Student Name
                        </th>
                        <th className="p-2 border border-gray-300">
                          Admission No
                        </th>
                        <th className="p-2 border border-gray-300">Phone</th>
                        <th className="p-2 border border-gray-300">
                          Enrolled Date
                        </th>
                        <th className="p-2 border border-gray-300">
                          Total Fee (Ksh)
                        </th>
                        <th className="p-2 border border-gray-300">
                          Paid (Ksh)
                        </th>
                        <th className="p-2 border border-gray-300">
                          Balance (Ksh)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStudentsList.map((student, idx) => (
                        <tr
                          key={student.id}
                          className="hover:bg-gray-500 text-amber-950"
                        >
                          <td className="p-2 border border-gray-300 text-center">
                            {idx + 1}
                          </td>
                          <td className="p-2 border border-gray-300">
                            {student.branchName}
                          </td>
                          <td className="p-2 border border-gray-300">
                            {student.name}
                          </td>
                          <td className="p-2 border border-gray-300">
                            {student.accountNumber}
                          </td>
                          <td className="p-2 border border-gray-300">
                            {student.phone}
                          </td>
                          <td className="p-2 border border-gray-300">
                            {student.enrolledAt
                              ? new Date(
                                  student.enrolledAt,
                                ).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="p-2 border border-gray-300 text-right">
                            {student.totalFee.toLocaleString()}
                          </td>
                          <td className="p-2 border border-gray-300 text-right">
                            {student.feePaid.toLocaleString()}
                          </td>
                          <td className="p-2 border border-gray-300 text-right font-bold text-orange-700">
                            {student.balance.toLocaleString()}
                          </td>
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

      {/* Report Viewer Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-yellow-500 rounded-lg shadow-xl w-full max-w-6xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-indigo-600 text-gray-300 p-3 flex justify-between">
              <h3 className="text-lg font-bold">Exported Fleet Report</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="p-4 overflow-x-auto text-black">
              <table className="min-w-full border">
                <thead className="bg-gray-400">
                  <tr>
                    {selectedReport.headers.map((h: string, i: number) => (
                      <th key={i} className="border p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.data.map((rowObj: any, idx: number) => (
                    <tr key={idx}>
                      {selectedReport.headers.map(
                        (header: string, colIdx: number) => (
                          <td key={colIdx} className="border p-2">
                            {rowObj[header]}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fleet & Instructor Modal */}
      {showFleetInstructorModal && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-yellow-500 rounded-lg shadow-xl w-full max-w-7xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-indigo-600 text-gray-300 p-3 flex justify-between">
              <h3 className="text-lg font-bold">
                Current Fleet & Instructors (Read-Only)
              </h3>
              <button
                onClick={() => setShowFleetInstructorModal(false)}
                className="text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              {loadingFleetData ? (
                <p>Loading...</p>
              ) : (
                <>
                  <h4 className="text-xl font-semibold mb-2">👨‍🏫 Instructors</h4>
                  <table className="min-w-full border mb-6 text-black">
                    <thead className="bg-gray-400">
                      <tr>
                        <th className="border p-2">Name</th>
                        <th className="border p-2">Code</th>
                        <th className="border p-2">Car Numbers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetData.instructors.map((inst) => (
                        <tr key={inst.id}>
                          <td className="border p-2">{inst.name}</td>
                          <td className="border p-2">{inst.code}</td>
                          <td className="border p-2">
                            {inst.carNumbers?.join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h4 className="text-xl font-semibold mb-2">🚗 Vehicles</h4>
                  <table className="min-w-full border text-black">
                    <thead className="bg-gray-400">
                      <tr>
                        <th className="border p-2">Plate</th>
                        <th className="border p-2">Insurance Expiry</th>
                        <th className="border p-2">Last Service (km)</th>
                        <th className="border p-2">Current Odo</th>
                        <th className="border p-2">Next Service</th>
                        <th className="border p-2">Branch</th>
                        <th className="border p-2">Instructor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetData.vehicles.map((v) => (
                        <tr key={v.id}>
                          <td className="border p-2">{v.plate}</td>
                          <td className="border p-2">{v.insuranceExpiry}</td>
                          <td className="border p-2">{v.lastServiceKm}</td>
                          <td className="border p-2">{v.currentOdometer}</td>
                          <td className="border p-2">{v.nextServiceKm}</td>
                          <td className="border p-2">{v.branch}</td>
                          <td className="border p-2">
                            {v.assignedInstructorName || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}