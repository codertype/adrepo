import bcrypt from 'bcrypt';

export class PasswordService {
  private readonly saltRounds = 12; // Strong salt rounds for security

  /**
   * Hash a plain text password
   */
  async hashPassword(plainPassword: string): Promise<string> {
    try {
      const hashedPassword = await bcrypt.hash(plainPassword, this.saltRounds);
      return hashedPassword;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a plain text password against a hashed password
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return isMatch;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (!password) {
      return { isValid: false, message: 'Password is required' };
    }

    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
      return { isValid: false, message: 'Password must not exceed 128 characters' };
    }

    // Check for at least one number, one letter
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);

    if (!hasNumber || !hasLetter) {
      return { isValid: false, message: 'Password must contain at least one letter and one number' };
    }

    return { isValid: true };
  }
}

export const passwordService = new PasswordService();