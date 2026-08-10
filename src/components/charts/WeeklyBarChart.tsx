export type WeeklyBarDatum = {
  label: string;
  income: number;
  expense: number;
};

export function WeeklyBarChart({ data }: { data: WeeklyBarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));

  return (
    <div className="flex items-end gap-1.5 sm:gap-[18px] h-[180px] mt-5">
      {data.map((d) => (
        <div
          key={d.label}
          className="flex-1 min-w-0 flex flex-col items-center gap-2 h-full justify-end"
        >
          <div className="flex gap-1 sm:gap-1.5 items-end w-full justify-center h-full">
            <div
              className="w-[13px] sm:w-[22px] rounded-t-md bg-primary"
              style={{ height: `${(d.income / max) * 100}%` }}
            />
            <div
              className="w-[13px] sm:w-[22px] rounded-t-md bg-[#C9CBE3]"
              style={{ height: `${(d.expense / max) * 100}%` }}
            />
          </div>
          <div className="text-[10px] sm:text-xs text-muted-2 font-bold">{d.label}</div>
        </div>
      ))}
    </div>
  );
}
