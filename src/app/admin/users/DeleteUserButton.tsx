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
        if (!window.confirm(`${fullName}ни бутунлай ўчириб ташлайсизми? Бу амални ортга қайтариб бўлмайди.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="page" value={page} />
      <button type="submit" className={className}>
        Ўчириш
      </button>
    </form>
  );
}
