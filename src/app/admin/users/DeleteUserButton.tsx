"use client";

import { deleteUserAction } from "./actions";

export function DeleteUserButton({
  userId,
  fullName,
  page,
  className,
}: {
  userId: string;
  fullName: string;
  page: number;
  className?: string;
}) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        if (!window.confirm(`${fullName}ni butunlay o'chirib tashlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="page" value={page} />
      <button type="submit" className={className}>
        O&apos;chirish
      </button>
    </form>
  );
}
