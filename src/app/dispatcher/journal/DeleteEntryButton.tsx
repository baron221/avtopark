"use client";

import type { Point } from "@prisma/client";

export function DeleteEntryButton({
  action,
  id,
  point,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  /** Set only for a granted non-Dispatcher visitor, who has no point of their own. */
  point?: Point;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Бу ёзувни ўчиришни тасдиқлайсизми?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {point && <input type="hidden" name="point" value={point} />}
      <button
        type="submit"
        title="Ўчириш"
        className="text-muted-2 hover:text-danger font-extrabold text-base leading-none px-1.5 py-1"
      >
        ✕
      </button>
    </form>
  );
}
