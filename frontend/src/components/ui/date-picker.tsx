"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// --- Helpers for ISO conversion (safe, no timezone shift) ---
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function displayIT(iso: string): string {
  const d = fromISO(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export interface DatePickerProps {
  value?: string;                        // YYYY-MM-DD
  onChange?: (iso: string) => void;      // callback when a date is selected
  label?: string;                        // optional accessible label
  placeholder?: string;                  // text when no date is selected
  disabled?: boolean;
  className?: string;                    // extra classes for button
}

/**
 * DatePicker
 * Reusable date picker component based on shadcn/ui Popover + Calendar.
 * Controlled via ISO string value (YYYY-MM-DD).
 */
export function DatePicker({
  value,
  onChange,
  label = "Seleziona data",
  placeholder = "Seleziona data",
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDateObj = value ? fromISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className={`min-w-0 w-full max-w-full justify-between font-normal whitespace-nowrap ${className ?? ""}`}
        >
          <span className="truncate">
            {value ? displayIT(value) : placeholder}
          </span>
          <ChevronDownIcon className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-auto p-0 max-w-[calc(100vw-1rem)]"
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selectedDateObj}
          onSelect={(d) => {
            if (d && onChange) {
              onChange(toLocalISO(d));
            }
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}