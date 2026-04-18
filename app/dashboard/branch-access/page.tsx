"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  query,
  orderBy,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

interface Student {
  id: string;
  name: string;
  feePaid: number;
  totalFee?: number;
  phone?: string;
  accountNumber?: string;
  classes?: string[];
  idNumber?: string;
  payments?: Payment[];
  lessons?: Lesson[];
  createdAt?: Date; // ✅ added for registration date
}

interface Payment {
  id: string;
  amount: number;
  date: Date;
  note?: string;
  method?: "mpesa" | "cash";
  reference?: string;
}

interface Lesson {
  id: string;
  date: Date;
  type?: string;
}

// Helper: safely convert any date value to Date object
const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

function BranchAccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<{ id: string; name: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");

  // Password verification state
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  // Date filter state
  const [selectedDate, setSelectedDate] = useState("");
  const [dailyTotal, setDailyTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  // ✅ New: outstanding balances based on registration date
  const [dailyBalance, setDailyBalance] = useState(0);
  const [weeklyBalance, setWeeklyBalance] = useState(0);
  const [yearlyBalance, setYearlyBalance] = useState(0);

  // Other features
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [lessonNote, setLessonNote] = useState("");
  const [lessonError, setLessonError] = useState("");
  const [lessonSuccess, setLessonSuccess] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash">("cash");
  const [mpesaCode, setMpesaCode] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");

  // Maximum lessons per student (hardcoded)
  const MAX_LESSONS = 20;
  const MAX_LESSONS_WITH_BALANCE = 5;

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }

    const verifyAndFetch = async () => {
      try {
        const res = await fetch(`/api/invite/verify?token=${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const branchInfo = data.branch;
        setBranch(branchInfo);

        const inviteDocRef = doc(db, "branchInvitations", token);
        const inviteDoc = await getDoc(inviteDocRef);
        if (inviteDoc.exists()) {
          setStoredPassword(inviteDoc.data().password);
        } else {
          throw new Error("Invitation not found");
        }

        // Fetch students, payments, lessons
        const studentsRef = collection(db, "branches", branchInfo.id, "students");
        const studentsSnap = await getDocs(studentsRef);
        const studentsList: Student[] = [];
        for (const docSnap of studentsSnap.docs) {
          const data = docSnap.data();
          // Payments
          const paymentsRef = collection(db, "branches", branchInfo.id, "students", docSnap.id, "payments");
          const paymentsSnap = await getDocs(query(paymentsRef, orderBy("date", "desc")));
          const payments: Payment[] = paymentsSnap.docs.map((p) => {
            const pData = p.data();
            return {
              id: p.id,
              amount: pData.amount,
              date: toDate(pData.date),
              note: pData.note,
              method: pData.method,
              reference: pData.reference,
            };
          });
          // Lessons
          const lessonsRef = collection(db, "branches", branchInfo.id, "students", docSnap.id, "lessons");
          const lessonsSnap = await getDocs(query(lessonsRef, orderBy("date", "desc")));
          const lessons: Lesson[] = lessonsSnap.docs.map((l) => {
            const lData = l.data();
            return {
              id: l.id,
              date: toDate(lData.date),
              type: lData.type,
            };
          });
          studentsList.push({
            id: docSnap.id,
            name: data.name || "No name",
            feePaid: Number(data.feePaid) || 0,
            totalFee: data.totalFee || 0,
            phone: data.phone || "",
            accountNumber: data.accountNumber || data.studentAccountId || "N/A",
            classes: data.classes || [],
            idNumber: data.idNumber || "",
            payments,
            lessons,
            createdAt: toDate(data.createdAt), // ✅ store registration date
          });
        }
        setStudents(studentsList);
      } catch (err: any) {
        setError(err.message || "Invalid or expired invitation.");
      } finally {
        setLoading(false);
      }
    };
    verifyAndFetch();
  }, [token]);

  // Date-based totals (revenue from payments)
  useEffect(() => {
    if (!selectedDate) {
      setDailyTotal(0);
      setWeeklyTotal(0);
      setYearlyTotal(0);
      return;
    }
    const referenceDate = new Date(selectedDate);
    if (isNaN(referenceDate.getTime())) {
      setDailyTotal(0);
      setWeeklyTotal(0);
      setYearlyTotal(0);
      return;
    }

    const dailyTarget = selectedDate;
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const targetYear = referenceDate.getFullYear();

    let daily = 0;
    let weekly = 0;
    let yearly = 0;

    students.forEach((student) => {
      student.payments?.forEach((payment) => {
        const paymentDate = payment.date;
        const dateStr = paymentDate.toISOString().split("T")[0];
        if (dateStr === dailyTarget) daily += payment.amount;
        if (paymentDate >= startOfWeek && paymentDate <= endOfWeek) weekly += payment.amount;
        if (paymentDate.getFullYear() === targetYear) yearly += payment.amount;
      });
    });

    setDailyTotal(daily);
    setWeeklyTotal(weekly);
    setYearlyTotal(yearly);
  }, [selectedDate, students]);

  // ✅ Outstanding balances based on student registration date
  useEffect(() => {
    if (!selectedDate) {
      setDailyBalance(0);
      setWeeklyBalance(0);
      setYearlyBalance(0);
      return;
    }
    const referenceDate = new Date(selectedDate);
    if (isNaN(referenceDate.getTime())) {
      setDailyBalance(0);
      setWeeklyBalance(0);
      setYearlyBalance(0);
      return;
    }

    const dailyTarget = selectedDate;
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const targetYear = referenceDate.getFullYear();

    let daily = 0;
    let weekly = 0;
    let yearly = 0;

    students.forEach((student) => {
      if (!student.createdAt) return;
      const regDate = student.createdAt;
      const dateStr = regDate.toISOString().split("T")[0];
      const balance = (student.totalFee || 0) - student.feePaid;
      if (balance <= 0) return; // only count outstanding balances
      if (dateStr === dailyTarget) daily += balance;
      if (regDate >= startOfWeek && regDate <= endOfWeek) weekly += balance;
      if (regDate.getFullYear() === targetYear) yearly += balance;
    });

    setDailyBalance(daily);
    setWeeklyBalance(weekly);
    setYearlyBalance(yearly);
  }, [selectedDate, students]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === storedPassword) {
      setIsPasswordVerified(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password. Access denied.");
    }
  };

  // Search filter
  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.accountNumber && s.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.idNumber && s.idNumber.includes(searchQuery)),
  );

  // Lesson generation with balance restriction
  const generateLesson = async () => {
    if (!selectedStudent) return;

    const lessonsTaken = selectedStudent.lessons?.length || 0;
    const balance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;

    if (lessonsTaken >= MAX_LESSONS) {
      setLessonError(`❌ Student has already completed ${MAX_LESSONS} lessons (maximum).`);
      setLessonSuccess("");
      return;
    }

    if (balance > 0 && lessonsTaken >= MAX_LESSONS_WITH_BALANCE) {
      setLessonError(
        `❌ Student has an outstanding balance of Ksh ${balance}. Please clear the balance first to continue lessons. (Max ${MAX_LESSONS_WITH_BALANCE} lessons allowed with balance.)`,
      );
      setLessonSuccess("");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lessonsToday =
      selectedStudent.lessons?.filter((l) => {
        const lessonDate = new Date(l.date);
        lessonDate.setHours(0, 0, 0, 0);
        return lessonDate.getTime() === today.getTime();
      }) || [];
    if (lessonsToday.length >= 2) {
      setLessonError("❌ Student cannot take more than 2 lessons per day.");
      setLessonSuccess("");
      return;
    }

    try {
      const lessonsRef = collection(db, "branches", branch!.id, "students", selectedStudent.id, "lessons");
      await addDoc(lessonsRef, {
        date: Timestamp.now(),
        type: lessonNote || "General",
      });
      const newLesson: Lesson = {
        id: Date.now().toString(),
        date: new Date(),
        type: lessonNote,
      };
      const updatedLessons = [...(selectedStudent.lessons || []), newLesson];
      setSelectedStudent({ ...selectedStudent, lessons: updatedLessons });
      setStudents((prev) =>
        prev.map((s) => (s.id === selectedStudent.id ? { ...s, lessons: updatedLessons } : s)),
      );
      setLessonSuccess("✅ Lesson generated successfully!");
      setLessonError("");
      setLessonNote("");
      setTimeout(() => setLessonSuccess(""), 3000);
    } catch (err) {
      setLessonError("Failed to generate lesson.");
    }
  };

  // Add payment with method and reference
  const addPayment = async () => {
    if (!selectedStudent) return;
    const amount = parseFloat(newPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("Enter a valid positive amount.");
      return;
    }
    if (paymentMethod === "mpesa" && !mpesaCode.trim()) {
      setPaymentError("Please enter M-Pesa transaction code.");
      return;
    }
    try {
      const paymentsRef = collection(db, "branches", branch!.id, "students", selectedStudent.id, "payments");
      const paymentData: any = {
        amount,
        date: Timestamp.now(),
        method: paymentMethod,
      };
      if (paymentMethod === "mpesa") {
        paymentData.reference = mpesaCode;
        paymentData.note = `M-Pesa: ${mpesaCode}`;
      } else {
        paymentData.note = "Cash payment";
      }
      await addDoc(paymentsRef, paymentData);

      const newFeePaid = selectedStudent.feePaid + amount;
      const studentDocRef = doc(db, "branches", branch!.id, "students", selectedStudent.id);
      await updateDoc(studentDocRef, { feePaid: newFeePaid });

      const newPayment: Payment = {
        id: Date.now().toString(),
        amount,
        date: new Date(),
        method: paymentMethod,
        reference: paymentMethod === "mpesa" ? mpesaCode : undefined,
        note: paymentMethod === "mpesa" ? `M-Pesa: ${mpesaCode}` : "Cash payment",
      };
      const updatedPayments = [newPayment, ...(selectedStudent.payments || [])];
      setSelectedStudent({
        ...selectedStudent,
        feePaid: newFeePaid,
        payments: updatedPayments,
      });
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, feePaid: newFeePaid, payments: updatedPayments } : s,
        ),
      );

      setPaymentSuccess(`✅ Ksh ${amount} recorded as ${paymentMethod === "mpesa" ? "M-Pesa" : "Cash"}!`);
      setPaymentError("");
      setNewPaymentAmount("");
      setMpesaCode("");
      setPaymentMethod("cash");
      setTimeout(() => setPaymentSuccess(""), 3000);
    } catch (err) {
      setPaymentError("Failed to record payment.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-sm">Loading branch dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center p-4 text-sm">{error}</div>
      </div>
    );
  }

  if (!isPasswordVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md w-full max-w-xs sm:max-w-sm">
          <h2 className="text-lg sm:text-xl text-black font-bold mb-3 text-center">
            Enter Branch Password
          </h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full text-black p-1.5 sm:p-2 border rounded mb-3 text-sm"
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-xs mb-3">{passwordError}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-1.5 sm:py-2 rounded hover:bg-indigo-700 text-sm"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalRevenue = students.reduce((sum, s) => sum + s.feePaid, 0);
  const totalOutstanding = students.reduce((sum, s) => sum + ((s.totalFee || 0) - s.feePaid), 0);

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Branch header */}
      <div className="bg-gradient-to-r from-indigo-600 via-orange-600 to-white rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{branch?.name} Dashboard</h1>
        <p className="text-indigo-100 text-xs sm:text-sm mt-0.5 sm:mt-1">
          Branch overview & student management
        </p>
      </div>

      {/* Date filter - shows both revenue and outstanding balance */}
      <div className="bg-amber-500 rounded-lg shadow p-3 sm:p-4 mb-5">
        <label className="text-sm sm:text-base font-medium block mb-2">
          <strong>Select Date:</strong>
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-1.5 sm:p-2 rounded text-sm sm:text-base"
        />
        <div className="mt-3 space-y-1 text-sm sm:text-base">
          <p>
            <strong>📅 Daily Collection (Revenue):</strong> Ksh {dailyTotal.toLocaleString()}
          </p>
          <p>
            <strong>📊 Weekly Collection (Revenue):</strong> Ksh {weeklyTotal.toLocaleString()}
          </p>
          <p>
            <strong>📊 Yearly Collection (Revenue):</strong> Ksh {yearlyTotal.toLocaleString()}
          </p>
          <p className="mt-2 pt-2 border-t border-gray-400">
            <strong>⚖️ Daily Outstanding Balance:</strong> Ksh {dailyBalance.toLocaleString()}
          </p>
          <p>
            <strong>⚖️ Weekly Outstanding Balance:</strong> Ksh {weeklyBalance.toLocaleString()}
          </p>
          <p>
            <strong>⚖️ Yearly Outstanding Balance:</strong> Ksh {yearlyBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">Total Students</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-800">{students.length}</div>
        </div>
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">Total Revenue (Fees Paid)</div>
          <div className="text-xl sm:text-3xl font-bold text-green-600">Ksh {totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">Outstanding Balance</div>
          <div className="text-xl sm:text-3xl font-bold text-orange-600">Ksh {totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Search by name, admission number, phone, or ID number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded-lg text-sm"
        />
      </div>

      {/* Student list and detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Student list */}
        <div className="bg-black rounded-lg shadow overflow-hidden lg:col-span-1">
          <div className="px-3 py-2 bg-gray-500 border-b">
            <h3 className="font-semibold text-sm">Students ({filteredStudents.length})</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                  selectedStudent?.id === student.id ? "bg-indigo-500 border-l-4 border-indigo-500" : ""
                }`}
              >
                <div className="font-medium text-sm">{student.name}</div>
                <div className="text-xs text-gray-500">
                  {student.accountNumber} | {student.phone}
                </div>
                <div className="text-xs font-semibold mt-1">
                  Balance: Ksh {((student.totalFee || 0) - student.feePaid).toLocaleString()}
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-800">No students match</div>
            )}
          </div>
        </div>

        {/* Student details panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStudent ? (
            <>
              {/* Student info card */}
              <div className="bg-gray-700 rounded-lg shadow p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedStudent.name}</h2>
                    <p className="text-xs text-white">
                      Admission: {selectedStudent.accountNumber} | ID: {selectedStudent.idNumber || "N/A"}
                    </p>
                    <p className="text-xs text-white">
                      Phone: {selectedStudent.phone} | Classes: {selectedStudent.classes?.join(", ") || "None"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      Total Fee: <span className="font-semibold">Ksh {selectedStudent.totalFee}</span>
                    </div>
                    <div className="text-sm">
                      Paid: <span className="font-semibold text-green-500">Ksh {selectedStudent.feePaid}</span>
                    </div>
                    <div className="text-sm font-bold">
                      Balance:{" "}
                      <span
                        className={
                          (selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0
                            ? "text-orange-600"
                            : "text-green-600"
                        }
                      >
                        Ksh {((selectedStudent.totalFee || 0) - selectedStudent.feePaid).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment history with method & reference */}
              <div className="bg-indigo-800 rounded-lg shadow p-4">
                <h3 className="font-semibold text-white text-sm mb-2">💰 Payment History</h3>
                {selectedStudent.payments && selectedStudent.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedStudent.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center border-b pb-1 text-sm">
                        <div>
                          <span className="font-medium text-gray-100">Ksh {payment.amount}</span>
                          <span className="text-gray-900 text-xs ml-2">{payment.date.toLocaleDateString()}</span>
                          {payment.method === "mpesa" ? (
                            <span className="text-gray-900 text-xs ml-2">M-Pesa: {payment.reference}</span>
                          ) : (
                            <span className="text-gray-900 text-xs ml-2">Cash</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-black">No payments recorded.</p>
                )}

                {/* Hide Add Payment form when balance <= 0 */}
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 ? (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[100px]">
                        <label className="block text-xs text-black">Amount (Ksh)</label>
                        <input
                          type="number"
                          value={newPaymentAmount}
                          onChange={(e) => setNewPaymentAmount(e.target.value)}
                          className="w-full border rounded p-1 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-black">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as "mpesa" | "cash")}
                          className="w-full border rounded p-1 text-sm"
                        >
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                        </select>
                      </div>
                      {paymentMethod === "mpesa" && (
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xs text-black">M-Pesa Code</label>
                          <input
                            type="text"
                            value={mpesaCode}
                            onChange={(e) => setMpesaCode(e.target.value)}
                            className="w-full border rounded p-1 text-sm"
                            placeholder="e.g., QWERTY123"
                          />
                        </div>
                      )}
                      <button
                        onClick={addPayment}
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
                      >
                        Add Payment
                      </button>
                    </div>
                    {paymentError && <p className="text-red-500 text-xs mt-1">{paymentError}</p>}
                    {paymentSuccess && <p className="text-green-600 text-xs mt-1">{paymentSuccess}</p>}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-green-300 text-sm font-semibold">✅ Fully Paid – No further payments required.</p>
                  </div>
                )}
              </div>

              {/* Lessons section with total & remaining lessons */}
              <div className="bg-indigo-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">📚 Lessons</h3>
                  <div className="text-sm">
                    <span className="font-medium">
                      Total: {selectedStudent.lessons?.length || 0} / {MAX_LESSONS}
                    </span>
                    <span
                      className={`ml-2 font-bold ${
                        MAX_LESSONS - (selectedStudent.lessons?.length || 0) <= 5 ? "text-red-400" : "text-yellow-200"
                      }`}
                    >
                      Remaining: {MAX_LESSONS - (selectedStudent.lessons?.length || 0)}
                    </span>
                  </div>
                </div>
                {/* Show warning if balance > 0 and lessons >= 5 */}
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 &&
                  (selectedStudent.lessons?.length || 0) >= MAX_LESSONS_WITH_BALANCE && (
                    <div className="bg-red-900 text-white text-xs p-2 rounded mb-2">
                      ⚠️ Outstanding balance of Ksh{" "}
                      {((selectedStudent.totalFee || 0) - selectedStudent.feePaid).toLocaleString()}. Please clear the
                      balance to continue lessons beyond {MAX_LESSONS_WITH_BALANCE}.
                    </div>
                  )}
                {selectedStudent.lessons && selectedStudent.lessons.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
                    {(() => {
                      const grouped: { [date: string]: Lesson[] } = {};
                      selectedStudent.lessons.forEach((lesson) => {
                        const dateKey = lesson.date.toLocaleDateString();
                        if (!grouped[dateKey]) grouped[dateKey] = [];
                        grouped[dateKey].push(lesson);
                      });
                      return Object.entries(grouped).map(([dateStr, lessonsOnDate]) => (
                        <div key={dateStr} className="text-sm border-b border-gray-600 pb-1">
                          <div className="font-semibold text-gray-200">{dateStr}</div>
                          {lessonsOnDate.map((lesson) => (
                            <div key={lesson.id} className="flex justify-between pl-2">
                              <span>{lesson.type || "General"} ✅</span>
                              <span className="text-gray-900 text-xs">
                                {lesson.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ))}
                          {lessonsOnDate.length === 2 && (
                            <div className="text-yellow-300 text-xs pl-2">⚠️ 2 lessons today</div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-black mb-3">No lessons yet.</p>
                )}
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-900">Lesson type (optional)</label>
                    <input
                      type="text"
                      value={lessonNote}
                      onChange={(e) => setLessonNote(e.target.value)}
                      className="w-full border rounded p-1 text-sm"
                      placeholder="e.g., Practical, Theory"
                    />
                  </div>
                  <button
                    onClick={generateLesson}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                  >
                    Generate Lesson
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ⚠️ Max 2 lessons per day. Max total {MAX_LESSONS} lessons. If balance is greater than 0, only first{" "}
                  {MAX_LESSONS_WITH_BALANCE} lessons allowed.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
              Select a student from the list to view details, payments, and lessons.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BranchAccessPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm">Loading...</div>}>
      <BranchAccessContent />
    </Suspense>
  );
}