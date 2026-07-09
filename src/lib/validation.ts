import { ApiError } from "@/lib/api-helpers";

export function parseRequiredPositiveNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${field} must be greater than zero`);
  }
  return parsed;
}

export function parseRequiredNonNegativeNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(400, `${field} cannot be negative`);
  }
  return parsed;
}

export function parseOptionalNonNegativeNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return parseRequiredNonNegativeNumber(value, field);
}

export function parseOptionalPositiveNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return parseRequiredPositiveNumber(value, field);
}

export function parseOptionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} is invalid`);
  return date;
}

export function assertNotFutureDate(date: Date | null | undefined, field: string): void {
  if (!date) return;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (date > endOfToday) throw new ApiError(400, `${field} cannot be in the future`);
}

export function assertDateRange(startDate: Date | null | undefined, endDate: Date | null | undefined): void {
  if (startDate && endDate && endDate < startDate) {
    throw new ApiError(400, "End date cannot be before start date");
  }
}
