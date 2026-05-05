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
  lessonNumber?: number;
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
  const [branch, setBranch] = useState<{ id: string; name: string } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");

  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  const [showExamModal, setShowExamModal] = useState(false);
  const [examStudent, setExamStudent] = useState<Student | null>(null);
  const [examClass, setExamClass] = useState("");
  const [examNote, setExamNote] = useState("");
  const [examRequestLoading, setExamRequestLoading] = useState(false);
  const [examRequestError, setExamRequestError] = useState("");
  const [examRequestSuccess, setExamRequestSuccess] = useState("");

  const [showManualExamModal, setShowManualExamModal] = useState(false);
  const [manualStudentName, setManualStudentName] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualExamClass, setManualExamClass] = useState("");
  const [manualExamNote, setManualExamNote] = useState("");
  const [manualRequestLoading, setManualRequestLoading] = useState(false);
  const [manualNameError, setManualNameError] = useState("");

  const [allExamRequests, setAllExamRequests] = useState<ExamRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportHTML, setReportHTML] = useState("");
  const [currentReportData, setCurrentReportData] = useState<{ headers: string[]; rows: any[][] } | null>(null);

  const getLocalToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [rangeStartDate, setRangeStartDate] = useState(() => {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    return firstDayOfMonth.toISOString().split("T")[0];
  });
  const [rangeEndDate, setRangeEndDate] = useState(getLocalToday);
  const [rangeTotalPayments, setRangeTotalPayments] = useState(0);
  const [rangeEndBalance, setRangeEndBalance] = useState(0);
  const [rangeLessonsCount, setRangeLessonsCount] = useState(0);

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

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [availableBranches, setAvailableBranches] = useState<{ id: string; name: string }[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);

  const [instructorCode, setInstructorCode] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [instructorError, setInstructorError] = useState("");

  const MAX_LESSONS = 20;
  const MAX_LESSONS_WITH_BALANCE = 5;
  const getMinFeeForLessons = (student: Student): number => {
    const primaryClass = student.classes?.[0] || "";
    if (primaryClass === "B1/B2") return 8000;
    if (primaryClass === "B1") return 8000;
    if (primaryClass === "BC1") return 10000;
    return 0;
  };

  // Helper to get current week's Monday and Sunday
  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  };

  // NEW: state for current week summary (computed automatically, not user‑selectable)
  const [weekSummary, setWeekSummary] = useState({
    totalPayments: 0,
    endBalance: 0,
    lessonsCount: 0,
  });

  // Effect to calculate summary for the current week (runs on students change)
  useEffect(() => {
    const { start, end } = getCurrentWeekRange();

    let totalPayments = 0;
    let totalOutstanding = 0;
    let lessonsCount = 0;

    students.forEach((student) => {
      let paymentsUpToEnd = 0;
      if (student.payments) {
        for (const p of student.payments) {
          if (p.date >= start && p.date <= end) {
            totalPayments += p.amount;
          }
          if (p.date <= end) {
            paymentsUpToEnd += p.amount;
          }
        }
      }
      if (student.lessons) {
        for (const l of student.lessons) {
          if (l.date >= start && l.date <= end) {
            lessonsCount++;
          }
        }
      }
      const totalFee = student.totalFee || 0;
      const balance = totalFee - paymentsUpToEnd;
      if (balance > 0) totalOutstanding += balance;
    });

    setWeekSummary({
      totalPayments,
      endBalance: totalOutstanding,
      lessonsCount,
    });
  }, [students]);

  // Original effect for manual range (still used by reports – unchanged)
  useEffect(() => {
    if (!rangeStartDate || !rangeEndDate) {
      setRangeTotalPayments(0);
      setRangeEndBalance(0);
      setRangeLessonsCount(0);
      return;
    }
    const start = new Date(rangeStartDate);
    const end = new Date(rangeEndDate);
    end.setHours(23, 59, 59, 999);
    let totalPayments = 0;
    let totalOutstanding = 0;
    let lessonsCount = 0;
    students.forEach((student) => {
      let paymentsUpToEnd = 0;
      if (student.payments) {
        for (const p of student.payments) {
          if (p.date >= start && p.date <= end) totalPayments += p.amount;
          if (p.date <= end) paymentsUpToEnd += p.amount;
        }
      }
      if (student.lessons) {
        for (const l of student.lessons) {
          if (l.date >= start && l.date <= end) lessonsCount++;
        }
      }
      const totalFee = student.totalFee || 0;
      const balance = totalFee - paymentsUpToEnd;
      if (balance > 0) totalOutstanding += balance;
    });
    setRangeTotalPayments(totalPayments);
    setRangeEndBalance(totalOutstanding);
    setRangeLessonsCount(lessonsCount);
  }, [rangeStartDate, rangeEndDate, students]);

  const fetchAllExamRequests = async () => {
    if (!branch?.id) return;
    setLoadingRequests(true);
    try {
      const q = query(collection(db, "examRequests"), where("branchId", "==", branch.id), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const requests: ExamRequest[] = snapshot.docs.map((doc) => ({
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

  useEffect(() => {
    if (!branch?.id) return;
    const studentsRef = collection(db, "branches", branch.id, "students");
    const unsubscribeStudents = onSnapshot(
      studentsRef,
      async (snapshot) => {
        const studentsList: Student[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const studentId = docSnap.id;
          const paymentsRef = collection(db, "branches", branch.id, "students", studentId, "payments");
          const paymentsSnapshot = await getDocs(query(paymentsRef, orderBy("date", "desc")));
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
          const lessonsRef = collection(db, "branches", branch.id, "students", studentId, "lessons");
          const lessonsSnapshot = await getDocs(query(lessonsRef, orderBy("date", "desc")));
          const lessons: Lesson[] = lessonsSnapshot.docs.map((l) => {
            const lData = l.data();
            return {
              id: l.id,
              date: toDate(lData.date) || new Date(),
              type: lData.type,
              lessonNumber: lData.lessonNumber,
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
      },
      (err) => {
        console.error("Real-time student listener error:", err);
        setError("Failed to load students in real-time.");
      }
    );
    return () => unsubscribeStudents();
  }, [branch?.id]);

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
          setAvailableBranches(data.branches.filter((b: any) => b.id !== branch.id));
        }
      } catch (err) {
        console.error("Could not fetch branches");
      }
    };
    if (showTransferModal) fetchBranches();
  }, [showTransferModal, branch?.id]);

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
      (s.accountNumber && s.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.idNumber && s.idNumber.includes(searchQuery))
  );

  const generateLesson = async () => {
    if (!selectedStudent) return;
    if (!instructorCode.trim() || !carNumber.trim()) {
      setInstructorError("❌ Please enter instructor code and car number.");
      return;
    }
    try {
      const instructorRef = doc(db, "instructors", instructorCode.trim().toUpperCase());
      const instructorSnap = await getDoc(instructorRef);
      if (!instructorSnap.exists()) {
        setInstructorError("❌ Invalid instructor code. Please check and try again.");
        return;
      }
      const instructorData = instructorSnap.data();
      const validCars = instructorData.carNumbers || [];
      if (!validCars.includes(carNumber.trim().toUpperCase())) {
        setInstructorError(`❌ Car number "${carNumber}" is not assigned to instructor ${instructorData.name}.`);
        return;
      }
      setInstructorError("");
    } catch (err) {
      setInstructorError("❌ Failed to validate instructor. Please try again.");
      return;
    }
    const lessonsTaken = selectedStudent.lessons?.length || 0;
    const balance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
    if (lessonsTaken >= MAX_LESSONS) {
      setLessonError(`❌ Student has already completed ${MAX_LESSONS} lessons (maximum).`);
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
    const lessonsToday = selectedStudent.lessons?.filter((l) => {
      const lessonDate = new Date(l.date);
      lessonDate.setHours(0, 0, 0, 0);
      return lessonDate.getTime() === today.getTime();
    }) || [];
    if (lessonsToday.length >= 2) {
      setLessonError("❌ Student cannot take more than 2 lessons per day.");
      setLessonSuccess("");
      return;
    }
    const lessonNumber = lessonsTaken + 1;
    try {
      const lessonsRef = collection(db, "branches", branch!.id, "students", selectedStudent.id, "lessons");
      await addDoc(lessonsRef, {
        date: Timestamp.now(),
        type: lessonNote || "General",
        lessonNumber: lessonNumber,
      });
      const newLesson: Lesson = {
        id: Date.now().toString(),
        date: new Date(),
        type: lessonNote,
        lessonNumber,
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
      const paymentsRef = collection(db, "branches", branch!.id, "students", selectedStudent.id, "payments");
      const paymentData: any = { amount, date: Timestamp.now(), method: paymentMethod };
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
      setSelectedStudent({ ...selectedStudent, feePaid: newFeePaid, payments: updatedPayments });
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

  const handleExamRequest = async () => {
    if (!examStudent || !examClass.trim()) {
      setExamRequestError("Please select exam class.");
      return;
    }
    const lessonCount = examStudent.lessons?.length || 0;
    if (lessonCount < 10) {
      setExamRequestError(`❌ Student has only ${lessonCount} lesson(s). Must complete at least 10 lessons before requesting an exam.`);
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
    const matchedStudent = students.find((s) => s.name.toLowerCase() === trimmedName);
    if (!matchedStudent) {
      setManualNameError(`❌ "${manualStudentName.trim()}" not found in ${branch?.name} records. Please check the spelling or register the student first.`);
      return;
    }
    if (manualStudentId.trim()) {
      const providedId = manualStudentId.trim();
      if (matchedStudent.idNumber && matchedStudent.idNumber !== providedId) {
        setManualNameError(`❌ ID number mismatch. Student "${matchedStudent.name}" has ID ${matchedStudent.idNumber}. Please correct.`);
        return;
      }
    }
    const lessonCount = matchedStudent.lessons?.length || 0;
    if (lessonCount < 10) {
      setManualNameError(`❌ Student "${matchedStudent.name}" has only ${lessonCount} lesson(s). Must complete at least 10 lessons before requesting an exam.`);
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
        studentIdNumber: matchedStudent.idNumber || manualStudentId.trim() || "Not provided",
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

  const printReceipt = (payment: Payment) => {
    if (!selectedStudent) return;
    const remainingBalance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
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
            🚗 Start your journey with Harmflow Driving School – where safety meets confidence.
Every great driver begins with the right foundation. Our slogan says it all: 🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
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
    const lessonNumber = lesson.lessonNumber || lessonIndex + 1;
    const remainingBalance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const completionMessage = lessonNumber === 20
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
            🚗 Start your journey with Harmflow Driving School – where safety meets confidence.
Every great driver begins with the right foundation. Our slogan says it all: 🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
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
    const studentReports: { name: string; account: string; phone: string; paidInPeriod: number; outstandingAsOfEnd: number }[] = [];
    students.forEach((student) => {
      let paidInRange = 0;
      let paymentsUpToEnd = 0;
      if (student.payments && student.payments.length > 0) {
        for (const p of student.payments) {
          if (p.date >= start && p.date <= end) paidInRange += p.amount;
          if (p.date <= end) paymentsUpToEnd += p.amount;
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
    const headers = ["Name", "Admission No", "Phone", "Paid (Period)", "Outstanding (as of end date)"];
    const rows = studentReports.map((s) => [s.name, s.account, s.phone, `Ksh ${s.paidInPeriod.toLocaleString()}`, `Ksh ${s.outstandingAsOfEnd.toLocaleString()}`]);
    rows.push(["", "", "", "", ""]);
    rows.push(["", "", "", "Total Paid (Period):", `Ksh ${totalPaidInPeriod.toLocaleString()}`]);
    rows.push(["", "", "", "Total Outstanding (as of end):", `Ksh ${totalOutstandingAsOfEnd.toLocaleString()}`]);
    rows.push(["", "", "", "Outstanding (enrolled in period):", `Ksh ${enrolledStudentsOutstanding.toLocaleString()} (${enrolledCount} students)`]);
    setCurrentReportData({ headers, rows });
    const currentDate = new Date().toLocaleDateString();
    const html = `
<!DOCTYPE html>
<html>
<head><title>Financial Report</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <div style="display: flex; justify-content: center; margin-bottom: 15px;">
    <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
  </div>
  <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
    🚗 Start your journey with Harmflow Driving School – where safety meets confidence.
Every great driver begins with the right foundation. Our slogan says it all: 🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
  </p>
  <h2 style="text-align: center;">${branch?.name} - Financial Report (Payments in Period)</h2>
  <p style="text-align: center;"><strong>Period:</strong> ${reportStartDate} to ${reportEndDate}</p>
  <p style="text-align: center;"><strong>Report Date:</strong> ${currentDate}</p>
  <hr/>
  <h3>Summary</h3>
  <p><strong>Total Payments Collected:</strong> Ksh ${totalPaidInPeriod.toLocaleString()}</p>
  <p><strong>Total Outstanding (all students, as of end date):</strong> Ksh ${totalOutstandingAsOfEnd.toLocaleString()}</p>
  <p><strong>Total Outstanding (students enrolled in period):</strong> Ksh ${enrolledStudentsOutstanding.toLocaleString()} (${enrolledCount} students)</p>
  <hr/>
  <h3>Student Details</h3>
  <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
    <thead style="background-color: #f2f2f2;">
        <tr>
          <th>Name</th>
          <th>Admission No</th>
          <th>Phone</th>
          <th>Paid (Period)</th>
          <th>Outstanding (as of end date)</th>
        </tr>
    </thead>
    <tbody>
      ${studentReports
        .map(
          (s) => `
          <tr>
            <td style="padding: 4px;">${s.name}</td>
            <td style="padding: 4px;">${s.account}</td>
            <td style="padding: 4px;">${s.phone}</td>
            <td style="padding: 4px; text-align: right;">Ksh ${s.paidInPeriod.toLocaleString()}</td>
            <td style="padding: 4px; text-align: right;">Ksh ${s.outstandingAsOfEnd.toLocaleString()}</td>
          </tr>
        `
        )
        .join("")}
    </tbody>
    <tfoot style="background-color: #f9f9f9;">
      <tr>
        <td colspan="3"><strong>TOTALS:</strong></td>
        <td style="text-align: right;"><strong>Ksh ${totalPaidInPeriod.toLocaleString()}</strong></td>
        <td style="text-align: right;"><strong>Ksh ${totalOutstandingAsOfEnd.toLocaleString()}</strong></td>
      </tr>
    </tfoot>
  </table>
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
    const headers = ["#", "Name", "Admission No", "Phone", "Enrollment Date", "Total Fee (Ksh)", "Paid (Ksh)", "Balance (Ksh)"];
    const rows = enrolledStudents.map((student, idx) => {
      const fee = student.totalFee || 0;
      const paid = student.feePaid;
      const balance = fee - paid;
      const enrollDate = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "Unknown";
      return [idx + 1, student.name, student.accountNumber || "N/A", student.phone || "N/A", enrollDate, `Ksh ${fee.toLocaleString()}`, `Ksh ${paid.toLocaleString()}`, `Ksh ${balance.toLocaleString()}`];
    });
    rows.push(["", "", "", "", "", "", "", ""]);
    rows.push(["", "", "", "", "TOTALS:", `Ksh ${totalFees.toLocaleString()}`, `Ksh ${totalPaid.toLocaleString()}`, `Ksh ${totalBalance.toLocaleString()}`]);
    setCurrentReportData({ headers, rows });
    const currentDate = new Date().toLocaleDateString();
    const html = `
      <html>
        <head><title>Students Enrolled in Period</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
            🚗 Start your journey with Harmflow Driving School – where safety meets confidence.
Every great driver begins with the right foundation. Our slogan says it all: 🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
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
            <thead style="background-color: #f2f2f2;"><tr><th>#</th><th>Name</th><th>Admission No</th><th>Phone</th><th>Enrollment Date</th><th>Total Fee (Ksh)</th><th>Paid (Ksh)</th><th>Balance (Ksh)</th><tr></thead>
            <tbody>
              ${enrolledStudents
                .map((student, idx) => {
                  const fee = student.totalFee || 0;
                  const paid = student.feePaid;
                  const balance = fee - paid;
                  const enrollDate = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : "Unknown";
                  return `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="padding: 4px;">${student.name}</td>
                    <td style="padding: 4px;">${student.accountNumber || "N/A"}</td>
                    <td style="padding: 4px;">${student.phone || "N/A"}</td>
                    <td style="padding: 4px;">${enrollDate}</td>
                    <td style="text-align: right;">Ksh ${fee.toLocaleString()}</td>
                    <td style="text-align: right;">Ksh ${paid.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; color: ${balance > 0 ? "#d9534f" : "#28a745"};">Ksh ${balance.toLocaleString()}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
            <tfoot style="background-color: #f9f9f9;">
              <tr>
                <td colspan="5" style="text-align: right;"><strong>TOTALS:</strong></td>
                <td style="text-align: right;"><strong>Ksh ${totalFees.toLocaleString()}</strong></td>
                <td style="text-align: right;"><strong>Ksh ${totalPaid.toLocaleString()}</strong></td>
                <td style="text-align: right;"><strong>Ksh ${totalBalance.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </table>
          <hr/><p style="text-align: center;">This report includes only students whose enrollment date falls within the selected period.</p>
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
    const totalOutstanding = studentsWithBalance.reduce((sum, student) => sum + ((student.totalFee || 0) - student.feePaid), 0);
    const currentDate = new Date().toLocaleDateString();
    const headers = ["#", "Name", "Admission No", "Phone", "Total Fee (Ksh)", "Paid (Ksh)", "Balance (Ksh)"];
    const rows = studentsWithBalance.map((student, idx) => {
      const totalFee = student.totalFee || 0;
      const paid = student.feePaid;
      const balance = totalFee - paid;
      return [idx + 1, student.name, student.accountNumber || "N/A", student.phone || "N/A", `Ksh ${totalFee.toLocaleString()}`, `Ksh ${paid.toLocaleString()}`, `Ksh ${balance.toLocaleString()}`];
    });
    rows.push(["", "", "", "", "", "", ""]);
    rows.push(["", "", "", "", "TOTALS:", `Ksh ${studentsWithBalance.reduce((sum, s) => sum + (s.totalFee || 0), 0).toLocaleString()}`, `Ksh ${studentsWithBalance.reduce((sum, s) => sum + s.feePaid, 0).toLocaleString()}`, `Ksh ${totalOutstanding.toLocaleString()}`]);
    setCurrentReportData({ headers, rows });
    const html = `
      <html>
        <head><title>Students with Outstanding Balance</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 15px;">
            <img src="/logopds.jpg" alt="Logo" style="width: 80px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <p style="font-style: italic; color: #2c3e50; margin: 5px 0 0 0; text-align: center; font-size: 0.9em;">
            🚗 Start your journey with Harmflow Driving School – where safety meets confidence.
            Every great driver begins with the right foundation. Our slogan says it all: 🚗 Drive safely, learn confidently – Harmflow Driving School: Your journey to excellence begins here. 🚦
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
            <thead style="background-color: #f2f2f2;"><tr><th>#</th><th>Name</th><th>Admission No</th><th>Phone</th><th>Total Fee (Ksh)</th><th>Paid (Ksh)</th><th>Balance (Ksh)</th></tr></thead>
            <tbody>
              ${studentsWithBalance
                .map((student, idx) => {
                  const totalFee = student.totalFee || 0;
                  const paid = student.feePaid;
                  const balance = totalFee - paid;
                  return `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="padding: 4px;">${student.name}</td>
                    <td style="padding: 4px;">${student.accountNumber || "N/A"}</td>
                    <td style="padding: 4px;">${student.phone || "N/A"}</td>
                    <td style="text-align: right;">Ksh ${totalFee.toLocaleString()}</td>
                    <td style="text-align: right;">Ksh ${paid.toLocaleString()}</td>
                    <td style="text-align: right; font-weight: bold; color: #d9534f;">Ksh ${balance.toLocaleString()}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
            <tfoot style="background-color: #f9f9f9;">
              <tr>
                <td colspan="4" style="text-align: right;"><strong>TOTALS:</strong></td>
                <td style="text-align: right;"><strong>Ksh ${studentsWithBalance.reduce((sum, s) => sum + (s.totalFee || 0), 0).toLocaleString()}</strong></td>
                <td style="text-align: right;"><strong>Ksh ${studentsWithBalance.reduce((sum, s) => sum + s.feePaid, 0).toLocaleString()}</strong></td>
                <td style="text-align: right;"><strong>Ksh ${totalOutstanding.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </td>
          <hr/><p style="text-align: center;">This report lists all students with unpaid fees. Please follow up for collection.</p>
        </body>
      </html>
    `;
    setReportHTML(html);
    setShowReportModal(true);
  };

  const saveReportToFirestore = async () => {
    if (!currentReportData || !branch) return;
    const { headers, rows } = currentReportData;
    const rowsAsObjects = rows.map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    });
    let reportCategory = "Branch Report";
    if (reportHTML.includes("Financial Report (Payments in Period)")) {
      reportCategory = "Payments in Period";
    } else if (reportHTML.includes("Students Enrolled in Period")) {
      reportCategory = "Students Enrolled";
    } else if (reportHTML.includes("Students with Outstanding Balance")) {
      reportCategory = "Students with Balance";
    }
    const reportType = `${branch.name} - ${reportCategory}`;
    try {
      await addDoc(collection(db, "fleetReports"), {
        headers,
        data: rowsAsObjects,
        startDate: reportStartDate || "",
        endDate: reportEndDate || "",
        type: reportType,
        createdAt: new Date().toISOString(),
        branchId: branch.id,
        branchName: branch.name,
      });
      console.log("Report saved for admin viewing");
    } catch (err) {
      console.error("Failed to save report to admin", err);
    }
  };

  const exportToExcel = () => {
    if (!currentReportData) return;
    const { headers, rows } = currentReportData;
    let html = `<tr><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>`;
    rows.forEach((row) => {
      html += `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`;
    });
    html += `</tbody></table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${new Date().toISOString().slice(0, 19)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    saveReportToFirestore();
  };

  const escapeHtml = (text: string) =>
    text.replace(/[&<>]/g, function (m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      return m;
    });

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
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-xl font-bold text-center text-gray-800 mb-4">Enter Branch Password</h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full p-2 border rounded mb-3 text-sm"
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-xs mb-3">{passwordError}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition"
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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 rounded-2xl shadow-xl p-6 text-white mb-8">
        <h1 className="text-3xl font-bold">{branch?.name} Dashboard</h1>
        <p className="text-indigo-100 mt-1">Branch overview & student management</p>
      </div>

      {/* Reports Section */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-8 border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">📊 Generate Reports</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition">
              📆 Payments in Period
            </button>
            <button onClick={printEnrolledStudentsReport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition">
              📋 Students Enrolled
            </button>
            <button onClick={printStudentsWithBalance} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition">
              🖨️ Students with Balance
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-800">From Date</label>
            <input
              type="date"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
              className="border rounded-lg p-2 text-amber-800 text-sm bg-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-800">To Date</label>
            <input
              type="date"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
              className="border rounded-lg text-amber-800 p-2 text-sm bg-indigo-300"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
          <button
            onClick={() => {
              if (!selectedStudent) {
                alert("Please select a student first.");
                return;
              }
              const balance = (selectedStudent.totalFee || 0) - selectedStudent.feePaid;
              if (balance > 0) {
                alert("Transfer rejected due to uncleared school fee. Kindly ask student to clear payment to proceed with transfer.");
                return;
              }
              setShowTransferModal(true);
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            🔄 Request Student Transfer
          </button>
          <button onClick={() => setShowManualExamModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition">
            📝 Exam List Request
          </button>
          <button
            onClick={() => {
              fetchAllExamRequests();
              setShowRequestsModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            📋 Check Exam Requests
          </button>
        </div>
      </div>

      {/* Date Range Filter & Stats - NOW SHOWING CURRENT WEEK DATA */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-8 border border-gray-300">
        <label className="block font-semibold text-gray-700 mb-3">📅 Select Date Range for Reports (manual)</label>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-600">From Date</label>
            <input
              type="date"
              value={rangeStartDate}
              onChange={(e) => setRangeStartDate(e.target.value)}
              className="border rounded-lg p-2 text-amber-800 text-sm bg-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">To Date</label>
            <input
              type="date"
              value={rangeEndDate}
              onChange={(e) => setRangeEndDate(e.target.value)}
              className="border rounded-lg p-2 text-amber-800 text-sm bg-blue-300"
            />
          </div>
          <button
            onClick={() => setRangeStartDate(rangeStartDate)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            Apply Range
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">💰 Collections (This Week)</p>
            <p className="text-xl font-bold text-green-700">Ksh {weekSummary.totalPayments.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">📊 Outstanding Balance (End of Week)</p>
            <p className="text-xl font-bold text-orange-700">Ksh {weekSummary.endBalance.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-600">📚 Lessons Taken (This Week)</p>
            <p className="text-xl font-bold text-purple-700">{weekSummary.lessonsCount}</p>
            <p className="text-xs text-gray-500">Monday to Sunday</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search by name, admission number, phone, or ID number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 border text-orange-800 border-gray-400 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Student List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="bg-indigo-600 px-4 py-3">
            <h3 className="font-semibold text-white">Students ({filteredStudents.length})</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-200">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left text-red-500 p-4 transition ${
                  selectedStudent?.id === student.id
                    ? "bg-indigo-50 border-l-4 border-indigo-600"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="font-medium text-gray-800">{student.name}</div>
                <div className="text-sm text-gray-500">
                  {student.accountNumber} | {student.phone}
                </div>
                <div className="text-sm font-semibold mt-1">
                  Balance: Ksh {((student.totalFee || 0) - student.feePaid).toLocaleString()}
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && (
              <div className="p-4 text-center text-gray-500">No students match</div>
            )}
          </div>
        </div>

        {/* Student Details Panel */}
        <div className="lg:col-span-2 text-amber-600 space-y-6">
          {selectedStudent ? (
            <>
              {/* Student Summary Card */}
              <div className="bg-gray-300 rounded-xl shadow-md p-5 border border-gray-300">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedStudent.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Admission: {selectedStudent.accountNumber} | ID: {selectedStudent.idNumber || "N/A"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Phone: {selectedStudent.phone} | Classes: {selectedStudent.classes?.join(", ") || "None"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Total Fee: <span className="font-semibold">Ksh {selectedStudent.totalFee}</span></p>
                    <p className="text-sm">Paid: <span className="font-semibold text-green-600">Ksh {selectedStudent.feePaid}</span></p>
                    <p className="text-sm font-bold">Balance: <span className={((selectedStudent.totalFee || 0) - selectedStudent.feePaid) > 0 ? "text-red-600" : "text-green-600"}>Ksh {((selectedStudent.totalFee || 0) - selectedStudent.feePaid).toLocaleString()}</span></p>
                  </div>
                </div>
              </div>

              {/* Payment History Card */}
              <div className="bg-white rounded-xl shadow-md p-5 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Payment History</h3>
                {selectedStudent.payments && selectedStudent.payments.length > 0 ? (
                  <div className="space-y-2 text-violet-800 max-h-48 overflow-y-auto">
                    {selectedStudent.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center border-b pb-2">
                        <div>
                          <span className="font-medium">Ksh {payment.amount}</span>
                          <span className="text-xs text-gray-500 ml-2">{payment.date.toLocaleDateString()}</span>
                          {payment.method === "mpesa" ? (
                            <span className="text-xs text-gray-500 ml-2">M-Pesa: {payment.reference}</span>
                          ) : (
                            <span className="text-xs text-gray-500 ml-2">Cash</span>
                          )}
                        </div>
                        <button
                          onClick={() => printReceipt(payment)}
                          className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                        >
                          Receipt
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No payments recorded.</p>
                )}
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 ? (
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[100px]">
                        <label className="block text-xs text-gray-800">Amount (Ksh)</label>
                        <input
                          type="number"
                          value={newPaymentAmount}
                          onChange={(e) => setNewPaymentAmount(e.target.value)}
                          className="w-full border rounded text-green-700 text-xl text-sm p-2"
                          placeholder="0" 
                        />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-gray-800">Payment Method</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as "mpesa" | "cash")}
                          className="w-full border rounded text-green-700 text-xl p-2 text-sm"
                        >
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                        </select>
                      </div>
                      {paymentMethod === "mpesa" && (
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xl text-gray-800">M-Pesa Code</label>
                          <input
                            type="text"
                            value={mpesaCode}
                            onChange={(e) => setMpesaCode(e.target.value)}
                            className="w-full border rounded text-green-700 text-xl p-2 text-sm"
                            placeholder="e.g., QWERTY123"
                          />
                        </div>
                      )}
                      <button onClick={addPayment} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                        Add Payment
                      </button>
                    </div>
                    {paymentError && <p className="text-red-500 text-xs mt-2">{paymentError}</p>}
                    {paymentSuccess && <p className="text-green-600 text-xs mt-2">{paymentSuccess}</p>}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-green-600 text-sm font-semibold">✅ Fully Paid – No further payments required, except internal exams 1,000.</p>
                  </div>
                )}
              </div>

              {/* Lessons Card */}
              <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">📚 Lessons</h3>
                  <div className="text-sm">
                    <span className="font-medium">Total: {selectedStudent.lessons?.length || 0} / {MAX_LESSONS}</span>
                    <span className={`ml-2 font-bold ${MAX_LESSONS - (selectedStudent.lessons?.length || 0) <= 5 ? "text-red-500" : "text-yellow-600"}`}>
                      Remaining: {MAX_LESSONS - (selectedStudent.lessons?.length || 0)}
                    </span>
                  </div>
                </div>
                {(selectedStudent.totalFee || 0) - selectedStudent.feePaid > 0 &&
                  (selectedStudent.lessons?.length || 0) >= MAX_LESSONS_WITH_BALANCE && (
                    <div className="bg-red-100 text-red-700 text-xs p-2 rounded mb-3">
                      ⚠️ Outstanding balance of Ksh {((selectedStudent.totalFee || 0) - selectedStudent.feePaid).toLocaleString()}. Please clear the balance to continue with lessons. Max {MAX_LESSONS_WITH_BALANCE} lessons allowed with balance.
                    </div>
                  )}
                {selectedStudent.lessons && selectedStudent.lessons.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
                    {(() => {
                      const grouped: { [date: string]: Lesson[] } = {};
                      selectedStudent.lessons.forEach((lesson) => {
                        const dateKey = lesson.date.toLocaleDateString();
                        if (!grouped[dateKey]) grouped[dateKey] = [];
                        grouped[dateKey].push(lesson);
                      });
                      return Object.entries(grouped).map(([dateStr, lessonsOnDate]) => (
                        <div key={dateStr} className="border-b pb-2">
                          <div className="font-semibold text-gray-700">{dateStr}</div>
                          {lessonsOnDate.map((lesson) => (
                            <div key={lesson.id} className="flex justify-between pl-2 mt-1">
                              <span>{lesson.type || "General"} (Lesson {lesson.lessonNumber}) ✅</span>
                              <span className="text-gray-500 text-xs">{lesson.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              <button onClick={() => printLessonTicket(lesson)} className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs hover:bg-blue-600">
                                Ticket
                              </button>
                            </div>
                          ))}
                          {lessonsOnDate.length === 2 && <div className="text-yellow-600 text-xs pl-2">⚠️ 2 lessons today</div>}
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">No lessons yet.</p>
                )}
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-600">Instructor Code</label>
                    <input
                      type="text"
                      value={instructorCode}
                      onChange={(e) => setInstructorCode(e.target.value)}
                      className="w-full border rounded p-2 text-sm"
                      placeholder="e.g., 001"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-600">Car Number</label>
                    <input
                      type="text"
                      value={carNumber}
                      onChange={(e) => setCarNumber(e.target.value)}
                      className="w-full border rounded p-2 text-sm"
                      placeholder="e.g., KDN 661E"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600">Lesson type (optional)</label>
                    <input
                      type="text"
                      value={lessonNote}
                      onChange={(e) => setLessonNote(e.target.value)}
                      className="w-full border rounded p-2 text-sm"
                      placeholder="e.g., Practical, Theory"
                    />
                  </div>
                  <button onClick={generateLesson} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                    Generate Lesson
                  </button>
                </div>
                {instructorError && <p className="text-red-500 text-xs mt-2">{instructorError}</p>}
                <p className="text-xs text-gray-500 mt-3">
                  ⚠️ Max 2 lessons per day. Max total {MAX_LESSONS} lessons. If balance is greater than 0, only first {MAX_LESSONS_WITH_BALANCE} lessons allowed. 💰 Minimum fee required for lessons: B1/B2 = 8,000 Ksh, other classes = 10,000 Ksh.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
              Select a student from the list to view details, payments, and lessons.
            </div>
          )}
        </div>
      </div>

      {/* Modals (unchanged) */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-yellow-500 p-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-xl font-bold">📋 Exam Requests - {branch?.name}</h2>
              <button onClick={() => setShowRequestsModal(false)} className="text-2xl leading-none hover:text-gray-800">&times;</button>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">All exam requests submitted from this branch. Approved requests show the scheduled exam date.</p>
                <button onClick={() => fetchAllExamRequests()} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">Refresh</button>
              </div>
              {loadingRequests ? (
                <p className="text-center py-8">Loading requests...</p>
              ) : allExamRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No exam requests submitted yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border">Student Name</th>
                        <th className="p-2 border">ID Number</th>
                        <th className="p-2 border">Requested Class</th>
                        <th className="p-2 border">Request Date</th>
                        <th className="p-2 border">Status</th>
                        <th className="p-2 border">Exam Date (if approved)</th>
                        <th className="p-2 border">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allExamRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="p-2 border">{req.studentName}</td>
                          <td className="p-2 border">{req.studentIdNumber || "N/A"}</td>
                          <td className="p-2 border">{req.requestedClass}</td>
                          <td className="p-2 border">{req.createdAt.toLocaleDateString()}</td>
                          <td className="p-2 border">
                            {req.status === "pending" && <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs">Pending</span>}
                            {req.status === "approved" && <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs">Approved</span>}
                            {req.status === "rejected" && <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs">Rejected</span>}
                          </td>
                          <td className="p-2 border">{req.status === "approved" && req.examDate ? req.examDate.toLocaleDateString() : "-"}</td>
                          <td className="p-2 border max-w-xs truncate">{req.note}</td>
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

      {showExamModal && examStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Request NTSA Exam</h3>
            <p className="mb-2"><strong>Student:</strong> {examStudent.name} <br /><strong>ID Number:</strong> {examStudent.idNumber || "Not provided"}</p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Exam Class</label>
              <select value={examClass} onChange={(e) => setExamClass(e.target.value)} className="w-full border rounded p-2 text-sm" required>
                <option value="">Select class...</option>
                <option value="B1">B1/B2 (Light Vehicle)</option>
                <option value="B2">B1 (Light Vehicle Auto)</option>
                <option value="C1">C1 (Light Truck)</option>
                <option value="C">BC1 (Truck)</option>
                <option value="D1">D1 (PSV)</option>
                <option value="A1">A1 (Motorcycle)</option>
                <option value="A">A2 (Motorcycle)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Additional Note (Optional)</label>
              <textarea value={examNote} onChange={(e) => setExamNote(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" placeholder="Any special instructions..."/>
            </div>
            {examRequestError && <p className="text-red-500 text-xs mb-2">{examRequestError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowExamModal(false); setExamStudent(null); setExamClass(""); setExamNote(""); setExamRequestError(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button onClick={handleExamRequest} disabled={examRequestLoading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">{examRequestLoading ? "Submitting..." : "Submit Request"}</button>
            </div>
            {examRequestSuccess && <p className="text-green-600 text-xs mt-2">{examRequestSuccess}</p>}
          </div>
        </div>
      )}

      {showManualExamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Exam List Request</h3>
            <p className="text-sm text-gray-500 mb-3">Enter student details for exam approval. The student name must already exist in your branch records.</p>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Student Full Name *</label>
              <input type="text" value={manualStudentName} onChange={(e) => { setManualStudentName(e.target.value); setManualNameError(""); }} className="w-full border rounded p-2 text-sm" placeholder="Exactly as registered in the system" required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">ID Number (Optional)</label>
              <input type="text" value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Must match the student's ID" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Exam Class *</label>
              <select value={manualExamClass} onChange={(e) => setManualExamClass(e.target.value)} className="w-full border rounded p-2 text-sm" required>
                <option value="">Select class...</option>
                <option value="B1">B1/B2 (Light Vehicle)</option>
                <option value="B2">B1 (Light Vehicle Auto)</option>
                <option value="C1">C1 (Light Truck)</option>
                <option value="C">BC1 (Truck)</option>
                <option value="D1">D1 (PSV)</option>
                <option value="A1">A1 (Motorcycle)</option>
                <option value="A">A2 (Motorcycle)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Additional Note (Optional)</label>
              <textarea value={manualExamNote} onChange={(e) => setManualExamNote(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" placeholder="Any special instructions..."/>
            </div>
            {manualNameError && <p className="text-red-600 text-xs mb-3 bg-red-50 p-2 rounded border border-red-200">❌ {manualNameError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowManualExamModal(false); setManualStudentName(""); setManualStudentId(""); setManualExamClass(""); setManualExamNote(""); setManualNameError(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button onClick={handleManualExamRequest} disabled={manualRequestLoading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50">{manualRequestLoading ? "Submitting..." : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Transfer Student</h3>
            <p className="text-sm mb-3">Student: <strong>{selectedStudent?.name}</strong></p>
            <div className="mb-3">
              <label className="block text-sm font-medium">Target Branch</label>
              <select value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)} className="w-full border rounded p-2 text-sm">
                <option value="">Select branch...</option>
                {availableBranches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">Reason for transfer</label>
              <textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} rows={3} className="w-full border rounded p-2 text-sm" placeholder="Explain why this student should be moved..."/>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowTransferModal(false); setTargetBranchId(""); setTransferReason(""); }} className="px-4 py-2 text-sm border rounded">Cancel</button>
              <button onClick={async () => {
                if (!targetBranchId || !transferReason.trim()) { alert("Please fill target branch and reason."); return; }
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
                    alert("Transfer request submitted. Admin will review it.");
                    setShowTransferModal(false); setTargetBranchId(""); setTransferReason("");
                  } else alert("Failed to submit request.");
                } catch (err) { alert("Error submitting request."); }
                finally { setTransferLoading(false); }
              }} disabled={transferLoading} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">{transferLoading ? "Submitting..." : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-indigo-700 text-white p-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-xl font-bold">📄 Report Preview</h2>
              <button onClick={() => setShowReportModal(false)} className="text-2xl leading-none hover:text-gray-200">&times;</button>
            </div>
            <div className="p-4">
              <iframe srcDoc={reportHTML} title="Report Preview" className="w-full h-[70vh] border-0 rounded" sandbox="allow-same-origin allow-scripts allow-popups allow-modals" />
            </div>
            <div className="sticky bottom-0 bg-gray-100 p-4 flex justify-center gap-4 border-t">
              <button onClick={handlePrintFromModal} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium">🖨️ Print Report</button>
              <button onClick={exportToExcel} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">📎 Export to Excel</button>
              <button onClick={() => setShowReportModal(false)} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
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