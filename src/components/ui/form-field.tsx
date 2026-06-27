"use client";
import { useState, useCallback } from "react";

interface FieldConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMsg?: string;
  validate?: (val: string) => string | null;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  config?: FieldConfig;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

function validate(value: string, cfg?: FieldConfig): string {
  if (!cfg) return "";
  if (cfg.required && !value.trim()) return `${""} This field is required.`;
  if (cfg.minLength && value.length < cfg.minLength) return `Must be at least ${cfg.minLength} characters.`;
  if (cfg.maxLength && value.length > cfg.maxLength) return `Must be at most ${cfg.maxLength} characters.`;
  if (cfg.pattern && !cfg.pattern.test(value)) return cfg.patternMsg || "Invalid format.";
  if (cfg.validate) return cfg.validate(value) || "";
  return "";
}

export function FormField({ label, value, onChange, type = "text", placeholder, config, className = "", rows, disabled }: FieldProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validate(value, config) : "";

  const base = `w-full border rounded-lg px-3 py-2 text-sm transition-colors outline-none focus:ring-2 ${error ? "border-red-400 focus:ring-red-200 bg-red-50" : "border-gray-200 focus:ring-blue-200 focus:border-blue-400"} ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""} ${className}`;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">
        {label}
        {config?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} onBlur={() => setTouched(true)} placeholder={placeholder} rows={rows} disabled={disabled} className={base} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onBlur={() => setTouched(true)} placeholder={placeholder} disabled={disabled} className={base} />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Hook for managing form validation state
export function useFormValidation<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<T>>({});

  const set = useCallback((key: keyof T, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  }, [errors]);

  const setError = useCallback((key: keyof T, msg: string) => {
    setErrors(prev => ({ ...prev, [key]: msg }));
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  return { values, set, errors, setError, clearErrors, setValues };
}
