"use client";

import { useState } from "react";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function MoneyInput({
  name,
  defaultValue,
  required,
  placeholder,
  className,
  autoFocus,
}: {
  name: string;
  defaultValue?: number | string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const initialDigits =
    defaultValue !== undefined && defaultValue !== "" ? String(defaultValue).replace(/\D/g, "") : "";
  const [digits, setDigits] = useState(initialDigits);

  return (
    <>
      <input type="hidden" name={name} value={digits} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={digits ? groupThousands(digits) : ""}
        onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
        required={required}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
      />
    </>
  );
}
