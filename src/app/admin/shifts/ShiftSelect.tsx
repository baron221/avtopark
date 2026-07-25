"use client";

import type { SelectHTMLAttributes } from "react";

export function ShiftSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
