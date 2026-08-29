"use client";

import { useEffect, useRef, useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Option = { value: string; label: string; hint?: string };

type Props = {
  name: string;
  label?: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
};

export function KuroSelect({ name, options, defaultValue, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // lock scroll when open on mobile? not needed

  return (
    <div ref={containerRef} className="kuro-select">
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((v) => !v)}
        className="kuro-select-trigger"
      >
        <span className="kuro-select-value">
          <span className="kuro-select-label">{selected?.label ?? placeholder}</span>
          {selected?.hint ? <span className="kuro-select-hint">{selected.hint}</span> : null}
        </span>
        <motion.span
          aria-hidden="true"
          className="kuro-select-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={id}
            className="kuro-select-panel"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setValue(opt.value);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={`kuro-select-option ${active ? "is-active" : ""}`}
                >
                  <span className="kuro-select-option-main">
                    <span className="kuro-select-option-dot" aria-hidden="true" />
                    <span>{opt.label}</span>
                  </span>
                  {opt.hint ? <span className="kuro-select-option-hint">{opt.hint}</span> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
