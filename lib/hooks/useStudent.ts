import { useEffect, useState } from "react";

export function useStudent(studentId: string) {
  const [student, setStudent] = useState<any>(null);
  const [branchInstructors, setBranchInstructors] = useState<any[]>([]);
  const [branchVehicles, setBranchVehicles] = useState<any[]>([]);

  useEffect(() => {
    if (studentId) {
      // TODO: Replace with Firebase fetch
    }
  }, [studentId]);

  return { student, branchInstructors, branchVehicles };
}
