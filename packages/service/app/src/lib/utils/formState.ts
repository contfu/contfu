/**
 * Form state persistence utilities for handling OAuth redirects
 * Uses sessionStorage to preserve form data across navigation
 */

const STORAGE_KEY = "source-form-state";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export interface SourceFormData {
  name: string;
  selectedType: string;
  selectedAuthType: string;
  useOAuth: boolean;
  includeRef: boolean;
  url?: string;
  _credentials?: string;
}

interface StoredFormState extends SourceFormData {
  timestamp: number;
}

/**
 * Persist form state to sessionStorage before OAuth redirect
 * @param formData - The form data to persist
 */
export function persistFormState(formData: SourceFormData): void {
  try {
    const stateWithTimestamp: StoredFormState = {
      ...formData,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    // Handle quota exceeded or other storage errors gracefully
    console.error("Failed to persist form state:", error);
  }
}

/**
 * Restore form state from sessionStorage after OAuth return
 * Returns null if state is missing, expired, or invalid
 * @returns The restored form data or null
 */
export function restoreFormState(): SourceFormData | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as StoredFormState;
    const { timestamp, ...formData } = parsed;

    // Check if state has expired (older than 30 minutes)
    if (Date.now() - timestamp > EXPIRY_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return formData;
  } catch (error) {
    // Handle JSON parse errors or missing fields gracefully
    console.error("Failed to restore form state:", error);
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Clear persisted form state from sessionStorage
 * Call this after successful form submission
 */
export function clearFormState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear form state:", error);
  }
}
