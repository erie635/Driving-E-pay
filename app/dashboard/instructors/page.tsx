"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

const REQUIRED_PASSWORD = "1234";

interface Instructor {
  id: string;
  name: string;
  code: string;
  carNumbers: string[];
}

interface Vehicle {
  id: string;
  plate: string;
  insuranceExpiry: string;
  inspectionExpiry: string;
  lastServiceKm: number;
  currentOdometer: number;
  nextServiceKm: number;
  branch: string;
  assignedInstructorId: string;
  assignedInstructorName: string;
}

export default function InstructorsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Instructors state
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [newInstructorName, setNewInstructorName] = useState("");
  const [newInstructorCode, setNewInstructorCode] = useState("");

  // Modal state for adding car number to instructor
  const [showCarModal, setShowCarModal] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [newCarPlate, setNewCarPlate] = useState("");

  // Fleet state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({
    plate: "",
    insuranceExpiry: "",
    inspectionExpiry: "",
    lastServiceKm: 0,
    currentOdometer: 0,
    branch: "",
    assignedInstructorId: "",
    assignedInstructorName: "",
  });

  // Date range filter for fleet export/print
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);

  const [error, setError] = useState("");

  // ---------- AUTH ----------
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === REQUIRED_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Incorrect password.");
    }
  };

  // ---------- FETCH DATA ----------
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const instructorSnap = await getDocs(collection(db, "instructors"));
        const instructorsData = instructorSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Instructor[];
        setInstructors(instructorsData);

        const vehicleSnap = await getDocs(collection(db, "vehicles"));
        const vehiclesData = vehicleSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Vehicle[];
        setVehicles(vehiclesData);
        setFilteredVehicles(vehiclesData);
      } catch (err) {
        console.error(err);
        setError("Failed to load data.");
      } finally {
        setLoadingInstructors(false);
        setLoadingVehicles(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  // Helper to get expiry days
  const getExpiryDays = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  };

  // Sorting function: expired first, then expiring soon (<=7 days), then valid (>7 days)
  const sortByUrgency = (a: Vehicle, b: Vehicle) => {
    const daysA = getExpiryDays(a.insuranceExpiry);
    const daysB = getExpiryDays(b.insuranceExpiry);

    const getGroup = (days: number) => {
      if (days <= 0) return 0;
      if (days <= 7) return 1;
      return 2;
    };

    const groupA = getGroup(daysA);
    const groupB = getGroup(daysB);

    if (groupA !== groupB) return groupA - groupB;
    return daysA - daysB;
  };

  // Apply date filter and then sort by urgency
  useEffect(() => {
    if (!vehicles.length) {
      setFilteredVehicles([]);
      return;
    }
    let filtered = vehicles;
    if (startDate || endDate) {
      filtered = vehicles.filter((v) => {
        const expiry = new Date(v.insuranceExpiry);
        if (startDate && expiry < new Date(startDate)) return false;
        if (endDate && expiry > new Date(endDate)) return false;
        return true;
      });
    }
    const sorted = [...filtered].sort(sortByUrgency);
    setFilteredVehicles(sorted);
  }, [vehicles, startDate, endDate]);

  const resetDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  // ---------- INSTRUCTOR LOGIC ----------
  const addInstructor = async () => {
    if (!newInstructorName.trim() || !newInstructorCode.trim()) {
      setError("Please enter name and code.");
      return;
    }
    const code = newInstructorCode.trim().toUpperCase();
    const existing = instructors.find((i) => i.code === code);
    if (existing) {
      setError("Instructor code already exists.");
      return;
    }
    const newId = code;
    await setDoc(doc(db, "instructors", newId), {
      name: newInstructorName.trim(),
      code: code,
      carNumbers: [],
    });
    setInstructors([
      ...instructors,
      { id: newId, name: newInstructorName.trim(), code, carNumbers: [] },
    ]);
    setNewInstructorName("");
    setNewInstructorCode("");
    setError("");
  };

  const openCarModal = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setNewCarPlate("");
    setShowCarModal(true);
  };

  const addCarNumberToInstructor = async () => {
    if (!selectedInstructor) return;
    if (!newCarPlate.trim()) {
      setError("Please enter a car plate number.");
      return;
    }
    const car = newCarPlate.trim().toUpperCase();
    if (selectedInstructor.carNumbers.includes(car)) {
      setError("Car number already assigned to this instructor.");
      return;
    }
    const instructorRef = doc(db, "instructors", selectedInstructor.id);
    await updateDoc(instructorRef, {
      carNumbers: arrayUnion(car),
    });
    setInstructors(
      instructors.map((i) =>
        i.id === selectedInstructor.id
          ? { ...i, carNumbers: [...i.carNumbers, car] }
          : i
      )
    );
    setShowCarModal(false);
    setSelectedInstructor(null);
    setNewCarPlate("");
    setError("");
  };

  const removeCarNumber = async (instructor: Instructor, car: string) => {
    const instructorRef = doc(db, "instructors", instructor.id);
    await updateDoc(instructorRef, {
      carNumbers: arrayRemove(car),
    });
    setInstructors(
      instructors.map((i) =>
        i.id === instructor.id
          ? { ...i, carNumbers: i.carNumbers.filter((c) => c !== car) }
          : i
      )
    );
  };

  const deleteInstructor = async (id: string) => {
    if (confirm("Delete instructor and all their car numbers?")) {
      await deleteDoc(doc(db, "instructors", id));
      setInstructors(instructors.filter((i) => i.id !== id));
    }
  };

  // ---------- FLEET LOGIC ----------
  const resetVehicleForm = () => {
    setVehicleForm({
      plate: "",
      insuranceExpiry: "",
      inspectionExpiry: "",
      lastServiceKm: 0,
      currentOdometer: 0,
      branch: "",
      assignedInstructorId: "",
      assignedInstructorName: "",
    });
    setEditingVehicle(null);
  };

  const openAddVehicleModal = () => {
    resetVehicleForm();
    setShowVehicleModal(true);
  };

  const openEditVehicleModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      plate: vehicle.plate,
      insuranceExpiry: vehicle.insuranceExpiry,
      inspectionExpiry: vehicle.inspectionExpiry,
      lastServiceKm: vehicle.lastServiceKm,
      currentOdometer: vehicle.currentOdometer,
      nextServiceKm: vehicle.nextServiceKm,
      branch: vehicle.branch,
      assignedInstructorId: vehicle.assignedInstructorId,
      assignedInstructorName: vehicle.assignedInstructorName,
    });
    setShowVehicleModal(true);
  };

  const saveVehicle = async () => {
    if (
      !vehicleForm.plate ||
      !vehicleForm.insuranceExpiry ||
      !vehicleForm.inspectionExpiry ||
      vehicleForm.lastServiceKm === undefined ||
      vehicleForm.currentOdometer === undefined ||
      !vehicleForm.branch
    ) {
      setError("Please fill all required fields (including Inspection Expiry).");
      return;
    }

    const plate = vehicleForm.plate.trim().toUpperCase();
    const lastService = Number(vehicleForm.lastServiceKm);
    const currentKm = Number(vehicleForm.currentOdometer);
    const nextService = lastService + 5000;

    const instructorId = vehicleForm.assignedInstructorId || "";
    const instructorName =
      instructors.find((i) => i.code === instructorId)?.name || "";

    const vehicleData: Omit<Vehicle, "id"> = {
      plate,
      insuranceExpiry: vehicleForm.insuranceExpiry,
      inspectionExpiry: vehicleForm.inspectionExpiry,
      lastServiceKm: lastService,
      currentOdometer: currentKm,
      nextServiceKm: nextService,
      branch: vehicleForm.branch.trim(),
      assignedInstructorId: instructorId,
      assignedInstructorName: instructorName,
    };

    try {
      if (editingVehicle) {
        const vehicleRef = doc(db, "vehicles", editingVehicle.id);
        await updateDoc(vehicleRef, vehicleData as any);
        setVehicles(
          vehicles.map((v) =>
            v.id === editingVehicle.id ? { ...vehicleData, id: editingVehicle.id } : v
          )
        );
      } else {
        const newId = plate;
        await setDoc(doc(db, "vehicles", newId), vehicleData);
        setVehicles([...vehicles, { ...vehicleData, id: newId }]);
      }
      setShowVehicleModal(false);
      resetVehicleForm();
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to save vehicle.");
    }
  };

  const deleteVehicle = async (id: string) => {
    if (confirm("Delete this vehicle permanently?")) {
      await deleteDoc(doc(db, "vehicles", id));
      setVehicles(vehicles.filter((v) => v.id !== id));
    }
  };

  // Helper to get expiry status with text and class
  const getExpiryStatus = (expiryDate: string) => {
    const days = getExpiryDays(expiryDate);
    if (days <= 0) return { text: "🔴 EXPIRED", class: "bg-red-200" };
    if (days <= 7) return { text: "🟡 Expires soon", class: "bg-yellow-200" };
    return { text: "🟢 Valid", class: "bg-green-100" };
  };

  const isServiceDue = (vehicle: Vehicle) => vehicle.currentOdometer >= vehicle.nextServiceKm;

  // ----- Save report to Firestore -----
  const saveReportToFirestore = async (headers: string[], rows: any[][], startDate: string, endDate: string, type: string) => {
    try {
      const rowsAsObjects = rows.map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });
      await setDoc(doc(collection(db, "fleetReports")), {
        headers,
        data: rowsAsObjects,
        startDate: startDate || "",
        endDate: endDate || "",
        type,
        createdAt: new Date().toISOString(),
      });
      console.log("Report saved for admin");
    } catch (err) {
      console.error("Failed to save report", err);
    }
  };

  // EXPORT TO XLSX
  const exportToXLSX = () => {
    const dataToExport = filteredVehicles.length ? filteredVehicles : vehicles;
    const headers = [
      "Plate",
      "Insurance Expiry",
      "Days Until Insurance Expiry",
      "Inspection Expiry",
      "Days Until Inspection Expiry",
      "Last Service (km)",
      "Current Odometer",
      "Next Service (km)",
      "Service Status",
      "Branch",
      "Assigned Instructor",
    ];
    const rows = dataToExport.map((v) => {
      const daysIns = getExpiryDays(v.insuranceExpiry);
      const daysInsp = getExpiryDays(v.inspectionExpiry);
      const serviceDue = v.currentOdometer >= v.nextServiceKm;
      return [
        v.plate,
        v.insuranceExpiry,
        daysIns,
        v.inspectionExpiry,
        daysInsp,
        v.lastServiceKm,
        v.currentOdometer,
        v.nextServiceKm,
        serviceDue ? "Overdue" : "OK",
        v.branch,
        v.assignedInstructorName || "Unassigned",
      ];
    });
    saveReportToFirestore(headers, rows, startDate, endDate, "XLSX");

    let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</td></thead><tbody>`;
    rows.forEach(row => {
      html += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    });
    html += `</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet_report_${new Date().toISOString().slice(0,19)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PRINT
  const handlePrint = () => {
    const dataToPrint = filteredVehicles.length ? filteredVehicles : vehicles;
    const headers = [
      "Plate",
      "Insurance Expiry",
      "Days Left (Insurance)",
      "Inspection Expiry",
      "Days Left (Inspection)",
      "Last Service (km)",
      "Current Odometer",
      "Next Service (km)",
      "Service Status",
      "Branch",
      "Instructor",
    ];
    const rows = dataToPrint.map((v) => {
      const daysIns = getExpiryDays(v.insuranceExpiry);
      const daysInsp = getExpiryDays(v.inspectionExpiry);
      const serviceDue = v.currentOdometer >= v.nextServiceKm;
      return [
        v.plate,
        new Date(v.insuranceExpiry).toLocaleDateString(),
        daysIns,
        new Date(v.inspectionExpiry).toLocaleDateString(),
        daysInsp,
        v.lastServiceKm,
        v.currentOdometer,
        v.nextServiceKm,
        serviceDue ? "Due" : "OK",
        v.branch,
        v.assignedInstructorName || "—",
      ];
    });
    saveReportToFirestore(headers, rows, startDate, endDate, "Print");

    const rowsHtml = rows.map(row => `
      <tr>
        ${row.map(cell => `<td style="border: 1px solid #ccc; padding: 6px;">${cell}</td>`).join('')}
      </tr>
    `).join('');

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print.");
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fleet Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #aaa; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .header-info { margin-bottom: 20px; text-align: center; }
            @media print {
              .no-print { display: none; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Fleet Management Report</h1>
          <div class="header-info">
            <p>Generated: ${new Date().toLocaleString()}</p>
            ${startDate || endDate ? `<p>Date range: ${startDate || "any"} to ${endDate || "any"}</p>` : "<p>All vehicles</p>"}
          </div>
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print();">Print</button>
          </p>
        </body>
      </html>
    `;
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // ---------- RENDER ----------
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
          <img src="/logopds.jpg" alt="Logo" className="mx-auto mb-4 w-20" />
          <h2 className="text-xl text-black font-bold mb-4 text-center">Instructor & Fleet Admin</h2>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Enter admin password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full p-2 border rounded mb-2 text-black"
              autoFocus
            />
            {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded mt-2">
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loadingInstructors || loadingVehicles) return <div className="p-4">Loading data...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-300 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-amber-800">
        Instructor & Fleet Management
      </h1>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

      {/* INSTRUCTORS SECTION */}
      <div className="bg-gray-400 p-4 rounded shadow mb-8">
        <div className="flex flex-col gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-blue-800">👨‍🏫 Instructors</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Full Name"
              value={newInstructorName}
              onChange={(e) => setNewInstructorName(e.target.value)}
              className="p-2 border bg-amber-300 rounded text-black w-full sm:w-48"
            />
            <input
              type="text"
              placeholder="Code (e.g., 001)"
              value={newInstructorCode}
              onChange={(e) => setNewInstructorCode(e.target.value)}
              className="p-2 border bg-amber-400 rounded text-black w-full sm:w-32"
            />
            <button
              onClick={addInstructor}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full sm:w-auto"
            >
              Add Instructor
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-900 border text-sm sm:text-base">
            <thead>
              <tr className="bg-red-300">
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Code</th>
                <th className="border p-2 text-left">Car Numbers</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((inst) => (
                <tr key={inst.id} className="border-b">
                  <td className="border p-2 font-medium">{inst.name}</td>
                  <td className="border p-2">{inst.code}</td>
                  <td className="border p-2">
                    {inst.carNumbers.length === 0 ? (
                      <span className="text-gray-500 text-sm">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {inst.carNumbers.map((car) => (
                          <span
                            key={car}
                            className="inline-flex items-center gap-1 bg-green-800 px-2 py-0.5 rounded text-sm"
                          >
                            {car}
                            <button
                              onClick={() => removeCarNumber(inst, car)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border p-2 space-x-1 whitespace-nowrap">
                    <button
                      onClick={() => openCarModal(inst)}
                      className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                    >
                      + Add Car
                    </button>
                    <button
                      onClick={() => deleteInstructor(inst.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {instructors.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-gray-500">
                    No instructors added. Use the form above to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FLEET MANAGEMENT SECTION */}
      <div className="bg-green-400 p-4 rounded shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-green-800">🚗 Fleet Management</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportToXLSX} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
              📎 Export XLSX
            </button>
            <button onClick={handlePrint} className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
              🖨️ Print / PDF
            </button>
            <button onClick={openAddVehicleModal} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              + Add Vehicle
            </button>
          </div>
        </div>

        <div className="mb-4 p-3 bg-emerald-900 rounded flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-white font-medium">From (Insurance Expiry)</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border rounded bg-white text-amber-900" />
          </div>
          <div>
            <label className="block text-sm text-white font-medium">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border bg-white rounded text-amber-900" />
          </div>
          <button onClick={resetDateFilter} className="bg-gray-500 text-white px-3 py-1 rounded text-sm">
            Clear Filter
          </button>
          <span className="text-sm text-gray-400">
            {filteredVehicles.length} of {vehicles.length} vehicles shown
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-900 border text-sm sm:text-base">
            <thead>
              <tr className="bg-indigo-950">
                <th className="border p-2 text-left">Plate</th>
                <th className="border p-2 text-left">Insurance Expiry</th>
                <th className="border p-2 text-left">Inspection Expiry</th>
                <th className="border p-2 text-left">Service (km)</th>
                <th className="border p-2 text-left">Current Odometer</th>
                <th className="border p-2 text-left">Branch</th>
                <th className="border p-2 text-left">Instructor</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => {
                const insStatus = getExpiryStatus(v.insuranceExpiry);
                const inspStatus = getExpiryStatus(v.inspectionExpiry);
                const rowClass = insStatus.class;
                return (
                  <tr key={v.id} className={`${rowClass} ${isServiceDue(v) ? "bg-red-200" : ""}`}>
                    <td className="border p-2 font-mono bg-amber-700">{v.plate}</td>
                    <td className="border p-2 bg-black">
                      {new Date(v.insuranceExpiry).toLocaleDateString()}
                      <span className="block text-xs font-medium">{insStatus.text}</span>
                    </td>
                    <td className="border p-2 bg-black">
                      {new Date(v.inspectionExpiry).toLocaleDateString()}
                      <span className="block text-xs font-medium">{inspStatus.text}</span>
                    </td>
                    <td className="border p-2 bg-green-950">
                      Last: {v.lastServiceKm} km<br />
                      Next: {v.nextServiceKm} km
                      {isServiceDue(v) && <span className="block text-red-700 font-bold">🔧 Service due!</span>}
                    </td>
                    <td className="border p-2 bg-gray-600">{v.currentOdometer} km</td>
                    <td className="border p-2 bg-amber-500">{v.branch}</td>
                    <td className="border p-2 bg-blue-500">{v.assignedInstructorName || "—"}</td>
                    <td className="border p-2 whitespace-nowrap">
                      <button onClick={() => openEditVehicleModal(v)} className="bg-yellow-500 text-white px-2 py-0.5 rounded text-xs mr-1">
                        Edit
                      </button>
                      <button onClick={() => deleteVehicle(v.id)} className="bg-red-600 text-white px-2 py-0.5 rounded text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-4 text-gray-500">
                    No vehicles match the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for adding car number to instructor */}
      {showCarModal && selectedInstructor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              Add Car Number to {selectedInstructor.name}
            </h3>
            <input
              type="text"
              placeholder="Car plate (e.g., KDN 123A)"
              value={newCarPlate}
              onChange={(e) => setNewCarPlate(e.target.value)}
              className="w-full p-2 border rounded text-black mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCarModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={addCarNumberToInstructor} className="bg-blue-600 text-white px-4 py-2 rounded">
                Add Car
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add/Edit Vehicle */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Plate Number (e.g., KDN 123A)"
                value={vehicleForm.plate || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                className="w-full p-2 border rounded text-black"
                disabled={!!editingVehicle}
              />
              <input
                type="date"
                placeholder="Insurance Expiry Date"
                value={vehicleForm.insuranceExpiry || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiry: e.target.value })}
                className="w-full p-2 border rounded text-black"
              />
              <input
                type="date"
                placeholder="Inspection Expiry Date"
                value={vehicleForm.inspectionExpiry || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, inspectionExpiry: e.target.value })}
                className="w-full p-2 border rounded text-black"
              />
              <input
                type="number"
                placeholder="Last Service Odometer (km)"
                value={vehicleForm.lastServiceKm || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, lastServiceKm: parseInt(e.target.value) || 0 })}
                className="w-full p-2 border rounded text-black"
              />
              <input
                type="number"
                placeholder="Current Odometer (km)"
                value={vehicleForm.currentOdometer || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, currentOdometer: parseInt(e.target.value) || 0 })}
                className="w-full p-2 border rounded text-black"
              />
              <input
                type="text"
                placeholder="Branch / Location"
                value={vehicleForm.branch || ""}
                onChange={(e) => setVehicleForm({ ...vehicleForm, branch: e.target.value })}
                className="w-full p-2 border rounded text-black"
              />
              <select
                value={vehicleForm.assignedInstructorId || ""}
                onChange={(e) => {
                  const instructorId = e.target.value;
                  const instructorName = instructors.find((i) => i.code === instructorId)?.name || "";
                  setVehicleForm({
                    ...vehicleForm,
                    assignedInstructorId: instructorId,
                    assignedInstructorName: instructorName,
                  });
                }}
                className="w-full p-2 border rounded text-black"
              >
                <option value="">-- Assign Instructor (optional) --</option>
                {instructors.map((inst) => (
                  <option key={inst.code} value={inst.code}>
                    {inst.name} ({inst.code})
                  </option>
                ))}
              </select>
              <div className="text-sm text-gray-600">
                * Next service will be automatically set to last service + 5000 km.
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowVehicleModal(false)} className="bg-gray-500 text-white px-4 py-2 rounded">
                Cancel
              </button>
              <button onClick={saveVehicle} className="bg-green-600 text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}