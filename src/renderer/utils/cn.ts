/**
 * cQikly — Class Name Utility
 * Standard shadcn/ui cn() helper using clsx + tailwind-merge.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
