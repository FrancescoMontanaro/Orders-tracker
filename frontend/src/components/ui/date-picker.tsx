"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
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
      {/* No Portal: content stays inside the Dialog DOM tree so the
          Dialog's DismissableLayer does not intercept calendar clicks. */}
      <PopoverPrimitive.Content
        align="start"
        side="bottom"
        sideOffset={4}
        className="z-50 w-auto origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
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
      </PopoverPrimitive.Content>
    </Popover>
  );
}