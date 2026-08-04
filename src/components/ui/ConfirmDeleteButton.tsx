"use client";

export function ConfirmDeleteButton({
  action,
  id,
  confirmText,
  className,
  label = "✕",
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  confirmText: string;
  className?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" title="Ўчириш" className={className}>
        {label}
      </button>
    </form>
  );
}
