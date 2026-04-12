// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setBranchId(null);
        return;
      }
      const tokenResult = await firebaseUser.getIdTokenResult();
      const claims = tokenResult.claims;
      setRole(claims.role || null);
      setBranchId(claims.branchId || null);
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  return { user, role, branchId };
}