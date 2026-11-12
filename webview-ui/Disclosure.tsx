import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

interface DisclosureProps {
  title: string;
  meta?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function Disclosure({ title, meta, aside, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="disclosure min-w-0 flex-1" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <Icon name="chevron" className="chevron" />
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</span>
          {meta ? <span className="text-xs opacity-70">{meta}</span> : null}
        </button>
        {aside}
      </div>
      {open ? children : null}
    </section>
  );
}
