"use client";

import type { Point } from "@prisma/client";

export function CancelHandoverButton({
  action,
  point,
  date,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  point?: Point;
  /** ISO yyyy-mm-dd — set only when viewing a day other than today. */
  date?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Топширишни бекор қилайликми?")) e.preventDefault();
      }}
    >
      {point && <input type="hidden" name="point" value={point} />}
      {date && <input type="hidden" name="date" value={date} />}
      <button type="submit" className="text-danger text-[11px] font-bold hover:underline whitespace-nowrap">
        Бекор қилиш
      </button>
    </form>
  );
}
