"use client";

import type { Point } from "@prisma/client";

export function CancelHandoverButton({
  action,
  point,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  point?: Point;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Топширишни бекор қилайликми?")) e.preventDefault();
      }}
    >
      {point && <input type="hidden" name="point" value={point} />}
      <button type="submit" className="text-danger text-[11px] font-bold hover:underline whitespace-nowrap">
        Бекор қилиш
      </button>
    </form>
  );
}
