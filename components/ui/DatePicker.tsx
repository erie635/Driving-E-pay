'use client';
export function DatePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    onChange(newDate);
  };
  const formattedValue = value.toISOString().split('T')[0];
  return (
    <input
      type="date"
      value={formattedValue}
      onChange={handleChange}
      className="border p-2 rounded"
    />
  );
}
