"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";

export default function BranchAccessClient({ branchId }: { branchId: string }) {
  const [branchName, setBranchName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const branchRef = doc(db, "branches", branchId);
        const branchSnap = await getDoc(branchRef);
        if (branchSnap.exists()) {
          setBranchName(branchSnap.data().name || branchId);
        } else {
          setBranchName(branchId);
        }
      } catch (error) {
        console.error(error);
        setBranchName(branchId);
      } finally {
        setLoading(false);
      }
    };
    fetchBranch();
  }, [branchId]);

  if (loading) return <div className="p-4">Loading branch details...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Branch Access: {branchName}</h1>
      <p className="text-gray-600">This is the branch access client component.</p>
      <p>You can add your own logic here (e.g., showing students, editing, etc.).</p>
    </div>
  );
}