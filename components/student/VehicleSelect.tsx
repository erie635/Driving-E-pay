'use client';
export function VehicleSelect({ branchId, onSelect }: any) {
  return (
    <select onChange={(e) => onSelect?.(e.target.value)}>
      <option value="">Select Vehicle</option>
    </select>
  );
}
