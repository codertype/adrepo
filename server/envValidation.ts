/**
 * Environment Variable Validation for Production VPS Deployment
 * 
 * This module validates that all required environment variables are set
 * and properly formatted for production deployment on Hostinger VPS.
 */

interface ValidationError {
  variable: string;
  message: string;
  required: boolean;
  suggestion?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates all required environment variables for production deployment
 */
export function validateEnvironmentVariables(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Helper function to add error
  const addError = (variable: string, message: string, suggestion?: string) => {
    errors.push({ variable, message, required: true, suggestion });
  };

  // Helper function to add warning
  const addWarning = (variable: string, message: string, suggestion?: string) => {
    warnings.push({ variable, message, required: false, suggestion });
  };

  // ===========================================
  // 🏗️ DEPLOYMENT ENVIRONMENT VALIDATION
  // ===========================================
  if (!process.env.NODE_ENV) {
    addError('NODE_ENV', 'NODE_ENV must be set (development or production)', 
      'Set NODE_ENV=production for VPS deployment');
  }

  if (isProduction) {
    if (!process.env.DOMAIN) {
      addError('DOMAIN', 'DOMAIN must be set in production', 
        'Set DOMAIN=amritanshdairy.com for your production domain');
    }

    if (!process.env.HOST) {
      addWarning('HOST', 'HOST should be set in production', 
        'Set HOST=0.0.0.0 to allow external connections on VPS');
    }

    const port = process.env.PORT;
    if (!port || isNaN(parseInt(port))) {
      addWarning('PORT', 'PORT should be a valid number', 
        'Set PORT=3000 or your preferred port number');
    }
  }

  // ===========================================
  // 🗄️ DATABASE VALIDATION
  // ===========================================
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    addError('DATABASE_URL', 'DATABASE_URL is required for database connection', 
      'Get your PostgreSQL connection string from Hostinger or use Neon.tech');
  } else {
    // Validate PostgreSQL URL format
    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      addError('DATABASE_URL', 'DATABASE_URL must be a valid PostgreSQL connection string', 
        'Format: postgresql://username:password@host:port/database');
    }

    // Check for common SSL configuration in production
    if (isProduction && !databaseUrl.includes('sslmode=')) {
      addWarning('DATABASE_URL', 'Consider adding SSL mode to database connection in production', 
        'Add ?sslmode=require to your DATABASE_URL');
    }
  }

  // ===========================================
  // 🔐 SECURITY VALIDATION
  // ===========================================
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    addError('SESSION_SECRET', 'SESSION_SECRET is required for secure sessions', 
      'Generate with: openssl rand -base64 32');
  } else if (sessionSecret.length < 32) {
    addError('SESSION_SECRET', 'SESSION_SECRET must be at least 32 characters for security', 
      'Generate a longer secret with: openssl rand -base64 48');
  }

  // ===========================================
  // 📧 EMAIL CONFIGURATION VALIDATION
  // ===========================================
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser) {
    if (isProduction) {
      addError('GMAIL_USER', 'GMAIL_USER is required for sending emails and OTP in production', 
        'Set your Gmail address for sending system emails');
    } else {
      addWarning('GMAIL_USER', 'GMAIL_USER not set - email features will be disabled in development', 
        'Add Gmail credentials to enable email and OTP functionality');
    }
  } else if (!gmailUser.includes('@gmail.com')) {
    addWarning('GMAIL_USER', 'GMAIL_USER should be a valid Gmail address', 
      'Use a Gmail address for best compatibility with nodemailer');
  }

  if (!gmailPassword) {
    if (isProduction) {
      addError('GMAIL_APP_PASSWORD', 'GMAIL_APP_PASSWORD is required for Gmail SMTP in production', 
        'Generate app password from Gmail settings: https://support.google.com/accounts/answer/185833');
    } else {
      addWarning('GMAIL_APP_PASSWORD', 'GMAIL_APP_PASSWORD not set - email features will be disabled in development', 
        'Generate app password from Gmail settings to enable email functionality');
    }
  } else if (gmailPassword.length !== 16 || gmailPassword.includes(' ')) {
    addWarning('GMAIL_APP_PASSWORD', 'GMAIL_APP_PASSWORD should be 16 characters without spaces', 
      'App passwords are 16 characters long (xxxx xxxx xxxx xxxx) but should be entered without spaces');
  }

  // ===========================================
  // 📱 SMS/WHATSAPP SERVICE VALIDATION
  // ===========================================
  const aiSensyApiKey = process.env.AISENSY_API_KEY;
  
  if (!aiSensyApiKey) {
    if (isProduction) {
      addError('AISENSY_API_KEY', 'AISENSY_API_KEY is required for SMS/WhatsApp OTP in production', 
        'Get your AiSensy API key from dashboard and set it as environment variable');
    } else {
      addWarning('AISENSY_API_KEY', 'AISENSY_API_KEY not set - SMS/WhatsApp features will be disabled in development', 
        'Add AiSensy API key to enable SMS/WhatsApp OTP functionality');
    }
  } else if (!aiSensyApiKey.startsWith('eyJ')) {
    addWarning('AISENSY_API_KEY', 'AISENSY_API_KEY should be a valid JWT token', 
      'Verify your AiSensy API key format from dashboard');
  }

  // ===========================================
  // 💳 PAYMENT GATEWAY VALIDATION
  // ===========================================
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId) {
    if (isProduction) {
      addError('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID is required for payment processing', 
        'Get your Razorpay key from: https://dashboard.razorpay.com/app/keys');
    } else {
      addWarning('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID not set - payment features will be disabled', 
        'Add Razorpay credentials to enable payments');
    }
  } else {
    // Validate Razorpay key format
    const isTestKey = razorpayKeyId.startsWith('rzp_test_');
    const isLiveKey = razorpayKeyId.startsWith('rzp_live_');
    
    if (!isTestKey && !isLiveKey) {
      addError('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_', 
        'Verify your Razorpay key format from dashboard');
    }

    if (isProduction && isTestKey) {
      addWarning('RAZORPAY_KEY_ID', 'Using test key in production - payments will not work with real money', 
        'Use rzp_live_ key for production payments');
    }

    if (!isProduction && isLiveKey) {
      addWarning('RAZORPAY_KEY_ID', 'Using live key in development - be careful with real transactions', 
        'Consider using rzp_test_ key for development');
    }
  }

  if (!razorpaySecret) {
    if (isProduction) {
      addError('RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_SECRET is required for payment verification', 
        'Get your Razorpay secret from: https://dashboard.razorpay.com/app/keys');
    } else {
      addWarning('RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_SECRET not set - payment verification will fail', 
        'Add Razorpay secret to enable payment processing');
    }
  }

  // ===========================================
  // 🔧 SSL & ADMIN CONFIGURATION
  // ===========================================
  if (isProduction && !process.env.ADMIN_EMAIL) {
    addWarning('ADMIN_EMAIL', 'ADMIN_EMAIL should be set for SSL certificate registration', 
      'Set your email for Let\'s Encrypt SSL certificates');
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && !adminEmail.includes('@')) {
    addError('ADMIN_EMAIL', 'ADMIN_EMAIL must be a valid email address', 
      'Use a valid email for SSL certificate notifications');
  }

  // ===========================================
  // 📁 STORAGE CONFIGURATION (Optional)
  // ===========================================
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  
  if (publicPaths || privateDir) {
    if (publicPaths && !privateDir) {
      addWarning('PRIVATE_OBJECT_DIR', 'PRIVATE_OBJECT_DIR should be set when using object storage', 
        'Set private directory for secure file uploads');
    }
    if (privateDir && !publicPaths) {
      addWarning('PUBLIC_OBJECT_SEARCH_PATHS', 'PUBLIC_OBJECT_SEARCH_PATHS should be set when using object storage', 
        'Set public paths for accessible files');
    }
  }

  // ===========================================
  // 🌐 BUSINESS CONFIGURATION (Optional)
  // ===========================================
  if (!process.env.PLATFORM_NAME) {
    addWarning('PLATFORM_NAME', 'PLATFORM_NAME not set - using default', 
      'Set your business name for email branding');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates critical environment variables and throws if any are missing
 * Use this during application startup
 */
export function validateCriticalEnvironmentVariables(): void {
  const result = validateEnvironmentVariables();
  
  if (!result.isValid) {
    console.error('❌ Critical Environment Variables Missing:');
    console.error('='.repeat(60));
    
    result.errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error.variable}: ${error.message}`);
      if (error.suggestion) {
        console.error(`   💡 Suggestion: ${error.suggestion}`);
      }
      console.error('');
    });
    
    console.error('Please set the required environment variables and restart the application.');
    console.error('Refer to .env.example for complete configuration options.');
    
    throw new Error('Critical environment variables are missing. Cannot start application.');
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment Configuration Warnings:');
    console.warn('='.repeat(50));
    
    result.warnings.forEach((warning, index) => {
      console.warn(`${index + 1}. ${warning.variable}: ${warning.message}`);
      if (warning.suggestion) {
        console.warn(`   💡 Suggestion: ${warning.suggestion}`);
      }
      console.warn('');
    });
  }
}

/**
 * Returns a summary of the current environment configuration
 */
export function getEnvironmentSummary(): Record<string, string> {
  return {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    DOMAIN: process.env.DOMAIN || 'not set',
    HOST: process.env.HOST || 'not set', 
    PORT: process.env.PORT || 'not set',
    DATABASE_URL: process.env.DATABASE_URL ? '✓ configured' : '✗ missing',
    SESSION_SECRET: process.env.SESSION_SECRET ? '✓ configured' : '✗ missing',
    GMAIL_USER: process.env.GMAIL_USER || '✗ missing',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? '✓ configured' : '✗ missing',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '✗ missing',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? '✓ configured' : '✗ missing',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'not set',
    PLATFORM_NAME: process.env.PLATFORM_NAME || 'Amrit Dairy (default)'
  };
}

/**
 * Prints a detailed environment configuration report
 */
export function printEnvironmentReport(): void {
  console.log('🏗️ Environment Configuration Report');
  console.log('='.repeat(50));
  
  const summary = getEnvironmentSummary();
  Object.entries(summary).forEach(([key, value]) => {
    const status = value.includes('✓') ? '✅' : value.includes('✗') ? '❌' : '⚠️';
    console.log(`${status} ${key}: ${value}`);
  });
  
  console.log('='.repeat(50));
  
  const result = validateEnvironmentVariables();
  if (result.isValid) {
    console.log('✅ All critical environment variables are properly configured!');
  } else {
    console.log(`❌ ${result.errors.length} critical issue(s) found`);
  }
  
  if (result.warnings.length > 0) {
    console.log(`⚠️ ${result.warnings.length} warning(s) - see details above`);
  }
}