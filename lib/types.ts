export interface Student {
  id: string;
  name: string;
  studentNumber: string;
  branchId: string;
  balance: number;
  enrolledDate: Date | string;
  lessonsTaken: number;
  phone?: string;
  lastActive?: Date;
  isDormant?: boolean;
}

export interface Instructor {
  id: string;
  name: string;
  code: string;
  phone: string;
  branchId: string;
  isActive: boolean;
}

export interface Payment {
  id: string;
  studentId: string;
  branchId: string;
  amount: number;
  date: Date | string;
}
