'use client';
export function InstructorSelect({ branchId, onSelect }: any) {
  return (
    <select onChange={(e) => onSelect?.(e.target.value)}>
      <option value="">Select Instructor</option>
    </select>
  );
}
