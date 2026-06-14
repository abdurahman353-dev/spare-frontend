/**
 * Validation & sanitisation utilities for all frontend forms.
 */

// ── Phone number ─────────────────────────────────────────────────────────────

/** Validates Kenyan phone: 07xx, 01xx, +2547xx, 2547xx */
export function isValidKenyanPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return /^(\+?254|0)[71]\d{8}$/.test(cleaned);
}

/** Formats a Kenyan phone number to 2547XXXXXXXX */
export function formatKenyanPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+254')) return cleaned.slice(1);
    if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) return '254' + cleaned.slice(1);
    return cleaned;
}

// ── Text sanitisation ─────────────────────────────────────────────────────────

/** Trims and strips HTML-like characters from a string */
export function sanitizeText(value: string): string {
    return value
        .trim()
        .replace(/<[^>]*>/g, '')  // strip HTML tags
        .replace(/[<>"'`]/g, ''); // strip dangerous chars
}

// ── Email ─────────────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Password strength ─────────────────────────────────────────────────────────

export interface PasswordStrength {
    score: number; // 0-4
    label: 'Too Short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
    color: string;
    checks: {
        length: boolean;
        uppercase: boolean;
        lowercase: boolean;
        number: boolean;
        symbol: boolean;
    };
}

export function getPasswordStrength(password: string): PasswordStrength {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    const labels = ['Too Short', 'Weak', 'Fair', 'Good', 'Strong'] as const;
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

    return {
        score,
        label: score === 0 && !checks.length ? 'Too Short' : labels[score] ?? 'Too Short',
        color: colors[score] ?? colors[0],
        checks,
    };
}

// ── Shipping form ─────────────────────────────────────────────────────────────

export interface ShippingFormData {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phone: string;
}

export function validateShippingForm(data: ShippingFormData): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!data.firstName.trim()) errors.firstName = 'First name is required.';
    else if (data.firstName.trim().length > 100) errors.firstName = 'First name is too long.';

    if (!data.lastName.trim()) errors.lastName = 'Last name is required.';
    else if (data.lastName.trim().length > 100) errors.lastName = 'Last name is too long.';

    if (!data.address.trim()) errors.address = 'Address is required.';
    if (!data.city) errors.city = 'Please select a city.';
    if (!data.country) errors.country = 'Please select a country.';

    return errors;
}

// ── Payment form ──────────────────────────────────────────────────────────────

export function validatePaymentPhone(phone: string): string | null {
    if (!phone.trim()) return 'M-Pesa phone number is required.';
    if (!isValidKenyanPhone(phone)) return 'Enter a valid Kenyan phone number (e.g. 0712 345 678).';
    return null;
}
