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
  where,
  onSnapshot,
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
  createdAt?: Date;
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

interface ExamRequest {
  id: string;
  studentId?: string;
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
  isManual?: boolean;
}

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
};

function BranchAccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");

  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  // Exam request state
  const [showExamModal, setShowExamModal] = useState(false);
  const [examStudent, setExamStudent] = useState<Student | null>(null);
  const [examClass, setExamClass] = useState("");
  const [examNote, setExamNote] = useState("");
  const [examRequestLoading, setExamRequestLoading] = useState(false);
  const [examRequestError, setExamRequestError] = useState("");
  const [examRequestSuccess, setExamRequestSuccess] = useState("");

  // Manual exam request state
  const [showManualExamModal, setShowManualExamModal] = useState(false);
  const [manualStudentName, setManualStudentName] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualExamClass, setManualExamClass] = useState("");
  const [manualExamNote, setManualExamNote] = useState("");
  const [manualRequestLoading, setManualRequestLoading] = useState(false);
  const [manualNameError, setManualNameError] = useState("");

  // All exam requests for this branch
  const [allExamRequests, setAllExamRequests] = useState<ExamRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modal visibility for exam requests list
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  // ========== NEW: Report preview modal state ==========
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportHTML, setReportHTML] = useState("");

  const getLocalToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [dailyTotal, setDailyTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  const [dailyBalance, setDailyBalance] = useState(0);
  const [weeklyBalance, setWeeklyBalance] = useState(0);
  const [yearlyBalance, setYearlyBalance] = useState(0);

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

  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // Transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [availableBranches, setAvailableBranches] = useState<
    { id: string; name: string }[]
  >([]);
  const [transferLoading, setTransferLoading] = useState(false);

  const MAX_LESSONS = 20;
  const MAX_LESSONS_WITH_BALANCE = 5;

  const getMinFeeForLessons = (student: Student): number => {
    const primaryClass = student.classes?.[0] || "";
    if (primaryClass === "B1" || primaryClass === "B2") return 8000;
    return 10000;
  };

  const fetchAllExamRequests = async () => {
    if (!branch?.id) return;
    setLoadingRequests(true);
    try {
      const q = query(
        collection(db, "examRequests"),
        where("branchId", "==", branch.id),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const requests: ExamRequest[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt) || new Date(),
        approvedAt: toDate(doc.data().approvedAt) || undefined,
        examDate: toDate(doc.data().examDate) || undefined,
      })) as ExamRequest[];
      setAllExamRequests(requests);
    } catch (err) {
      console.error("Failed to load exam requests", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // REAL-TIME STUDENT LISTENER
  useEffect(() => {
    if (!branch?.id) return;

    const studentsRef = collection(db, "branches", branch.id, "students");
    const unsubscribeStudents = onSnapshot(studentsRef, async (snapshot) => {
      const studentsList: Student[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const studentId = docSnap.id;

        const paymentsRef = collection(
          db,
          "branches",
          branch.id,
          "students",
          studentId,
          "payments"
        );
        const paymentsSnapshot = await getDocs(
          query(paymentsRef, orderBy("date", "desc"))
        );
        const payments: Payment[] = paymentsSnapshot.docs.map((p) => {
          const pData = p.data();
          return {
            id: p.id,
            amount: pData.amount,
            date: toDate(pData.date) || new Date(),
            note: pData.note,
            method: pData.method,
            reference: pData.reference,
          };
        });

        const lessonsRef = collection(
          db,
          "branches",
          branch.id,
          "students",
          studentId,
          "lessons"
        );
        const lessonsSnapshot = await getDocs(
          query(lessonsRef, orderBy("date", "desc"))
        );
        const lessons: Lesson[] = lessonsSnapshot.docs.map((l) => {
          const lData = l.data();
          return {
            id: l.id,
            date: toDate(lData.date) || new Date(),
            type: lData.type,
          };
        });

        studentsList.push({
          id: studentId,
          name: data.name || "No name",
          feePaid: Number(data.feePaid) || 0,
          totalFee: data.totalFee || 0,
          phone: data.phone || "",
          accountNumber: data.accountNumber || data.studentAccountId || "N/A",
          classes: data.classes || [],
          idNumber: data.idNumber || "",
          payments,
          lessons,
          createdAt: toDate(data.createdAt) || undefined,
        });
      }
      setStudents(studentsList);
    }, (err) => {
      console.error("Real-time student listener error:", err);
      setError("Failed to load students in real-time.");
    });

    return () => unsubscribeStudents();
  }, [branch?.id]);

  // Initial verification and branch setup
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

        await fetchAllExamRequests();
      } catch (err: any) {
        setError(err.message || "Invalid or expired invitation.");
      } finally {
        setLoading(false);
      }
    };

    verifyAndFetch();
  }, [token]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch("/api/branches/list");
        const data = await res.json();
        if (data.branches && branch?.id) {
          setAvailableBranches(
            data.branches.filter((b: any) => b.id !== branch.id)
          );
        }
      } catch (err) {
        console.error("Could not fetch branches");
      }
    };
    if (showTransferModal) fetchBranches();
  }, [showTransferModal, branch?.id]);

  // Revenue balances
  useEffect(() => {
    if (!selectedDate) {
      setDailyTotal(0);
      setWeeklyTotal(0);
      setYearlyTotal(0);
      return;
    }

    const referenceDate = new Date(selectedDate);
    if (isNaN(referenceDate.getTime())) return;

    const dailyTarget = selectedDate;
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const targetYear = referenceDate.getFullYear();

    let daily = 0,
      weekly = 0,
      yearly = 0;
    students.forEach((student) => {
      student.payments?.forEach((payment) => {
        const paymentDate = payment.date;
        const localDateStr = paymentDate.toLocaleDateString("en-CA");
        if (localDateStr === dailyTarget) daily += payment.amount;
        if (paymentDate >= startOfWeek && paymentDate <= endOfWeek)
          weekly += payment.amount;
        if (paymentDate.getFullYear() === targetYear) yearly += payment.amount;
      });
    });
    setDailyTotal(daily);
    setWeeklyTotal(weekly);
    setYearlyTotal(yearly);
  }, [selectedDate, students]);

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

    const endOfDay = new Date(referenceDate);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const targetYear = referenceDate.getFullYear();
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    let daily = 0,
      weekly = 0,
      yearly = 0;
    students.forEach((student) => {
      const totalFee = student.totalFee || 0;
      const paymentsUpToDay =
        student.payments?.reduce(
          (sum, p) => (p.date <= endOfDay ? sum + p.amount : sum),
          0
        ) || 0;
      const dayBalance = totalFee - paymentsUpToDay;
      if (dayBalance > 0) daily += dayBalance;

      const paymentsUpToWeek =
        student.payments?.reduce(
          (sum, p) => (p.date <= endOfWeek ? sum + p.amount : sum),
          0
        ) || 0;
      const weekBalance = totalFee - paymentsUpToWeek;
      if (weekBalance > 0) weekly += weekBalance;

      const paymentsUpToYear =
        student.payments?.reduce(
          (sum, p) => (p.date <= endOfYear ? sum + p.amount : sum),
          0
        ) || 0;
      const yearBalance = totalFee - paymentsUpToYear;
      if (yearBalance > 0) yearly += yearBalance;
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

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.accountNumber &&
        s.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.idNumber && s.idNumber.includes(searchQuery))
  );

  const generateLesson = async () => {
    if (!selectedStudent) return;

    const lessonsTaken = selectedStudent.lessons?.length || 0;
    const balance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;

    if (lessonsTaken >= MAX_LESSONS) {
      setLessonError(
        `❌ Student has already completed ${MAX_LESSONS} lessons (maximum).`
      );
      setLessonSuccess("");
      return;
    }

    if (balance > 0 && lessonsTaken >= MAX_LESSONS_WITH_BALANCE) {
      setLessonError(
        `❌ Student has an outstanding balance of Ksh ${balance}. Please clear the balance first to continue lessons. (Max ${MAX_LESSONS_WITH_BALANCE} lessons allowed with balance.)`
      );
      setLessonSuccess("");
      return;
    }

    const minRequiredFee = getMinFeeForLessons(selectedStudent);
    if (selectedStudent.feePaid < minRequiredFee) {
      setLessonError(
        `❌ Student has paid Ksh ${selectedStudent.feePaid.toLocaleString()} but needs at least Ksh ${minRequiredFee.toLocaleString()} to take lessons. Please pay the required amount first.`
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
      const lessonsRef = collection(
        db,
        "branches",
        branch!.id,
        "students",
        selectedStudent.id,
        "lessons"
      );
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
      setLessonSuccess("✅ Lesson generated successfully!");
      setLessonError("");
      setLessonNote("");
      setTimeout(() => setLessonSuccess(""), 3000);
    } catch (err) {
      setLessonError("Failed to generate lesson.");
    }
  };

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
      const paymentsRef = collection(
        db,
        "branches",
        branch!.id,
        "students",
        selectedStudent.id,
        "payments"
      );
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
      const studentDocRef = doc(
        db,
        "branches",
        branch!.id,
        "students",
        selectedStudent.id
      );
      await updateDoc(studentDocRef, { feePaid: newFeePaid });

      const newPayment: Payment = {
        id: Date.now().toString(),
        amount,
        date: new Date(),
        method: paymentMethod,
        reference: paymentMethod === "mpesa" ? mpesaCode : undefined,
        note:
          paymentMethod === "mpesa" ? `M-Pesa: ${mpesaCode}` : "Cash payment",
      };
      const updatedPayments = [newPayment, ...(selectedStudent.payments || [])];
      setSelectedStudent({
        ...selectedStudent,
        feePaid: newFeePaid,
        payments: updatedPayments,
      });
      setPaymentSuccess(
        `✅ Ksh ${amount} recorded as ${paymentMethod === "mpesa" ? "M-Pesa" : "Cash"}!`
      );
      setPaymentError("");
      setNewPaymentAmount("");
      setMpesaCode("");
      setPaymentMethod("cash");
      setTimeout(() => setPaymentSuccess(""), 3000);
    } catch (err) {
      setPaymentError("Failed to record payment.");
    }
  };

  const handleExamRequest = async () => {
    if (!examStudent || !examClass.trim()) {
      setExamRequestError("Please select exam class.");
      return;
    }
    const lessonCount = examStudent.lessons?.length || 0;
    if (lessonCount < 10) {
      setExamRequestError(
        `❌ Student has only ${lessonCount} lesson(s). Must complete at least 10 lessons before requesting an exam.`
      );
      return;
    }
    setExamRequestLoading(true);
    setExamRequestError("");
    try {
      await addDoc(collection(db, "examRequests"), {
        studentId: examStudent.id,
        studentName: examStudent.name,
        studentIdNumber: examStudent.idNumber || "",
        branchId: branch!.id,
        branchName: branch!.name,
        requestedClass: examClass,
        note: examNote.trim() || "No additional notes",
        status: "pending",
        createdAt: Timestamp.now(),
        isManual: false,
      });
      setExamRequestSuccess("Exam request submitted for admin approval!");
      setTimeout(() => setExamRequestSuccess(""), 3000);
      setShowExamModal(false);
      setExamStudent(null);
      setExamClass("");
      setExamNote("");
      await fetchAllExamRequests();
    } catch (err) {
      setExamRequestError("Failed to submit request. Try again.");
    } finally {
      setExamRequestLoading(false);
    }
  };

  const handleManualExamRequest = async () => {
    setManualNameError("");
    if (!manualStudentName.trim()) {
      setManualNameError("Please enter student name.");
      return;
    }
    const trimmedName = manualStudentName.trim().toLowerCase();
    const matchedStudent = students.find(
      (s) => s.name.toLowerCase() === trimmedName
    );
    if (!matchedStudent) {
      setManualNameError(
        `❌ "${manualStudentName.trim()}" not found in ${branch?.name} records. Please check the spelling or register the student first.`
      );
      return;
    }
    if (manualStudentId.trim()) {
      const providedId = manualStudentId.trim();
      if (matchedStudent.idNumber && matchedStudent.idNumber !== providedId) {
        setManualNameError(
          `❌ ID number mismatch. Student "${matchedStudent.name}" has ID ${matchedStudent.idNumber}. Please correct.`
        );
        return;
      }
    }
    const lessonCount = matchedStudent.lessons?.length || 0;
    if (lessonCount < 10) {
      setManualNameError(
        `❌ Student "${matchedStudent.name}" has only ${lessonCount} lesson(s). Must complete at least 10 lessons before requesting an exam.`
      );
      return;
    }
    if (!manualExamClass) {
      setManualNameError("Please select exam class.");
      return;
    }
    setManualRequestLoading(true);
    try {
      await addDoc(collection(db, "examRequests"), {
        studentName: matchedStudent.name,
        studentIdNumber:
          matchedStudent.idNumber || manualStudentId.trim() || "Not provided",
        branchId: branch!.id,
        branchName: branch!.name,
        requestedClass: manualExamClass,
        note: manualExamNote.trim() || "Manual entry from branch",
        status: "pending",
        createdAt: Timestamp.now(),
        isManual: true,
      });
      alert("✅ Exam List request submitted for admin approval!");
      setShowManualExamModal(false);
      setManualStudentName("");
      setManualStudentId("");
      setManualExamClass("");
      setManualExamNote("");
      setManualNameError("");
      await fetchAllExamRequests();
    } catch (err) {
      setManualNameError("Failed to submit request. Try again.");
    } finally {
      setManualRequestLoading(false);
    }
  };

  // ---------- PRINT FUNCTIONS (modified to show preview modal) ----------
  const printReceipt = (payment: Payment) => {
    if (!selectedStudent) return;
    const remainingBalance =
      (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Payment Receipt</title></head>
        <body style="font-family: monospace; padding: 20px; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 10px 0 20px 0; font-size: 1.1em;">
            🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
          </p>
          <h2>${branch?.name} - Payment Receipt</h2>
          <hr/>
          <div style="text-align: left;">
            <p><strong>Student:</strong> ${selectedStudent.name}</p>
            <p><strong>Admission No:</strong> ${selectedStudent.accountNumber}</p>
            <p><strong>Date:</strong> ${payment.date.toLocaleDateString()}</p>
            <p><strong>Amount:</strong> Ksh ${payment.amount.toLocaleString()}</p>
            <p><strong>Method:</strong> ${payment.method === "mpesa" ? "M-Pesa" : "Cash"}</p>
            ${payment.reference ? `<p><strong>M-Pesa Code:</strong> ${payment.reference}</p>` : ""}
            <p><strong>Remaining Balance:</strong> Ksh ${remainingBalance.toLocaleString()}</p>
            <p><strong>Received by:</strong> ${branch?.name} Admin</p>
          </div>
          <hr/>
          <p>Thank you for your payment!</p>
          <button onclick="window.print();window.close();">Print Receipt</button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printLessonTicket = (lesson: Lesson) => {
    if (!selectedStudent) return;

    const allLessons = [...(selectedStudent.lessons || [])];
    allLessons.sort((a, b) => a.date.getTime() - b.date.getTime());
    const lessonIndex = allLessons.findIndex((l) => l.id === lesson.id);
    const lessonNumber = lessonIndex + 1;

    const remainingBalance =
      (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const completionMessage =
      lessonNumber === 20
        ? "🎉 Your lessons are finished! You can now go for NTSA government exams. Good luck! 🚗✅"
        : "Valid for one lesson. Please present this ticket.";

    printWindow.document.write(`
      <html>
        <head><title>Lesson Ticket</title></head>
        <body style="font-family: monospace; padding: 20px; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 10px 0 20px 0; font-size: 1.1em;">
            🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
          </p>
          <h2>${branch?.name} - Lesson Ticket</h2>
          <hr/>
          <div style="text-align: left;">
            <p><strong>Student:</strong> ${selectedStudent.name}</p>
            <p><strong>Admission No:</strong> ${selectedStudent.accountNumber}</p>
            <p><strong>Date:</strong> ${lesson.date.toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${lesson.date.toLocaleTimeString()}</p>
            <p><strong>Lesson Type:</strong> ${lesson.type || "General"}</p>
            <p><strong>Lesson Number:</strong> ${lessonNumber}</p>
            <p><strong>Remaining Balance:</strong> Ksh ${remainingBalance.toLocaleString()}</p>
          </div>
          <hr/>
          <p>${completionMessage}</p>
          <button onclick="window.print();window.close();">Print Ticket</button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ---------- MODIFIED REPORT FUNCTIONS (show preview modal first) ----------
  const generateReport = () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Please select both From and To dates.");
      return;
    }

    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);

    let totalPaidInPeriod = 0;
    let totalOutstandingAsOfEnd = 0;
    let enrolledStudentsOutstanding = 0;
    let enrolledCount = 0;
    const studentReports: {
      name: string;
      account: string;
      phone: string;
      paidInPeriod: number;
      outstandingAsOfEnd: number;
    }[] = [];

    students.forEach((student) => {
      let paidInRange = 0;
      let paymentsUpToEnd = 0;

      if (student.payments && student.payments.length > 0) {
        for (const p of student.payments) {
          if (p.date >= start && p.date <= end) {
            paidInRange += p.amount;
          }
          if (p.date <= end) {
            paymentsUpToEnd += p.amount;
          }
        }
      }

      const totalFee = student.totalFee || 0;
      let outstandingAsOfEnd = totalFee - paymentsUpToEnd;
      if (outstandingAsOfEnd < 0) outstandingAsOfEnd = 0;

      totalPaidInPeriod += paidInRange;
      totalOutstandingAsOfEnd += outstandingAsOfEnd;

      if (student.createdAt) {
        const enrollmentDate = new Date(student.createdAt);
        if (enrollmentDate >= start && enrollmentDate <= end) {
          const currentBalance = (student.totalFee || 0) - student.feePaid;
          enrolledStudentsOutstanding += currentBalance > 0 ? currentBalance : 0;
          enrolledCount++;
        }
      }

      studentReports.push({
        name: student.name,
        account: student.accountNumber || "N/A",
        phone: student.phone || "N/A",
        paidInPeriod: paidInRange,
        outstandingAsOfEnd: outstandingAsOfEnd,
      });
    });

    const html = `
      <html>
        <head><title>Debt & Revenue Report</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
            🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
          </p>
          <h2 style="text-align: center;">${branch?.name} - Financial Report (Payments in Period)</h2>
          <p><strong>Period:</strong> ${reportStartDate} to ${reportEndDate}</p>
          <hr/>
          <h3>Summary</h3>
          <p><strong>Total Payments Collected:</strong> Ksh ${totalPaidInPeriod.toLocaleString()}</p>
          <p><strong>Total Outstanding (all students, as of end date):</strong> Ksh ${totalOutstandingAsOfEnd.toLocaleString()}</p>
          <p><strong>Total Outstanding (students enrolled in period):</strong> Ksh ${enrolledStudentsOutstanding.toLocaleString()} (${enrolledCount} students)</p>
          <hr/>
          <h3>Student Details</h3>
          <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <thead style="background-color: #f2f2f2;">
              <tr><th>Name</th><th>Admission No</th><th>Phone</th><th>Paid (Period)</th><th>Outstanding (as of end date)</th></tr>
            </thead>
            <tbody>
              ${studentReports.map(s => `
                <tr><td style="padding: 4px;">${s.name}</td><td style="padding: 4px;">${s.account}</td><td style="padding: 4px;">${s.phone}</td><td style="padding: 4px; text-align: right;">Ksh ${s.paidInPeriod.toLocaleString()}</td><td style="padding: 4px; text-align: right;">Ksh ${s.outstandingAsOfEnd.toLocaleString()}</td></tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr><td colspan="3"><strong>TOTALS:</strong></td><td style="text-align: right;"><strong>Ksh ${totalPaidInPeriod.toLocaleString()}</strong></td><td style="text-align: right;"><strong>Ksh ${totalOutstandingAsOfEnd.toLocaleString()}</strong></td></tr>
            </tfoot>
          </table>
          <button onclick="window.print();window.close();" style="margin-top: 20px;">Print Report</button>
        </body>
      </html>
    `;
    setReportHTML(html);
    setShowReportModal(true);
  };

  const printEnrolledStudentsReport = () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Please select both From and To dates.");
      return;
    }

    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999);

    const enrolledStudents = students.filter((student) => {
      if (!student.createdAt) return false;
      const enrollmentDate = new Date(student.createdAt);
      return enrollmentDate >= start && enrollmentDate <= end;
    });

    if (enrolledStudents.length === 0) {
      alert("No students were enrolled in the selected date range.");
      return;
    }

    enrolledStudents.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

    let totalFees = 0,
      totalPaid = 0,
      totalBalance = 0;
    enrolledStudents.forEach((student) => {
      const fee = student.totalFee || 0;
      const paid = student.feePaid;
      const balance = fee - paid;
      totalFees += fee;
      totalPaid += paid;
      totalBalance += balance > 0 ? balance : 0;
    });

    const currentDate = new Date().toLocaleDateString();
    const html = `
      <html>
        <head><title>Students Enrolled in Period</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
            🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
          </p>
          <h2 style="text-align: center;">${branch?.name} - Students Enrolled in Period</h2>
          <p style="text-align: center;"><strong>Enrollment Period:</strong> ${reportStartDate} to ${reportEndDate}</p>
          <p style="text-align: center;"><strong>Report Date:</strong> ${currentDate}</p>
          <hr/>
          <h3>Summary</h3>
          <p><strong>Total Students Enrolled:</strong> ${enrolledStudents.length}</p>
          <p><strong>Total Fees (All Time):</strong> Ksh ${totalFees.toLocaleString()}</p>
          <p><strong>Total Paid (All Time):</strong> Ksh ${totalPaid.toLocaleString()}</p>
          <p><strong>Total Outstanding Balance:</strong> Ksh ${totalBalance.toLocaleString()}</p>
          <hr/>
          <h3>Student List</h3>
          <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <thead style="background-color: #f2f2f2;">
              <tr><th>#</th><th>Name</th><th>Admission No</th><th>Phone</th><th>Enrollment Date</th><th>Total Fee (Ksh)</th><th>Paid (Ksh)</th><th>Balance (Ksh)</th></tr>
            </thead>
            <tbody>
              ${enrolledStudents.map((student, idx) => {
                const fee = student.totalFee || 0;
                const paid = student.feePaid;
                const balance = fee - paid;
                const enrollDate = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "Unknown";
                return `
                  <tr><td style="text-align: center;">${idx+1}${student.name}</td><td style="padding: 4px;">${student.name}</td><td>${student.accountNumber || "N/A"}</td><td>${student.phone || "N/A"}</td><td>${enrollDate}<td><td style="text-align: right;">Ksh ${fee.toLocaleString()}</td><td style="text-align: right;">Ksh ${paid.toLocaleString()}</td><td style="text-align: right; font-weight: bold; color: ${balance > 0 ? "#d9534f" : "#28a745"};">Ksh ${balance.toLocaleString()}</td></tr>
                `;
              }).join("")}
            </tbody>
            <tfoot style="background-color: #f9f9f9;"><tr><td colspan="5" style="text-align: right;"><strong>TOTALS:</strong></td><td style="text-align: right;"><strong>Ksh ${totalFees.toLocaleString()}</strong></td><td style="text-align: right;"><strong>Ksh ${totalPaid.toLocaleString()}</strong></td><td style="text-align: right;"><strong>Ksh ${totalBalance.toLocaleString()}</strong></td></tr></tfoot>
          </table>
          <hr/><p style="text-align: center;">This report includes only students whose enrollment date falls within the selected period.</p>
          <button onclick="window.print();window.close();" style="display: block; margin: 20px auto; padding: 8px 16px;">Print Report</button>
        </body>
      </html>
    `;
    setReportHTML(html);
    setShowReportModal(true);
  };

  const printStudentsWithBalance = () => {
    const studentsWithBalance = students.filter((student) => {
      const balance = (student.totalFee || 0) - student.feePaid;
      return balance > 0;
    });

    if (studentsWithBalance.length === 0) {
      alert("No students have outstanding balances.");
      return;
    }

    studentsWithBalance.sort((a, b) => {
      const balanceA = (a.totalFee || 0) - a.feePaid;
      const balanceB = (b.totalFee || 0) - b.feePaid;
      return balanceB - balanceA;
    });

    const totalOutstanding = studentsWithBalance.reduce(
      (sum, student) => sum + ((student.totalFee || 0) - student.feePaid),
      0
    );
    const currentDate = new Date().toLocaleDateString();

    const html = `
      <html>
        <head><title>Students with Outstanding Balance</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
            🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
          </p>
          <h2 style="text-align: center;">${branch?.name} - Students with Outstanding Balance</h2>
          <p style="text-align: center;"><strong>Report Date:</strong> ${currentDate}</p>
          <hr/>
          <h3>Summary</h3>
          <p><strong>Total Students with Balance:</strong> ${studentsWithBalance.length}</p>
          <p><strong>Total Outstanding Amount:</strong> Ksh ${totalOutstanding.toLocaleString()}</p>
          <hr/>
          <h3>Student List</h3>
          <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <thead style="background-color: #f2f2f2;">
              <tr><th>#</th><th>Name</th><th>Admission No</th><th>Phone</th><th>Total Fee (Ksh)</th><th>Paid (Ksh)</th><th>Balance (Ksh)</th></tr>
            </thead>
            <tbody>
              ${studentsWithBalance.map((student, idx) => {
                const totalFee = student.totalFee || 0;
                const paid = student.feePaid;
                const balance = totalFee - paid;
                return `
                  <tr><td style="text-align: center;">${idx+1}${student.name}</td><td style="padding: 4px;">${student.name}</td><td style="padding: 4px;">${student.accountNumber || "N/A"}</td><td style="padding: 4px;">${student.phone || "N/A"}</td><td style="text-align: right;">Ksh ${totalFee.toLocaleString()}</td><td style="text-align: right;">Ksh ${paid.toLocaleString()}</td><td style="text-align: right; font-weight: bold; color: #d9534f;">Ksh ${balance.toLocaleString()}</td></tr>
                `;
              }).join("")}
            </tbody>
            <tfoot style="background-color: #f9f9f9;"><tr><td colspan="4" style="text-align: right;"><strong>TOTALS:</strong></td><td style="text-align: right;"><strong>Ksh ${studentsWithBalance.reduce((sum, s) => sum + (s.totalFee || 0), 0).toLocaleString()}</strong></td><td style="text-align: right;"><strong>Ksh ${studentsWithBalance.reduce((sum, s) => sum + s.feePaid, 0).toLocaleString()}</strong></td><td style="text-align: right;"><strong>Ksh ${totalOutstanding.toLocaleString()}</strong></td></tr></tfoot>
          </table>
          <hr/><p style="text-align: center;">This report lists all students with unpaid fees. Please follow up for collection.</p>
          <button onclick="window.print();window.close();" style="display: block; margin: 20px auto; padding: 8px 16px;">Print Report</button>
        </body>
      </html>
    `;
    setReportHTML(html);
    setShowReportModal(true);
  };

  // Helper to open print window from modal
  const handlePrintFromModal = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
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
            {passwordError && (
              <p className="text-red-500 text-xs mb-3">{passwordError}</p>
            )}
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
  const totalOutstanding = students.reduce(
    (sum, s) => sum + ((s.totalFee || 0) - s.feePaid),
    0
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-white max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-orange-600 to-white rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          {branch?.name} Dashboard
        </h1>
        <p className="text-indigo-100 text-xs sm:text-sm mt-0.5 sm:mt-1">
          Branch overview & student management
        </p>
      </div>

      {/* Date Range Report Section */}
      <div className="bg-gray-600 rounded-lg shadow p-4 mb-5 border border-gray-600">
        <h3 className="font-semibold text-md mb-2">
          📊 Reports (select date range)
        </h3>
        <div className="flex flex-wrap gap-3 items-end text-blue-600">
          <div>
            <label className="block text-xs bg-amber-300 text-white p-1.5 rounded">
              From Date
            </label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="border p-1.5 rounded text-sm text-red-950 bg-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs bg-amber-600 text-white p-1.5 rounded">
              To Date
            </label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="border p-1.5 rounded text-sm text-red-950 bg-gray-300"
            />
          </div>
          <button
            onClick={generateReport}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            📆 Payments in Period
          </button>
          <button
            onClick={printEnrolledStudentsReport}
            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
          >
            📋 Students Enrolled in Period
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-2">
          *Payments in Period*: shows payments collected in date range (all
          students).<br />
          *Students Enrolled in Period*: shows only students whose enrollment
          date falls between the selected dates, with their full fee summary.
        </p>
        <div className="mt-4 pt-3 border-t border-gray-500 flex flex-wrap gap-3">
          <button
            onClick={printStudentsWithBalance}
            className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700"
          >
            🖨️ Print Students with Balance
          </button>
          <button
            onClick={() => {
              if (!selectedStudent) {
                alert("Please select a student first.");
                return;
              }
              const balance =
                (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
              if (balance > 0) {
                alert(
                  "Transfer rejected due to uncleared school fee. Kindly finish payment to proceed with transfer."
                );
                return;
              }
              setShowTransferModal(true);
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded text-sm hover:bg-orange-700"
          >
            🔄 Request Student Transfer
          </button>
          <button
            onClick={() => setShowManualExamModal(true)}
            className="bg-purple-600 text-yellow-950 px-4 py-2 rounded text-sm hover:bg-purple-700"
          >
            📝 Exam List Request
          </button>
          <button
            onClick={() => {
              fetchAllExamRequests();
              setShowRequestsModal(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
          >
            📋 Check Exam Requests
          </button>
        </div>
      </div>

      {/* Existing date filter */}
      <div className="bg-gradient-to-r from-indigo-600 via-orange-600 to-black rounded-lg shadow p-3 sm:p-4 mb-5">
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
            <strong>📅 Daily Collection (Revenue):</strong> Ksh{" "}
            {dailyTotal.toLocaleString()}
          </p>
          <p>
            <strong>📊 Weekly Collection (Revenue):</strong> Ksh{" "}
            {weeklyTotal.toLocaleString()}
          </p>
          <p>
            <strong>📊 Yearly Collection (Revenue):</strong> Ksh{" "}
            {yearlyTotal.toLocaleString()}
          </p>
          <p className="mt-2 pt-2 border-t border-gray-400">
            <strong>⚖️ Daily Outstanding Balance:</strong> Ksh{" "}
            {dailyBalance.toLocaleString()}
          </p>
          <p>
            <strong>⚖️ Weekly Outstanding Balance:</strong> Ksh{" "}
            {weeklyBalance.toLocaleString()}
          </p>
          <p>
            <strong>⚖️ Yearly Outstanding Balance:</strong> Ksh{" "}
            {yearlyBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">Total Students</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-800">
            {students.length}
          </div>
        </div>
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">
            Total Revenue (Fees Paid)
          </div>
          <div className="text-xl sm:text-3xl font-bold text-green-600">
            Ksh {totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="bg-blue-300 rounded-lg shadow p-3 sm:p-5">
          <div className="text-black text-xs sm:text-sm">
            Outstanding Balance
          </div>
          <div className="text-xl sm:text-3xl font-bold text-orange-600">
            Ksh {totalOutstanding.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="🔍 Search by name, admission number, phone, or ID number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border text-amber-700 rounded-lg text-sm"
        />
      </div>

      {/* Student list and detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-indigo-600 via-orange-600 to-white rounded-lg shadow overflow-hidden lg:col-span-1">
          <div className="px-3 py-2 bg-gray-400 border-b">
            <h3 className="font-semibold text-sm">
              Students ({filteredStudents.length})
            </h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                  selectedStudent?.id === student.id
                    ? "bg-indigo-500 border-l-4 border-indigo-500"
                    : ""
                }`}
              >
                <div className="font-medium text-sm">{student.name}</div>
                <div className="text-xs text-gray-700">
                  {student.accountNumber} | {student.phone}
                </div>
                <div className="text-xs font-semibold mt-1">
                  Balance: Ksh{" "}
                  {((student.totalFee || 0) - student.feePaid).toLocaleString()}
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-800">
                No students match
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedStudent ? (
            <>
              {/* Student summary */}
              <div className="bg-gray-700 rounded-lg shadow p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {selectedStudent.name}
                    </h2>
                    <p className="text-xs text-white">
                      Admission: {selectedStudent.accountNumber} | ID:{" "}
                      {selectedStudent.idNumber || "N/A"}
                    </p>
                    <p className="text-xs text-white">
                      Phone: {selectedStudent.phone} | Classes:{" "}
                      {selectedStudent.classes?.join(", ") || "None"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      Total Fee:{" "}
                      <span className="font-semibold">
                        Ksh {selectedStudent.totalFee}
                      </span>
                    </div>
                    <div className="text-sm">
                      Paid:{" "}
                      <span className="font-semibold text-green-500">
                        Ksh {selectedStudent.feePaid}
                      </span>
                    </div>
                    <div className="text-sm font-bold">
                      Balance:{" "}
                      <span
                        className={
                          (selectedStudent.totalFee || 0) -
                            selectedStudent.feePaid >
                          0
                            ? "text-orange-600"
                            : "text-green-600"
                        }
                      >
                        Ksh{" "}
                        {(
                          (selectedStudent.totalFee || 0) -
                          selectedStudent.feePaid
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment history */}
              <div className="bg-[#041A40] rounded-lg shadow p-4">
                <h3 className="font-semibold text-white text-sm mb-2">
                  💰 Payment History
                </h3>
                {selectedStudent.payments &&
                selectedStudent.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedStudent.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center border-b pb-1 text-sm"
                      >
                        <div>
                          <span className="font-medium text-gray-300">
                            Ksh {payment.amount}
                          </span>
                          <span className="text-gray-300 text-xs ml-2">
                            {payment.date.toLocaleDateString()}
                          </span>
                          {payment.method === "mpesa" ? (
                            <span className="text-gray-300 text-xs ml-2">
                              M-Pesa: {payment.reference}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs ml-2">
                              Cash
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => printReceipt(payment)}
                          className="bg-green-500 text-white px-2 py-0.5 rounded text-xs hover:bg-green-800"
                        >
                          Receipt
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white">No payments recorded.</p>
                )}
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 ? (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[100px]">
                        <label className="block text-xs text-white">
                          Amount (Ksh)
                        </label>
                        <input
                          type="number"
                          value={newPaymentAmount}
                          onChange={(e) => setNewPaymentAmount(e.target.value)}
                          className="w-full border rounded p-1 text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-white">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(e.target.value as "mpesa" | "cash")
                          }
                          className="w-full border rounded p-1 text-sm"
                        >
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                        </select>
                      </div>
                      {paymentMethod === "mpesa" && (
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xs text-gray-300">
                            M-Pesa Code
                          </label>
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
                    {paymentError && (
                      <p className="text-red-500 text-xs mt-1">
                        {paymentError}
                      </p>
                    )}
                    {paymentSuccess && (
                      <p className="text-green-600 text-xs mt-1">
                        {paymentSuccess}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-green-300 text-sm font-semibold">
                      ✅ Fully Paid – No further payments required, accept internal exams 1,000.
                    </p>
                  </div>
                )}
              </div>

              {/* Lessons section */}
              <div className="bg-[#041A40] rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">📚 Lessons</h3>
                  <div className="text-sm">
                    <span className="font-medium">
                      Total: {selectedStudent.lessons?.length || 0} /{" "}
                      {MAX_LESSONS}
                    </span>
                    <span
                      className={`ml-2 font-bold ${
                        MAX_LESSONS - (selectedStudent.lessons?.length || 0) <= 5
                          ? "text-red-400"
                          : "text-yellow-200"
                      }`}
                    >
                      Remaining:{" "}
                      {MAX_LESSONS - (selectedStudent.lessons?.length || 0)}
                    </span>
                  </div>
                </div>
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 &&
                  (selectedStudent.lessons?.length || 0) >=
                    MAX_LESSONS_WITH_BALANCE && (
                    <div className="bg-red-900 text-white text-xs p-2 rounded mb-2">
                      ⚠️ Outstanding balance of Ksh{" "}
                      {(
                        (selectedStudent.totalFee || 0) -
                        selectedStudent.feePaid
                      ).toLocaleString()}
                      . Please clear the balance to continue with lessons.{" "}
                      {MAX_LESSONS_WITH_BALANCE}.
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
                      return Object.entries(grouped).map(
                        ([dateStr, lessonsOnDate]) => (
                          <div
                            key={dateStr}
                            className="text-sm border-b border-gray-600 pb-1"
                          >
                            <div className="font-semibold text-gray-300">
                              {dateStr}
                            </div>
                            {lessonsOnDate.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex justify-between pl-2"
                              >
                                <span>{lesson.type || "General"} ✅</span>
                                <span className="text-gray-200 text-xs">
                                  {lesson.date.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <button
                                  onClick={() => printLessonTicket(lesson)}
                                  className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-600"
                                >
                                  Ticket
                                </button>
                              </div>
                            ))}
                            {lessonsOnDate.length === 2 && (
                              <div className="text-yellow-300 text-xs pl-2">
                                ⚠️ 2 lessons today
                              </div>
                            )}
                          </div>
                        )
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-white mb-3">No lessons yet.</p>
                )}
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-200">
                      Lesson type (optional)
                    </label>
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
                  ⚠️ Max 2 lessons per day. Max total {MAX_LESSONS} lessons. If
                  balance is greater than 0, only first{" "}
                  {MAX_LESSONS_WITH_BALANCE} lessons allowed.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  💰 Minimum fee required for lessons: B1/B2 = 8,000 Ksh, other
                  classes = 10,000 Ksh.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
              Select a student from the list to view details, payments, and
              lessons.
            </div>
          )}
        </div>
      </div>

      {/* Exam Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-yellow-500 border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                📋 Exam Requests - {branch?.name}
              </h2>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 bg-gray-600">
              <div className="flex justify-between items-center mb-4 bg-gray-400">
                <p className="text-sm text-gray-600">
                  All exam requests submitted from this branch. Approved
                  requests show the scheduled exam date.
                </p>
                <button
                  onClick={() => fetchAllExamRequests()}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                  Refresh
                </button>
              </div>
              {loadingRequests ? (
                <p className="text-center py-8 text-gray-500">
                  Loading requests...
                </p>
              ) : allExamRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  No exam requests submitted yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 text-sm">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 border">Student Name</th>
                        <th className="px-4 py-2 border">ID Number</th>
                        <th className="px-4 py-2 border">Requested Class</th>
                        <th className="px-4 py-2 border">Request Date</th>
                        <th className="px-4 py-2 border">Status</th>
                        <th className="px-4 py-2 border">
                          Exam Date (if approved)
                        </th>
                        <th className="px-4 py-2 border">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allExamRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-green-500">
                          <td className="px-4 py-2 border">{req.studentName}</td>
                          <td className="px-4 py-2 border">
                            {req.studentIdNumber || "N/A"}
                          </td>
                          <td className="px-4 py-2 border">
                            {req.requestedClass}
                          </td>
                          <td className="px-4 py-2 border">
                            {req.createdAt.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 border">
                            {req.status === "pending" && (
                              <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
                                Pending
                              </span>
                            )}
                            {req.status === "approved" && (
                              <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                                Approved
                              </span>
                            )}
                            {req.status === "rejected" && (
                              <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-semibold">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 border">
                            {req.status === "approved" && req.examDate
                              ? req.examDate.toLocaleDateString()
                              : "-"}
                          </td>
                          <td
                            className="px-4 py-2 border max-w-xs truncate"
                            title={req.note}
                          >
                            {req.note}
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

      {/* Exam Request Modal for existing student */}
      {showExamModal && examStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Request NTSA Exam</h3>
            <p className="mb-2">
              <strong>Student:</strong> {examStudent.name} <br />
              <strong>ID Number:</strong>{" "}
              {examStudent.idNumber || "Not provided"}
            </p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Exam Class
              </label>
              <select
                value={examClass}
                onChange={(e) => setExamClass(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                required
              >
                <option value="">Select class...</option>
                <option value="B1">B1/B2 (Light Vehicle)</option>
                <option value="B2">B1 (Light Vehicle Auto)</option>
                <option value="C1">C1 (Light Truck)</option>
                <option value="C">BC1 (Truck)</option>
                <option value="D1">D1 (PSV)</option>
                <option value="D">A1 (Motorcycle)</option>
                <option value="A">A2 (Motorcycle)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Additional Note (Optional)
              </label>
              <textarea
                value={examNote}
                onChange={(e) => setExamNote(e.target.value)}
                rows={3}
                className="w-full border rounded p-2 text-sm"
                placeholder="Any special instructions for the admin..."
              />
            </div>
            {examRequestError && (
              <p className="text-red-500 text-xs mb-2">{examRequestError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowExamModal(false);
                  setExamStudent(null);
                  setExamClass("");
                  setExamNote("");
                  setExamRequestError("");
                }}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExamRequest}
                disabled={examRequestLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {examRequestLoading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
            {examRequestSuccess && (
              <p className="text-green-600 text-xs mt-2">{examRequestSuccess}</p>
            )}
          </div>
        </div>
      )}

      {/* Manual Exam Request Modal */}
      {showManualExamModal && (
        <div className="fixed inset-0 bg-gray-300 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-green-950 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Exam List Request</h3>
            <p className="text-sm text-gray-400 mb-3">
              Enter student details for exam approval. The student name must
              already exist in your branch records.
            </p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Student Full Name *
              </label>
              <input
                type="text"
                value={manualStudentName}
                onChange={(e) => {
                  setManualStudentName(e.target.value);
                  setManualNameError("");
                }}
                className="w-full border rounded p-2 text-sm"
                placeholder="Exactly as registered in the system"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                ID Number (Optional)
              </label>
              <input
                type="text"
                value={manualStudentId}
                onChange={(e) => setManualStudentId(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                placeholder="Must match the student's ID"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">
                Exam Class *
              </label>
              <select
                value={manualExamClass}
                onChange={(e) => setManualExamClass(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                required
              >
                <option value="">Select class...</option>
                <option value="B1">B1/B2 (Light Vehicle)</option>
                <option value="B2">B1 (Light Vehicle Auto)</option>
                <option value="C1">C1 (Light Truck)</option>
                <option value="C">BC1 (Truck)</option>
                <option value="D1">D1 (PSV)</option>
                <option value="D">A1 (Motorcycle)</option>
                <option value="A">A2 (Motorcycle)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Additional Note (Optional)
              </label>
              <textarea
                value={manualExamNote}
                onChange={(e) => setManualExamNote(e.target.value)}
                rows={3}
                className="w-full border rounded p-2 text-sm"
                placeholder="Any special instructions..."
              />
            </div>
            {manualNameError && (
              <p className="text-red-600 text-xs mb-3 bg-red-50 p-2 rounded border border-red-200">
                ❌ {manualNameError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowManualExamModal(false);
                  setManualStudentName("");
                  setManualStudentId("");
                  setManualExamClass("");
                  setManualExamNote("");
                  setManualNameError("");
                }}
                className="px-4 py-2 border rounded hover:bg-orange-400 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleManualExamRequest}
                disabled={manualRequestLoading}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {manualRequestLoading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-[#052E16] bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Transfer Student</h3>
            <p className="text-sm mb-3">
              Student: <strong>{selectedStudent?.name}</strong>
            </p>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Target Branch
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full border rounded p-2 text-sm"
              >
                <option value="">Select branch...</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Reason for transfer
              </label>
              <textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={3}
                className="w-full border rounded p-2 text-sm"
                placeholder="Explain why this student should be moved..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTargetBranchId("");
                  setTransferReason("");
                }}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!targetBranchId || !transferReason.trim()) {
                    alert("Please fill target branch and reason.");
                    return;
                  }
                  setTransferLoading(true);
                  try {
                    const res = await fetch("/api/transfer/request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        studentId: selectedStudent!.id,
                        fromBranchId: branch!.id,
                        toBranchId: targetBranchId,
                        reason: transferReason,
                      }),
                    });

                    if (res.ok) {
                      alert(
                        "Transfer request submitted. Admin will review it."
                      );
                      setShowTransferModal(false);
                      setTargetBranchId("");
                      setTransferReason("");
                    } else {
                      alert("Failed to submit request.");
                    }
                  } catch (err) {
                    alert("Error submitting request.");
                  } finally {
                    setTransferLoading(false);
                  }
                }}
                disabled={transferLoading}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {transferLoading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== NEW: Report Preview Modal ========== */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-100 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-indigo-700 text-white p-4 flex justify-between items-center rounded-t-lg">
              <h2 className="text-xl font-bold">📄 Report Preview</h2>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-white hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 bg-white">
              {/* Display the report HTML inside an iframe for accurate rendering */}
              <iframe
                srcDoc={reportHTML}
                title="Report Preview"
                className="w-full h-[70vh] border-0 rounded"
                sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
              />
            </div>
            <div className="sticky bottom-0 bg-gray-100 p-4 flex justify-center gap-4 border-t">
              <button
                onClick={handlePrintFromModal}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                🖨️ Print Report
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BranchAccessPage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-center text-sm">Loading...</div>}
    >
      <BranchAccessContent />
    </Suspense>
  );
}