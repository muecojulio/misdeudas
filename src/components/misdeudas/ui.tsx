import * as Switch from "@radix-ui/react-switch";
import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-sm text-mist">{hint}</span> : null}
    </label>
  );
}

export const controlClass =
  "h-12 w-full rounded-2xl border border-stone bg-surface px-3 text-base text-ink outline-none transition-colors focus:border-pine";

export function Toggle({
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone bg-surface px-3 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-mist">{hint}</span> : null}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="press relative h-7 w-12 shrink-0 rounded-full bg-stone outline-none data-[state=checked]:bg-pine focus-visible:ring-2 focus-visible:ring-pine"
        aria-label={label}
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-paper shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-6" />
      </Switch.Root>
    </div>
  );
}

export function PressButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`press ${className}`} {...props} />;
}

export function Progress({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone" aria-hidden>
      <div className="bar-fill h-full rounded-full bg-pine" style={{ width: `${width}%` }} />
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
      <button className="absolute inset-0 bg-ink/40" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="sheet-panel relative z-10 w-full overflow-y-auto rounded-t-3xl border border-stone bg-paper px-4 pt-3 pb-6 shadow-2xl md:max-w-lg md:rounded-3xl md:px-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone md:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="font-display text-2xl text-ink">
            {title}
          </h2>
          <PressButton
            className="grid size-11 place-items-center rounded-full border border-stone text-ink"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X className="size-5" strokeWidth={1.75} />
          </PressButton>
        </div>
        {children}
      </div>
    </div>
  );
}
