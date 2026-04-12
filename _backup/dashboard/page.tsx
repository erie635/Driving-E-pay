"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// ✅ ADDED FIREBASE
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";

// Default fallback fees (used only if no document exists)
const DEFAULT_CLASS_FEES: Record<string, number> = {
  'B1/B2': 15000,
  C1: 18500,
  A1: 7500,
  A2: 7500,
  A3: 7500,
};

// Mock data – replace with your actual API calls
const branches = [
  { id: 1, name: "Main Branch", studentCount: 45 },
  { id: 2, name: "North Branch", studentCount: 32 },
  { id: 3, name: "South Branch", studentCount: 28 },
  { id: 4, name: "East Branch", studentCount: 19 },
];

// Helper functions for calendar
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getMonthStartDay = (year: number, month: number) => {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
};

const formatDate = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// Helper: generate a unique admission number based on branch name and school name
const generateAdmissionNumber = (branchName: string, studentId: string) => {
  const schoolName = "Harmlow"; // your school name
  const schoolInitial = schoolName.charAt(0).toUpperCase(); // 'H'

  let prefix = "STD-";
  if (branchName && branchName.trim().toLowerCase().startsWith("s")) {
    prefix = `S${schoolInitial}DR-`;
  }

  // Use part of the Firestore document ID + timestamp to make it unique
  const unique = studentId.slice(-6) + Date.now().toString().slice(-4);
  return `${prefix}${unique}`;
};

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

  // ✅ ADDED STATES
  const [firebaseBranches, setFirebaseBranches] = useState<any[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] // today's date as YYYY-MM-DD
  );

  // Calendar navigation state
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  // ✅ States for students of the selected branch
  const [branchStudents, setBranchStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  // ✅ NEW: total number of students across all branches
  const [totalAllStudents, setTotalAllStudents] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(false);

  // ✅ NEW: Date range for collection filtering (when branch is selected)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [totalCollected, setTotalCollected] = useState<number>(0);
  const [totalDebt, setTotalDebt] = useState<number>(0);

  // ✅ NEW: Class fees from Firestore
  const [classFees, setClassFees] = useState<Record<string, number>>(DEFAULT_CLASS_FEES);

  // Fetch class fees from Firestore
  useEffect(() => {
    const fetchClassFees = async () => {
      try {
        const feesDocRef = doc(db, 'settings', 'classFees');
        const feesDoc = await getDoc(feesDocRef);
        if (feesDoc.exists()) {
          setClassFees(feesDoc.data() as Record<string, number>);
        }
      } catch (err) {
        console.error('Error fetching class fees:', err);
      }
    };
    fetchClassFees();
  }, []);

  // Reset branch selection when navigating away
  const resetBranchSelection = () => {
    setShowBranchSelection(false);
    setSelectedBranch(null);
    setStudentCount(null);
    setBranchStudents([]);
    setStudentsError("");
    setStartDate("");
    setEndDate("");
  };

  const handleStudentClick = () => {
    resetBranchSelection();
    setShowBranchSelection(true);
  };

  const handleBranchSelect = (branch: (typeof branches)[0]) => {
    setSelectedBranch(branch);
    setStudentCount(branch.studentCount);
  };

  // ✅ Fetch students when a branch is selected (with dynamic total fee)
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedBranch) {
        setBranchStudents([]);
        return;
      }

      setLoadingStudents(true);
      setStudentsError("");

      try {
        const branchId = String(selectedBranch.id);
        const studentsRef = collection(db, "branches", branchId, "students");
        const q = query(studentsRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        const studentsList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const studentId = docSnap.id;
          const classes = data.classes || [];

          // Compute total fee based on enrolled classes
          let totalFee = data.totalFee; // use stored if exists
          if (!totalFee && classes.length) {
            totalFee = classes.reduce((sum, cls) => sum + (classFees[cls] || 0), 0);
          } else if (!totalFee) {
            totalFee = 0;
          }

          let admissionNumber = data.accountNumber;
          if (!admissionNumber) {
            admissionNumber = generateAdmissionNumber(selectedBranch.name, studentId);
          }

          const feePaid = Number(data.feePaid) || 0;
          const balance = totalFee - feePaid;

          let regDate = "Unknown";
          let regTimestamp: Date | null = null;
          if (data.createdAt) {
            let dateObj;
            if (data.createdAt.seconds) {
              dateObj = new Date(data.createdAt.seconds * 1000);
              regTimestamp = dateObj;
            } else {
              dateObj = new Date(data.createdAt);
              regTimestamp = dateObj;
            }
            if (!isNaN(dateObj.getTime())) {
              regDate = dateObj.toLocaleDateString("en-GB");
            }
          }

          return {
            id: studentId,
            name: data.name || "No name",
            phone: data.phone || "N/A",
            feePaid,
            totalFee,
            balance: balance > 0 ? balance : 0,
            admissionNumber,
            registrationDate: regDate,
            regTimestamp,
            classes, // store for display
          };
        });

        setBranchStudents(studentsList);
      } catch (err) {
        console.error("Error fetching students:", err);
        setStudentsError("Could not load students for this branch.");
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [selectedBranch, classFees]);

  // ✅ Calculate total collected and debt based on date range
  useEffect(() => {
    if (!branchStudents.length) {
      setTotalCollected(0);
      setTotalDebt(0);
      return;
    }

    let collected = 0;
    let debt = 0;

    branchStudents.forEach((student) => {
      let include = true;

      if (startDate && student.regTimestamp) {
        const regDateOnly = student.regTimestamp.toISOString().split("T")[0];
        if (regDateOnly < startDate) include = false;
      }
      if (endDate && student.regTimestamp && include) {
        const regDateOnly = student.regTimestamp.toISOString().split("T")[0];
        if (regDateOnly > endDate) include = false;
      }

      if (include) {
        collected += student.feePaid;
        if (student.balance > 0) debt += student.balance;
      }
    });

    setTotalCollected(collected);
    setTotalDebt(debt);
  }, [branchStudents, startDate, endDate]);

  // ✅ FIREBASE FETCH
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const snapshot = await getDocs(collection(db, "branches"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (data.length > 0) {
          setFirebaseBranches(data);
          setFilteredBranches(data);
        } else {
          setFirebaseBranches(branches);
          setFilteredBranches(branches);
        }
      } catch (err) {
        setFirebaseBranches(branches);
        setFilteredBranches(branches);
      }
    };

    fetchBranches();
  }, []);

  // ✅ calculate total students across all branches
  useEffect(() => {
    const fetchTotalStudents = async () => {
      const branchList = firebaseBranches.length ? firebaseBranches : branches;
      if (branchList.length === 0) return;

      setLoadingTotal(true);
      let total = 0;
      try {
        for (const branch of branchList) {
          const branchId = String(branch.id);
          const studentsRef = collection(db, "branches", branchId, "students");
          const snapshot = await getDocs(studentsRef);
          total += snapshot.size;
        }
        setTotalAllStudents(total);
      } catch (err) {
        console.error("Error counting total students:", err);
        const fallbackTotal = branchList.reduce((sum, b) => sum + (b.studentCount || 0), 0);
        setTotalAllStudents(fallbackTotal);
      } finally {
        setLoadingTotal(false);
      }
    };

    fetchTotalStudents();
  }, [firebaseBranches]);

  // ✅ SEARCH FILTER
  useEffect(() => {
    const source = firebaseBranches.length ? firebaseBranches : branches;
    const filtered = source.filter((b) =>
      b.name.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredBranches(filtered);
  }, [search, firebaseBranches]);

  // Calendar generation
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = getMonthStartDay(currentYear, currentMonth);
  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const clearSelectedDate = () => {
    setSelectedDate("");
  };

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-gray-100">
      {/* Modern sidebar - white with subtle shadow */}
      <nav className="w-36 bg-white shadow-sm z-10 flex flex-col border-r border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Account Management.
          </h1>
          <p className="text-xs text-gray-500 mt-1"></p>
        </div>

        <ul className="flex-1 py-5 space-y-1">
          <li>
            <button
              onClick={handleStudentClick}
              className="flex items-center w-full px-5 py-2.5 text-gray-700 hover:text-indigo-500 hover:bg-indigo-400 transition-all duration-200 rounded-lg mx-3 group text-sm"
            >
              <span className="mr-3 text-lg">🎓</span>
              <span className="font-medium  hover:bg-gray-600 rounded-lg">Explore</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-3 z-10 overflow-auto">
        <div className="bg-gray-100 rounded-xl shadow-sm border border-gray-300 p-4">
          {showBranchSelection ? (
            <div className="space-y-5">
              {!selectedBranch ? (
                <>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Select a Branch
                  </h2>

                  <input
                    type="text"
                    placeholder="Search branch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full p-2.5 text-gray-800 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition"
                  />

                  <div className="mb-3">
                    <label className="block text-gray-700 font-medium text-sm mb-1">
                      <strong>Select Date:</strong>
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border border-gray-400 p-2 rounded-lg w-full bg-gray-100 text-gray-800 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                    />
                  </div>

                  {/* Calendar */}
                  <div className="bg-gray-400 rounded-lg border border-gray-300 p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={goToPreviousMonth} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-100 rounded-lg text-gray-600 text-sm transition">◀</button>
                      <span className="text-base font-medium text-gray-800">
                        {new Date(currentYear, currentMonth).toLocaleString("default", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <button onClick={goToNextMonth} className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 text-sm transition">▶</button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {weekdays.map((day) => (
                        <div key={day} className="font-medium text-gray-500 text-xs">{day}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, index) => {
                        if (day === null) return <div key={`empty-${index}`} className="p-2" />;
                        const dateStr = formatDate(currentYear, currentMonth, day);
                        const isSelected = selectedDate === dateStr;
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`p-2 text-center text-sm rounded-full transition ${
                              isSelected ? "bg-indigo-600 text-white" : "hover:bg-indigo-50 text-gray-700"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button onClick={clearSelectedDate} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-white text-xs transition">
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* OVERALL PERFORMANCE */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-300">
                    <p className="text-sm text-gray-700">Total Students: <span className="font-semibold">{loadingTotal ? "Loading..." : totalAllStudents}</span></p>
                    <p className="text-sm text-gray-700 mt-1">Total Branches: <span className="font-semibold">{(firebaseBranches.length || branches.length)}</span></p>
                    <p className="text-sm text-gray-700 mt-1">Selected Date: <span className="font-semibold">{selectedDate || "None"}</span></p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                    {filteredBranches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => handleBranchSelect(branch)}
                        className={`bg-white hover:bg-indigo-200 transition-all p-4 rounded-xl text-left border ${
                          selectedBranch?.id === branch.id
                            ? "border-indigo-500 bg-indigo-50 shadow-sm"
                            : "border-gray-300 shadow-sm"
                        } hover:border-indigo-300 hover:shadow`}
                      >
                        <div className="text-gray-800 font-semibold text-base">
                          {branch.name}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          Students: {branch.studentCount || 0}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedBranch && studentCount !== null && (
                    <div className="mt-5 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-gray-800 text-sm">
                        <span className="font-semibold">{selectedBranch.name}</span>{" "}
                        has{" "}
                        <span className="font-bold text-indigo-600">
                          {studentCount}
                        </span>{" "}
                        students.
                      </p>
                      <button
                        onClick={() => {
                          setSelectedBranch(null);
                          setStudentCount(null);
                        }}
                        className="mt-2 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg text-gray-600 text-xs transition border border-gray-200"
                      >
                        Clear selection
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setShowBranchSelection(false)}
                    className="mt-3 px-4 py-2 bg-orange-400 hover:bg-gray-100 rounded-lg text-gray-600 text-sm transition font-medium border border-gray-200"
                  >
                    ← Back to dashboard
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Students of {selectedBranch.name}
                    </h2>
                    <button
                      onClick={() => {
                        setSelectedBranch(null);
                        setStudentCount(null);
                        setBranchStudents([]);
                      }}
                      className="px-3 py-1.5 bg-orange-400 hover:bg-gray-100 rounded-lg text-gray-600 text-sm border border-gray-200"
                    >
                      ← Back to Branches
                    </button>
                  </div>

                  {/* Date range filter */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">Filter Collections by Registration Date</h3>
                    <div className="flex flex-wrap gap-4 items-end">
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">From Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="border border-gray-300 p-2 rounded-lg bg-white text-gray-800 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">To Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="border border-gray-300 p-2 rounded-lg bg-white text-gray-800 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => { setStartDate(""); setEndDate(""); }}
                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition"
                      >
                        Clear Dates
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <p className="text-green-700 text-sm">Total Collected (Ksh)</p>
                        <p className="text-2xl font-bold text-green-800">{totalCollected.toLocaleString()}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <p className="text-orange-700 text-sm">Total Outstanding Debt (Ksh)</p>
                        <p className="text-2xl font-bold text-orange-800">{totalDebt.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      * Totals are based on students registered within the selected date range (if any). Debt = balance (total fee - fee paid).
                    </p>
                  </div>

                  {loadingStudents && <div className="text-center py-6 text-gray-500 text-sm">Loading students...</div>}
                  {studentsError && <div className="text-red-600 p-3 bg-red-50 rounded text-sm">{studentsError}</div>}
                  {!loadingStudents && branchStudents.length === 0 && !studentsError && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500 text-sm">
                      No students have been added to this branch yet.
                    </div>
                  )}
                  {!loadingStudents && branchStudents.length > 0 && (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {branchStudents.map((student) => (
                        <div key={student.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow transition">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium text-gray-700">Admission No:</span> <span className="text-gray-800">{student.admissionNumber}</span></div>
                            <div><span className="font-medium text-gray-700">Name:</span> <span className="text-gray-800">{student.name}</span></div>
                            <div><span className="font-medium text-gray-700">Phone:</span> <span className="text-gray-800">{student.phone}</span></div>
                            <div><span className="font-medium text-gray-700">Classes:</span> <span className="text-gray-800">{student.classes?.join(', ') || 'Not specified'}</span></div>
                            <div><span className="font-medium text-gray-700">Total Fee:</span> <span className="text-gray-800">Ksh {student.totalFee}</span></div>
                            <div><span className="font-medium text-gray-700">Fee Paid:</span> <span className="text-gray-800">Ksh {student.feePaid}</span></div>
                            <div><span className="font-medium text-gray-700">Balance:</span> <span className="text-gray-800">Ksh {student.balance}</span></div>
                            <div><span className="font-medium text-gray-700">Reg. Date:</span> <span className="text-gray-800">{student.registrationDate}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // ✅ FINAL LAYOUT: Text on the left, image fully visible on the right (no cropping)
            <div className="flex flex-col md:flex-row gap-0 items-stretch">
              {/* Left side: history text */}
              <div className="flex-1 p-6 space-y-4 bg-white rounded-l-lg">
                <h1 className="text-5xl font-bold text-blue-400">HARMFLOW</h1>
                <h2 className="text-xl font-semibold text-indigo-600">Our Journey</h2>
                <div className="prose prose-gray max-w-none text-gray-700 space-y-3">
                  <p>
                    Hamflow (originally named Harmlow) was founded in 2010 as a small community learning centre 
                    with just 12 students and a single branch. The vision was simple: provide quality, affordable 
                    education that adapts to each student’s needs.
                  </p>
                  <p>
                    By 2015, Hamflow had expanded to three branches across the city, introducing modern teaching 
                    methods and digital progress tracking. The school became known for its strong emphasis on 
                    languages (B1/B2, C1) and professional driving courses (A1, A2, A3).
                  </p>
                  <p>
                    In 2020, Hamflow launched its own digital account management system – the very dashboard you 
                    are using now. This allowed real‑time fee tracking, automated admission numbers, and branch‑wise 
                    performance analytics.
                  </p>
                  <p>
                    Today, Hamflow serves over <strong>500 active students</strong> across four main branches, 
                    maintaining a 94% exam pass rate and a growing alumni network. The name “Hamflow” reflects 
                    the school’s core philosophy: <em>“knowledge flows freely, like water – reaching everyone, 
                    everywhere.”</em>
                  </p>
                  <p className="text-sm text-gray-500 italic">
                    * All dashboard logic (branch selection, student lists, fee calculations) remains unchanged.
                  </p>
                </div>
              </div>

              {/* Right side: image fully visible (object-contain) */}
              <div className="md:w-1/2 bg-gray-100 rounded-r-lg overflow-hidden min-h-[400px] md:min-h-full flex items-center justify-center">
                <img
                  src="/five.jpg"
                  alt="Five"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}