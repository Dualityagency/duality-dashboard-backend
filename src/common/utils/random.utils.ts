// src/common/utils/random.utils.ts

/**
 * Generates a random secure password containing uppercase, lowercase,
 * digits, and special characters.
 * @param length - Length of the generated password (default: 12)
 */
export function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const all = uppercase + lowercase + digits + special;

  // Ensure at least one character from each category
  const mandatoryChars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const remainingChars = Array.from(
    { length: length - mandatoryChars.length },
    () => all[Math.floor(Math.random() * all.length)],
  );

  // Shuffle to avoid predictable positions
  return [...mandatoryChars, ...remainingChars]
    .sort(() => Math.random() - 0.5)
    .join('');
}
