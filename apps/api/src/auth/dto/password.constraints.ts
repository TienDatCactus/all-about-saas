/**
 * Shared password bounds, so raising the floor can't be done in one DTO and
 * forgotten in the other two.
 */

/**
 * OWASP's minimum for a user-chosen password. The previous `@MinLength(6)`
 * allowed a keyspace small enough that the 5/min login throttle was doing most
 * of the work on its own.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt truncates its input at 72 bytes and silently ignores the remainder, so
 * anything longer is a password whose tail does nothing. Rejecting is honest;
 * accepting would mean a 100-character passphrase is no stronger than its first
 * 72 characters while the user believes otherwise.
 */
export const PASSWORD_MAX_LENGTH = 72;
