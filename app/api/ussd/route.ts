// app/api/ussd/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin'; // your Firebase Admin SDK instance

// Helper to send USSD response
function ussdResponse(message: string, continueSession: boolean = true) {
  return NextResponse.json({
    message,
    continueSession,
  });
}

// A simple mapping of areas to branch IDs (customise to your branches)
// In a real app you would store branch locations in Firestore and query.
// For demonstration we assume branches have a 'location' field (e.g., 'Nairobi', 'Mombasa').
async function getBranchesByLocation(area: string) {
  const branchesSnapshot = await adminDb
    .collection('branches')
    .where('location', '==', area)
    .get();
  if (branchesSnapshot.empty) {
    // fallback to all branches
    const allBranches = await adminDb.collection('branches').get();
    return allBranches.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
  }
  return branchesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, phoneNumber, text, serviceCode, networkCode } = body;

    const input = text.split('*');
    const step = input.length;

    const sessionRef = adminDb.collection('ussd_sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    let sessionData = sessionDoc.exists ? sessionDoc.data() : {};

    // ---------- Step 1: Welcome & location request ----------
    if (step === 1) {
      const message = `Welcome to Harmflow Driving School\nEnter your area (e.g., Nairobi, Mombasa, Kisumu):`;
      await sessionRef.set({ step: 1 }, { merge: true });
      return ussdResponse(message, true);
    }

    // ---------- Step 2: Collect area, then show branches ----------
    if (step === 2) {
      const area = input[1].trim();
      if (!area || area.length < 2) {
        return ussdResponse('Invalid area. Please enter a valid area (e.g., Nairobi):', true);
      }
      const branches = await getBranchesByLocation(area);
      if (branches.length === 0) {
        return ussdResponse('No branches found in that area. Please try another area:', true);
      }
      // Store area and branches in session
      await sessionRef.set({ area, branches, step: 2 }, { merge: true });

      const menu = branches.map((b, idx) => `${idx + 1}. ${b.name}`).join('\n');
      const message = `Select your preferred branch:\n${menu}\n0. Cancel`;
      return ussdResponse(message, true);
    }

    // ---------- Step 3: Branch selection ----------
    if (step === 3) {
      const selectedIndex = parseInt(input[2]) - 1;
      const branches = sessionData.branches;
      if (!branches || selectedIndex < 0 || selectedIndex >= branches.length) {
        return ussdResponse('Invalid choice. Please select a valid branch number:', true);
      }
      const selectedBranch = branches[selectedIndex];
      await sessionRef.set({ selectedBranch, step: 3 }, { merge: true });

      const message = `You selected ${selectedBranch.name}.\nEnter your full name:`;
      return ussdResponse(message, true);
    }

    // ---------- Step 4: Collect name ----------
    if (step === 4) {
      const name = input[3];
      if (!name || name.trim().length < 2) {
        return ussdResponse('Invalid name. Please enter your full name:', true);
      }
      await sessionRef.set({ name, step: 4 }, { merge: true });

      const message = `Enter your ID number:`;
      return ussdResponse(message, true);
    }

    // ---------- Step 5: Collect ID number ----------
    if (step === 5) {
      const idNumber = input[4];
      if (!idNumber || idNumber.length < 5) {
        return ussdResponse('Invalid ID number. Please enter a valid ID:', true);
      }
      await sessionRef.set({ idNumber, step: 5 }, { merge: true });

      const message = `Enter your phone number (or reply 0 to use ${phoneNumber}):`;
      return ussdResponse(message, true);
    }

    // ---------- Step 6: Collect phone (optional) ----------
    if (step === 6) {
      let studentPhone = input[5];
      if (studentPhone === '0' || !studentPhone) studentPhone = phoneNumber;
      await sessionRef.set({ studentPhone, step: 6 }, { merge: true });

      const { selectedBranch, name, idNumber, area } = sessionData;
      const message = `Confirm enrollment:\nArea: ${area}\nBranch: ${selectedBranch.name}\nName: ${name}\nID: ${idNumber}\nPhone: ${studentPhone}\n1. Confirm\n2. Cancel`;
      return ussdResponse(message, true);
    }

    // ---------- Step 7: Confirmation & save to Firebase ----------
    if (step === 7) {
      const choice = input[6];
      if (choice === '1') {
        const { selectedBranch, name, idNumber, studentPhone, area } = sessionData;

        // Save student to Firestore
        const studentRef = adminDb.collection('students').doc();
        await studentRef.set({
          name,
          idNumber,
          phone: studentPhone,
          branchId: selectedBranch.id,
          branchName: selectedBranch.name,
          area,
          enrolledAt: adminDb.Timestamp.now(),
          status: 'active',
          ussdSession: sessionId,
        });

        // Optionally also save to branch's subcollection
        const branchStudentRef = adminDb
          .collection('branches')
          .doc(selectedBranch.id)
          .collection('students')
          .doc(studentRef.id);
        await branchStudentRef.set({
          name,
          idNumber,
          phone: studentPhone,
          enrolledAt: adminDb.Timestamp.now(),
        });

        // Clear session
        await sessionRef.delete();

        return ussdResponse('Enrollment successful! You will receive a confirmation SMS shortly.', false);
      } else {
        await sessionRef.delete();
        return ussdResponse('Enrollment cancelled.', false);
      }
    }

    // Fallback
    return ussdResponse('Invalid input. Please try again.', true);
  } catch (error) {
    console.error('USSD error:', error);
    return ussdResponse('System error. Please try again later.', false);
  }
}