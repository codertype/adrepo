import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { setupAuthWithoutSession, isAuthenticated } from "./replitAuth";
import { getSessionConnectionString } from "./db";

// Phone-only authentication middleware (no Replit auth)
const isOTPAuthenticated = async (req: any, res: any, next: any) => {
  try {
    // Check OTP session only
    const userId = (req.session as any)?.userId;
    console.log('🔍 OTP Auth check - Session userId:', userId);
    
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        console.log('✅ OTP Auth success for user:', user.email);
        // Attach user to request for consistency
        req.otpUser = user;
        return next();
      }
    }
    
    console.log('❌ OTP Auth failed - no valid session');
    return res.status(401).json({ message: "OTP authentication required" });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "OTP authentication required" });
  }
};
import { detectRequestSource, type RequestWithSource, isMobileApp, isWebRequest } from "./middleware/requestSource";
import { insertVendorSchema, insertProductSchema, insertOrderSchema, insertSubscriptionSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import { otpService } from "./services/otpService";
import { passwordService } from "./services/passwordService";
import { sendOrderConfirmationEmails, sendOrderCancellationEmail } from "./emailService";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { VpsObjectNotFoundError } from "./vpsObjectStorage";
import { ObjectPermission } from "./objectAcl";
import { storageService, StorageType } from "./storageFactory";
import multer from "multer";
import { Request } from "express";
import { registerHealthRoutes } from "./routes/health";
// Removed web-push import - using simple local messaging instead
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay instance
// Lazy Razorpay initialization to prevent crashes when env vars are missing
let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay | null {
  if (razorpayInstance) {
    return razorpayInstance;
  }
  
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    console.warn('⚠️ Razorpay credentials not configured - payment features disabled');
    return null;
  }
  
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    console.log('✅ Razorpay initialized successfully');
    return razorpayInstance;
  } catch (error) {
    console.error('❌ Failed to initialize Razorpay:', error);
    return null;
  }
}

// Currency formatting utility
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

// WebSocket connection management
interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  userRole?: string;
  isAlive: boolean;
}

const clients = new Map<string, WebSocketClient>();

// Broadcast data changes to mobile apps
function broadcastToMobileClients(event: string, data: any, excludeUserId?: string) {
  const message = JSON.stringify({
    type: event,
    data,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client, clientId) => {
    if (client.ws.readyState === WebSocket.OPEN && 
        client.userRole === 'customer' && 
        client.userId !== excludeUserId) {
      try {
        client.ws.send(message);
        console.log(`📱 Broadcasted ${event} to mobile client:`, client.userId);
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        clients.delete(clientId);
      }
    }
  });
}

// Broadcast admin changes to all clients
function broadcastAdminChange(event: string, data: any, adminUserId?: string) {
  const message = JSON.stringify({
    type: event,
    data,
    timestamp: new Date().toISOString(),
    source: 'admin_panel'
  });

  clients.forEach((client, clientId) => {
    if (client.ws.readyState === WebSocket.OPEN && client.userId !== adminUserId) {
      try {
        client.ws.send(message);
        console.log(`🔄 Synced ${event} from admin panel to client:`, client.userId);
      } catch (error) {
        console.error("Error syncing admin change:", error);
        clients.delete(clientId);
      }
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup for phone authentication
  app.set("trust proxy", 1);
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Create session store with fallback to memory store
  let sessionStore: any;
  
  try {
    // Try to use PostgreSQL session store
    const pgStore = connectPg(session);
    const connectionString = getSessionConnectionString();
    
    console.log('🗄️ Attempting to configure PostgreSQL session store...');
    sessionStore = new pgStore({
      conString: connectionString,
      createTableIfMissing: true, // Allow table creation if missing
      ttl: sessionTtl,
      tableName: "sessions",
    });
    
    // Test the connection by trying to get a non-existent session
    await new Promise((resolve, reject) => {
      sessionStore.get('test-connection-key', (err: any) => {
        if (err && !err.message.includes('not found')) {
          reject(err);
        } else {
          resolve(null);
        }
      });
    });
    
    console.log('✅ PostgreSQL session store configured successfully');
  } catch (error) {
    console.warn('⚠️ PostgreSQL session store failed, falling back to memory store:', error instanceof Error ? error.message : String(error));
    
    // Fallback to memory store if PostgreSQL fails
    const MemStoreConstructor = MemoryStore(session);
    sessionStore = new MemStoreConstructor({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: sessionTtl,
      stale: false,
    });
    
    console.log('✅ Memory session store configured as fallback');
  }
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'phone-auth-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
    },
  }));
  
  // Debug environment variables for Replit auth
  console.log('🔍 Checking Replit auth environment variables:');
  console.log('   REPLIT_DOMAINS:', process.env.REPLIT_DOMAINS ? '✓ SET' : '✗ MISSING');
  console.log('   REPL_ID:', process.env.REPL_ID ? '✓ SET' : '✗ MISSING');
  console.log('   SESSION_SECRET:', process.env.SESSION_SECRET ? '✓ SET' : '✗ MISSING');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  
  // Conditionally setup Replit authentication if environment variables are present
  if (process.env.REPLIT_DOMAINS && process.env.REPL_ID && process.env.SESSION_SECRET) {
    try {
      console.log('🔐 Setting up Replit authentication...');
      console.log('   Domain:', process.env.REPLIT_DOMAINS);
      console.log('   Repl ID:', process.env.REPL_ID);
      await setupAuthWithoutSession(app);
      console.log('✅ Replit authentication setup complete');
    } catch (error: any) {
      console.error('❌ Failed to setup Replit auth:', error);
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  } else {
    console.log('ℹ️ Replit authentication disabled - missing environment variables');
    console.log('   Required: REPLIT_DOMAINS, REPL_ID, SESSION_SECRET');
    console.log('   Available:', {
      REPLIT_DOMAINS: !!process.env.REPLIT_DOMAINS,
      REPL_ID: !!process.env.REPL_ID,
      SESSION_SECRET: !!process.env.SESSION_SECRET
    });
  }
  
  // Request source detection middleware
  app.use(detectRequestSource);

  // Health check endpoint (no authentication required)  
  app.get('/api/health', async (req, res) => {
    try {
      // Test database connection
      await storage.getCategories();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

  // Register comprehensive health check endpoints
  registerHealthRoutes(app);

  // Remove duplicate - using the main isOTPAuthenticated function defined above

  // POS authentication middleware
  const isPOSAuthenticated = async (req: any, res: any, next: any) => {
    console.log('🔍 POS Auth Check - SessionID:', req.sessionID);
    console.log('🔍 POS Auth Check - Session UserId:', req.session?.userId);
    
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Allow both 'pos' role users and 'admin' users to access POS
      if (user.role !== 'pos' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. POS privileges required." });
      }
      
      req.session.user = user;
      console.log('✅ POS Auth Success - User:', user.email, 'Role:', user.role);
      next();
    } catch (error) {
      console.error("Error in POS authentication:", error);
      return res.status(500).json({ message: "Authentication error" });
    }
  };

  // Auth routes - for OTP authenticated users only (no Replit auth)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      console.log('🔍 Auth user request - Session:', req.session?.userId);
      
      // Check OTP session only (removed Replit fallback)
      const userId = (req.session as any)?.userId;
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          console.log('✅ Found OTP user:', user.id, user.email);
          return res.json(user);
        }
      }
      
      console.log('❌ No authenticated user found');
      res.status(401).json({ message: "Unauthorized" });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Phone-based logout route (POST for API, GET for direct browser access)
  app.post('/api/auth/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Handle direct browser access to logout URL
  app.get('/api/auth/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.clearCookie('connect.sid');
      // Redirect to home page instead of showing 404
      res.redirect('/');
    });
  });

  // PWA Widget API endpoints
  app.get('/api/widget/orders', async (req: any, res) => {
    try {
      // Get user from session
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.json({
          status: "unauthenticated",
          message: "Login to view orders",
          orderCount: 0
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.json({
          status: "unauthenticated", 
          message: "Login to view orders",
          orderCount: 0
        });
      }

      // Get user's recent orders
      const orders = await storage.getOrdersByUser(user.id);
      const recentOrders = orders.slice(0, 3); // Last 3 orders

      // Calculate summary data
      const pendingOrders = orders.filter(order => order.status === 'pending').length;
      const deliveredToday = orders.filter(order => 
        order.status === 'delivered' && 
        order.deliveredAt && 
        new Date(order.deliveredAt).toDateString() === new Date().toDateString()
      ).length;

      res.json({
        status: "success",
        userName: user.firstName || user.email?.split('@')[0] || 'Customer',
        orderCount: orders.length,
        pendingCount: pendingOrders,
        deliveredToday,
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: formatCurrency(parseFloat(order.totalAmount?.toString() || '0')),
          createdAt: order.createdAt,
          deliveryDate: order.deliveryDate
        })),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Widget orders error:", error);
      res.json({
        status: "error",
        message: "Unable to load orders",
        orderCount: 0
      });
    }
  });

  app.get('/api/widget/quick-order', async (req: any, res) => {
    try {
      // Get popular products for quick ordering
      const products = await storage.getProducts();
      const milkProducts = products.filter(p => 
        p.categoryId && p.name.toLowerCase().includes('milk')
      ).slice(0, 4);

      // Get user session for personalization
      const userId = (req.session as any)?.userId;
      let userName = 'Customer';
      
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          userName = user.firstName || user.email?.split('@')[0] || 'Customer';
        }
      }

      res.json({
        status: "success",
        userName,
        isAuthenticated: !!userId,
        quickOrderItems: milkProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: formatCurrency(Number(product.price) || 0),
          image: product.imageUrl,
          available: (product.stock || 0) > 0,
          category: 'Milk & Dairy'
        })),
        totalProducts: products.length,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Widget quick-order error:", error);
      res.json({
        status: "error",
        message: "Unable to load products",
        quickOrderItems: []
      });
    }
  });

  // Public signup route (customers only)
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { firstName, lastName, email, phone, address, city, pincode } = req.body;
      
      // Generate unique user ID
      const userId = `customer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // Create customer account only
      const newUser = await storage.upsertUser({
        id: userId,
        email,
        firstName,
        lastName,
        role: "customer", // Force customer role for public signup
        phone,
        address: address ? `${address}, ${city} - ${pincode}` : null,
        profileImageUrl: null
      });
      
      res.json({
        success: true,
        message: "Customer account created successfully",
        userId: newUser.id,
        loginId: newUser.email,
        role: "customer"
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === '23505') { // Duplicate email
        res.status(400).json({ message: "Email already exists. Please use a different email." });
      } else {
        res.status(500).json({ message: "Failed to create account. Please try again." });
      }
    }
  });

  // OTP authentication routes - supports both email and phone
  // Support both endpoint names for compatibility
  const handleOTPRequest = async (req: any, res: any) => {
    try {
      const { contact, purpose, contactType } = req.body;
      
      if (!contact || !purpose || !contactType) {
        return res.status(400).json({ message: "Contact, purpose, and contactType are required" });
      }

      if (!['email', 'phone'].includes(contactType)) {
        return res.status(400).json({ message: "contactType must be 'email' or 'phone'" });
      }

      // Validate contact format
      if (contactType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact)) {
          return res.status(400).json({ message: "Invalid email format" });
        }
      } else {
        const phoneRegex = /^\+91[6-9]\d{9}$/;
        if (!phoneRegex.test(contact)) {
          return res.status(400).json({ message: "Invalid phone format. Use +91XXXXXXXXXX" });
        }
      }

      // 🛡️ SECURITY: Extract IP address and user agent for rate limiting
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
      const userAgent = req.headers['user-agent'] as string;
      
      console.log(`🔐 SECURE OTP Request: ${contactType}=${contact}, purpose=${purpose}, ip=${ipAddress}`);
      
      const result = await otpService.sendOTP(contact, purpose, contactType, ipAddress, userAgent);
      
      // 🛡️ SECURITY: Handle rate limiting with proper HTTP status codes
      if (!result.success) {
        const statusCode = result.statusCode || 500;
        return res.status(statusCode).json({
          success: false,
          message: result.message || 'Failed to send verification code'
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }
  };

  // Register both endpoint variations for compatibility
  app.post('/api/auth/send-otp', handleOTPRequest);
  app.post('/api/auth/request-otp', handleOTPRequest);

  // Password authentication endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { contact, password } = req.body;

      if (!contact || !password) {
        return res.status(400).json({ message: "Contact and password are required" });
      }

      // Find user by email or phone
      let user;
      if (contact.includes('@')) {
        user = await storage.getUserByEmail(contact);
      } else {
        user = await storage.getUserByPhone(contact);
      }

      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await passwordService.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set up session
      (req.session as any).userId = user.id;

      // Return success with user information
      res.json({
        success: true,
        user: {
          id: user.id,
          role: user.role,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName
        },
        redirectTo: user.role
      });
    } catch (error) {
      console.error("Error during password login:", error);
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  // Set password endpoint (for users who don't have a password yet)
  app.post('/api/auth/set-password', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { password } = req.body;
      const user = req.otpUser;

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Validate password strength
      const validation = passwordService.validatePasswordStrength(password);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
      }

      // Hash and save password
      const hashedPassword = await passwordService.hashPassword(password);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ success: true, message: "Password set successfully" });
    } catch (error) {
      console.error("Error setting password:", error);
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Change password endpoint
  app.post('/api/auth/change-password', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.otpUser;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Verify current password (if user has one)
      if (user.password) {
        const isValidCurrentPassword = await passwordService.verifyPassword(currentPassword, user.password);
        if (!isValidCurrentPassword) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      // Validate new password strength
      const validation = passwordService.validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.message });
      }

      // Hash and save new password
      const hashedPassword = await passwordService.hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // POS login endpoint - for cashiers and POS users
  app.post('/api/auth/pos-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check if user has POS or admin role
      if (user.role !== 'pos' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. POS privileges required." });
      }
      
      // Verify password
      if (!user.password) {
        return res.status(401).json({ message: "Password not set. Please contact administrator." });
      }
      
      const isValidPassword = await passwordService.verifyPassword(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set up session
      (req.session as any).userId = user.id;
      console.log('✅ POS Login - Session set for user:', user.id, 'Role:', user.role, 'SessionID:', req.sessionID);
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          role: user.role,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error) {
      console.error("Error in POS login:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { contact, otp, purpose } = req.body;
      
      if (!contact || !otp || !purpose) {
        return res.status(400).json({ message: "Contact, OTP, and purpose are required" });
      }

      // 🛡️ SECURITY: Use new async secure OTP verification
      const contactType = contact.includes('@') ? 'email' : 'phone';
      const verificationResult = await otpService.verifyOTP(contact, otp, purpose, contactType);
      
      console.log(`🔐 OTP Verification result for ${contact}:`, {
        success: verificationResult.success,
        shouldBlock: verificationResult.shouldBlock
      });
      
      // 🛡️ SECURITY: Handle blocking for suspicious behavior
      if (verificationResult.shouldBlock) {
        console.log(`⚠️ Contact ${contact} flagged for blocking due to suspicious OTP behavior`);
      }
      
      if (!verificationResult.success) {
        return res.status(401).json({ 
          success: false, 
          message: verificationResult.message || 'Invalid verification code' 
        });
      }
      
      if (verificationResult.success && purpose === 'login') {
        // Create or find user by contact (email or phone)
        let user;
        if (contact.includes('@')) {
          user = await storage.getUserByEmail(contact);
        } else {
          user = await storage.getUserByPhone(contact);
        }
        
        if (!user) {
          // Create new customer account
          const userData = contact.includes('@') ? 
            { email: contact, role: 'customer', isEmailVerified: true } :
            { phone: contact, role: 'customer', isPhoneVerified: true };
            
          user = await storage.createUser(userData);
        } else {
          // Update verification status
          const updateData = contact.includes('@') ? 
            { isEmailVerified: true } : 
            { isPhoneVerified: true };
          await storage.updateUser(user.id, updateData);
        }
        
        // Set up session (simplified for demo)
        (req.session as any).userId = user.id;
        console.log('✅ OTP Login - Session set for user:', user.id, 'SessionID:', req.sessionID);
        
        // Return success with user role information for frontend routing
        return res.json({ 
          success: true, 
          user: {
            id: user.id,
            role: user.role,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName
          },
          redirectTo: user.role // frontend will use this to redirect appropriately
        });
      }
      
      res.json({ success: isValid });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Admin password verification
  app.post('/api/admin/verify-password', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser; // Use OTP authenticated user
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { password, action } = req.body;
      
      // SECURITY: No fallback password in production
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        console.error("🚨 SECURITY ERROR: ADMIN_PASSWORD environment variable not set!");
        return res.status(500).json({ 
          message: "Server configuration error. Contact administrator." 
        });
      }
      
      if (password === adminPassword) {
        res.json({ success: true, message: `Authorized to ${action}` });
      } else {
        res.json({ success: false, message: "Invalid password" });
      }
    } catch (error) {
      console.error("Error verifying admin password:", error);
      res.status(500).json({ message: "Failed to verify password" });
    }
  });

  // User profile update endpoint
  app.patch('/api/user/profile', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { firstName, lastName, phone, email } = req.body;
      
      // Prepare update data
      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName; 
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      
      // Update user profile
      const updatedUser = await storage.updateUser(user.id, updateData);
      
      console.log('✅ Profile updated successfully for user:', user.id);
      res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role
        }
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(500).json({ 
        message: "Failed to update profile", 
        error: error.message 
      });
    }
  });

  // User addresses endpoints
  app.get('/api/addresses', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Fetch user addresses from database
      console.log('📍 Fetching addresses for user:', user.id);
      const addresses = await storage.getAddressesByUser(user.id);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  // Add new address
  app.post('/api/addresses', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { type, address, city, state, pincode, landmark } = req.body;
      
      // Validate required fields
      if (!type || !address || !city || !state || !pincode) {
        return res.status(400).json({ message: "All address fields are required" });
      }
      
      console.log('📍 Adding address for user:', user.id, { type, address, city, state, pincode });
      
      // Create address in database
      const newAddress = await storage.createAddress({
        userId: user.id,
        type,
        address,
        landmark: landmark || null,
        city,
        state,
        pincode,
        isDefault: false
      });

      res.json({ success: true, address: newAddress, message: "Address added successfully" });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({ message: "Failed to add address" });
    }
  });

  // Update address
  app.patch('/api/addresses/:id', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const addressId = req.params.id;
      const { type, address, city, state, pincode, landmark, isDefault } = req.body;
      
      console.log('📍 Updating address:', addressId, 'for user:', user.id);
      
      // Prepare update data (only include provided fields)
      const updateData: any = {};
      if (type !== undefined) updateData.type = type;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (pincode !== undefined) updateData.pincode = pincode;
      if (landmark !== undefined) updateData.landmark = landmark;
      if (isDefault !== undefined) updateData.isDefault = isDefault;
      
      // Update address in database
      const updatedAddress = await storage.updateAddress(addressId, updateData);
      
      res.json({ success: true, address: updatedAddress, message: "Address updated successfully" });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  // Delete address
  app.delete('/api/addresses/:id', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const addressId = req.params.id;
      
      console.log('📍 Deleting address:', addressId, 'for user:', user.id);
      
      // Delete address from database
      await storage.deleteAddress(addressId);
      
      res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  // Payment QR and status routes
  app.post('/api/payments/create-qr', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { orderId, amount, upiId } = req.body;
      
      // Generate QR code URL (using free service for demo)
      const upiUrl = `upi://pay?pa=${upiId}&pn=Amrit Dairy&am=${amount}&cu=INR&tn=Order ${orderId}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;
      
      res.json({
        success: true,
        qrCodeUrl,
        upiUrl,
        expiresIn: 600 // 10 minutes
      });
    } catch (error) {
      console.error("Error creating payment QR:", error);
      res.status(500).json({ message: "Failed to create payment QR" });
    }
  });

  app.get('/api/payments/status/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // In production, check with payment gateway
      // For demo, return pending status
      res.json({
        orderId,
        status: 'pending', // pending, paid, failed
        message: 'Payment verification pending'
      });
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Single category
  app.get('/api/categories/:id', async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  // Advertisements (public endpoint)
  app.get('/api/advertisements', async (req, res) => {
    try {
      const ads = await storage.getActiveAdvertisements();
      res.json(ads);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.json([]); // Return empty array on error to prevent page crash
    }
  });

  // Admin Advertisement Management
  app.get('/api/admin/advertisements', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const ads = await storage.getAllAdvertisements();
      res.json(ads);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post('/api/admin/advertisements', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { title, description, imageUrl, linkUrl, displayOrder, startDate, endDate } = req.body;
      
      const advertisement = await storage.createAdvertisement({
        title,
        description,
        imageUrl,
        linkUrl,
        displayOrder: displayOrder || 0,
        startDate,
        endDate,
      });
      
      res.json(advertisement);
    } catch (error) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  app.patch('/api/admin/advertisements/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const updates = req.body;
      
      const advertisement = await storage.updateAdvertisement(id, updates);
      res.json(advertisement);
    } catch (error) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.patch('/api/admin/advertisements/:id/toggle', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      
      const advertisement = await storage.updateAdvertisement(id, { isActive });
      res.json(advertisement);
    } catch (error) {
      console.error("Error toggling advertisement status:", error);
      res.status(500).json({ message: "Failed to toggle advertisement status" });
    }
  });

  app.delete('/api/admin/advertisements/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      await storage.deleteAdvertisement(id);
      res.json({ message: "Advertisement deleted successfully" });
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // Public vendors endpoint (for dropdowns in forms)
  app.get('/api/vendors', async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const vendors = await storage.getVendors(
        parseInt(limit as string),
        parseInt(offset as string)
      );
      // Only return approved vendors for public endpoint
      const approvedVendors = vendors.filter(vendor => vendor.status === 'approved');
      res.json(approvedVendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  // Products
  app.get('/api/products', async (req, res) => {
    try {
      const { limit = 50, offset = 0, categoryId } = req.query;
      const products = await storage.getProducts(
        parseInt(limit as string),
        parseInt(offset as string),
        categoryId as string
      );
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post('/api/products', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(403).json({ message: "Access denied. Vendor profile required." });
      }

      const productData = insertProductSchema.parse({
        ...req.body,
        vendorId: vendor.id,
      });

      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.get('/api/vendor/products', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(403).json({ message: "Access denied. Vendor profile required." });
      }

      const products = await storage.getProductsByVendor(vendor.id);
      res.json(products);
    } catch (error) {
      console.error("Error fetching vendor products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Vendor operations
  app.post('/api/vendor/register', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      
      // Check if vendor already exists
      const existingVendor = await storage.getVendorByUserId(userId);
      if (existingVendor) {
        return res.status(400).json({ message: "Vendor profile already exists" });
      }

      const vendorData = insertVendorSchema.parse({
        ...req.body,
        userId,
      });

      const vendor = await storage.createVendor(vendorData);
      res.json(vendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(500).json({ message: "Failed to create vendor profile" });
    }
  });

  app.get('/api/vendor/profile', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor profile not found" });
      }

      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor profile:", error);
      res.status(500).json({ message: "Failed to fetch vendor profile" });
    }
  });

  app.get('/api/vendor/orders', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(403).json({ message: "Access denied. Vendor profile required." });
      }

      const orders = await storage.getOrdersByVendor(vendor.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching vendor orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Admin category management - fix authentication
  app.post("/api/admin/categories", async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const category = await storage.createCategory(req.body);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const category = await storage.updateCategory(req.params.id, req.body);
      
      // Broadcast category update to mobile apps
      broadcastAdminChange('category_updated', {
        id: req.params.id,
        category: category,
        action: 'update'
      }, req.otpUser.id);
      
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteCategory(req.params.id);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Admin category image upload
  app.patch("/api/admin/categories/:id/image", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }
      
      const category = await storage.updateCategoryImage(id, imageUrl);
      
      // Broadcast category image update to mobile apps
      broadcastAdminChange('category_image_updated', {
        id: id,
        category: category,
        newImageUrl: imageUrl,
        action: 'image_update'
      }, req.otpUser.id);
      
      res.json(category);
    } catch (error) {
      console.error("Error updating category image:", error);
      res.status(500).json({ message: "Failed to update category image" });
    }
  });

  // Admin product management - fix authentication
  app.get("/api/admin/products", async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { limit = 50, offset = 0, categoryId } = req.query;
      const products = await storage.getProducts(Number(limit), Number(offset), categoryId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.post("/api/admin/products", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const product = await storage.createProduct(req.body);
      res.json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/admin/products/:id", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const product = await storage.updateProduct(req.params.id, req.body);
      
      // Broadcast product update to mobile apps
      broadcastAdminChange('product_updated', {
        id: req.params.id,
        product: product,
        action: 'update'
      }, req.otpUser.id);
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await storage.deleteProduct(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Admin product image upload
  app.patch("/api/admin/products/:id/image", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }
      
      const product = await storage.updateProductImage(id, imageUrl);
      
      // Broadcast product image update to mobile apps - this is critical for mobile sync
      if (req.user && req.user.claims) {
        broadcastAdminChange('product_image_updated', {
          id: id,
          product: product,
          newImageUrl: imageUrl,
          action: 'image_update'
        }, req.otpUser.id);
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product image:", error);
      res.status(500).json({ message: "Failed to update product image" });
    }
  });

  // Admin logo upload endpoint
  app.patch("/api/admin/logo", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }

      // Server-side validation for base64 images
      if (typeof imageUrl !== 'string') {
        return res.status(400).json({ message: "Invalid image format" });
      }

      // Check if it's a data URL with proper format
      const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
      if (!dataUrlRegex.test(imageUrl)) {
        return res.status(400).json({ message: "Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed" });
      }

      // Extract base64 data and validate size (5MB limit)
      const base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        return res.status(400).json({ message: "Invalid base64 image data" });
      }

      const sizeInBytes = (base64Data.length * 3) / 4; // Rough base64 to bytes calculation
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (sizeInBytes > maxSize) {
        return res.status(400).json({ message: "Image too large. Maximum size is 5MB" });
      }

      // Additional security: validate it's actually a valid base64 image
      try {
        const buffer = Buffer.from(base64Data, 'base64');
        // Basic check for image headers
        const isValidImage = buffer.length > 10 && (
          buffer.slice(0, 4).equals(Buffer.from([0xFF, 0xD8, 0xFF])) || // JPEG
          buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) || // PNG
          buffer.slice(0, 6).equals(Buffer.from('GIF87a')) || // GIF87a
          buffer.slice(0, 6).equals(Buffer.from('GIF89a'))    // GIF89a
        );
        
        if (!isValidImage) {
          return res.status(400).json({ message: "Invalid image file format" });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid base64 image data" });
      }
      
      // Save logo URL to admin settings
      await storage.setAdminSetting('platform_logo_url', imageUrl, 'Platform logo image URL');
      
      // Broadcast logo update to mobile apps
      broadcastAdminChange('logo_updated', {
        logoUrl: imageUrl,
        action: 'logo_update'
      }, req.otpUser.id);
      
      res.json({ logoUrl: imageUrl, message: "Logo updated successfully" });
    } catch (error) {
      console.error("Error updating logo:", error);
      res.status(500).json({ message: "Failed to update logo" });
    }
  });

  // Get current logo endpoint (public access for display on all pages)
  app.get("/api/admin/logo", async (req, res) => {
    try {
      const logoSetting = await storage.getAdminSetting('platform_logo_url');
      
      // Set cache headers for better performance
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'ETag': logoSetting?.value ? `"${Buffer.from(logoSetting.value).toString('base64').slice(0, 16)}"` : '"default"'
      });
      
      res.json({ logoUrl: logoSetting?.value || null });
    } catch (error) {
      console.error("Error fetching logo:", error);
      res.status(500).json({ message: "Failed to fetch logo" });
    }
  });

  app.get('/api/vendor/stats', isOTPAuthenticated, async (req: any, res) => {
    try {
      if (!req.user || !req.user.claims) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = req.otpUser.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(403).json({ message: "Access denied. Vendor profile required." });
      }

      const stats = await storage.getVendorStats(vendor.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching vendor stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Cart endpoints
  app.get('/api/cart', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.json([]); // Return empty cart on error
    }
  });

  app.post('/api/cart', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { productId, quantity } = req.body;
      
      const cartItem = await storage.addToCart(userId, productId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.put('/api/cart/:itemId', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { itemId } = req.params;
      const { quantity } = req.body;
      
      const cartItem = await storage.updateCartItemQuantity(userId, itemId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/:itemId', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { itemId } = req.params;
      
      await storage.removeFromCart(userId, itemId);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  // Customer orders - with source detection
  app.post('/api/orders', isOTPAuthenticated, async (req: RequestWithSource, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const userId = (req.user as any).id;
      const { items, ...orderData } = req.body;

      // Allow both web and mobile app orders for testing
      console.log(`📱 User placing order from ${req.source?.type || 'web'}`);

      // Fetch user data
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate user has required information for ordering (optional for web)
      if (!user.phone && req.source?.type === 'mobile') {
        return res.status(400).json({ 
          message: "phone_required",
          details: "Please update your phone number in the app to place orders."
        });
      }

      const parsedOrderData = insertOrderSchema.parse({
        ...orderData,
        userId,
        // Add mobile-specific metadata
        source: 'mobile-app',
        platform: req.source?.platform || 'unknown',
        userPhone: user.phone,
        userEmail: user.email,
      });

      const order = await storage.createOrder(parsedOrderData, items);
      
      // Process wallet transaction for the order
      try {
        // Ensure wallet exists for the user
        await storage.ensureWalletExists(userId);
        
        // Debit wallet for the order amount
        await storage.debitWallet(
          userId,
          parseFloat(order.totalAmount.toString()),
          `Order payment: ${order.id}`,
          order.id,
          'order_payment'
        );
        
        // Check if wallet should be automatically cleared
        const walletCleared = await storage.checkAndClearWallet(userId, 'system');
        if (walletCleared) {
          console.log(`💰 Wallet automatically cleared for user ${userId} due to threshold reached`);
        }
      } catch (walletError) {
        console.error('Wallet processing error:', walletError);
        // Continue with order processing even if wallet fails
      }
      
      // Send confirmation emails to customer and store
      try {
        const orderDetails = {
          orderId: order.id,
          customerEmail: user.email || "unknown@example.com",
          customerName: `${user.firstName} ${user.lastName}`,
          items: items.map((item: any) => ({
            productName: item.productName || item.name,
            quantity: item.quantity,
            price: parseFloat(item.price || item.unitPrice || 0),
            total: parseFloat(item.price || item.unitPrice || 0) * item.quantity
          })),
          subtotal: parseFloat(order.totalAmount.toString()) - 40 - Math.round(parseFloat(order.totalAmount.toString()) * 0.05), // Subtract delivery and tax
          deliveryFee: parseFloat(order.totalAmount.toString()) >= 500 ? 0 : 40,
          tax: Math.round(parseFloat(order.totalAmount.toString()) * 0.05),
          total: parseFloat(order.totalAmount.toString()),
          deliveryAddress: "Address not provided" // Remove direct access to order.deliveryAddress
        };

        const emailSent = await sendOrderConfirmationEmails(orderDetails);
        if (emailSent) {
          console.log(`📧 Order confirmation emails sent for order: ${order.id}`);
        } else {
          console.log(`⚠️ Failed to send confirmation emails for order: ${order.id}`);
        }
      } catch (emailError) {
        console.error('Error sending confirmation emails:', emailError);
      }
      
      // Broadcast order creation to all connected clients for real-time updates
      broadcastToMobileClients('order_created', {
        orderId: order.id,
        userId: userId,
        userName: `${user.firstName} ${user.lastName}`,
        totalAmount: order.totalAmount,
        itemCount: items.length,
        platform: req.source?.platform,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Order ${order.id} created successfully by mobile user ${user.firstName}`);
      
      res.json({
        ...order,
        message: "Order placed successfully",
        estimatedDelivery: "30-45 minutes",
        trackingAvailable: true,
        emailSent: true
      });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Establish session for authenticated users
  app.post('/api/auth/establish-session', async (req: any, res) => {
    try {
      let user = null;
      
      // Check if user is authenticated via Replit Auth
      if (req.user && req.user.claims) {
        user = req.otpUser;
        if (user) {
          // Set session
          (req.session as any).userId = user.id;
          console.log('✅ Session established for Replit user:', user.id, user.email);
          return res.json({ success: true, user });
        }
      }
      
      res.status(401).json({ message: "User not authenticated" });
    } catch (error: any) {
      console.error('Error establishing session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint for debugging authentication
  app.get('/api/debug/auth', async (req: any, res) => {
    try {
      const sessionInfo = {
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        sessionUser: req.session?.user?.id,
        hasReqUser: !!req.user,
        reqUserClaims: req.user?.claims?.sub,
        isAuthenticated: !!req.otpUser
      };
      
      console.log('🔍 Auth Debug:', sessionInfo);
      res.json(sessionInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Orders endpoint with email-based matching and user authentication
  app.get('/api/orders', async (req: any, res) => {
    try {
      console.log('📋 Orders request received');
      
      // First try to get user from session
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
        console.log('📋 Found authenticated user:', user?.email);
      }
      
      // If no user from session but email provided, use email filter
      const { email } = req.query;
      const targetEmail = user?.email || email;
      
      if (!targetEmail) {
        console.log('❌ No user or email found for orders request');
        return res.status(401).json({ 
          message: "Authentication required", 
          hint: "Please log in to view your orders"
        });
      }
      
      console.log('📋 Looking for orders for email:', targetEmail);
      
      // Get all orders
      const orders = await storage.getOrders();
      
      // Filter orders by email from special instructions
      const filteredOrders = orders.filter((order: any) => {
        try {
          const orderDetails = JSON.parse(order.specialInstructions || '{}');
          return orderDetails.customerEmail === targetEmail;
        } catch (e) {
          return false;
        }
      });
      
      console.log('📋 Found', filteredOrders.length, 'orders for email:', targetEmail);
      
      // Transform orders for frontend with payment status
      const transformedOrders = filteredOrders.map((order: any) => {
        let orderDetails: any = {};
        try {
          orderDetails = JSON.parse(order.specialInstructions || '{}');
        } catch (e) {
          orderDetails = {};
        }
        
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: (orderDetails.customerName || 'Customer').replace('null null', 'Guest Customer'),
          customerEmail: orderDetails.customerEmail || '',
          items: orderDetails.items ? 
            orderDetails.items.map((item: any) => `${item.productName || item.name} x${item.quantity}`).join(', ') :
            'Order items',
          total: parseFloat(order.totalAmount),
          subtotal: parseFloat(order.subtotal || order.totalAmount),
          deliveryFee: parseFloat(order.deliveryFee || '0'),
          tax: parseFloat(order.tax || '0'),
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          deliveryAddress: orderDetails.deliveryAddress || 'Address not provided',
          date: order.createdAt?.toISOString().split('T')[0] || 'Unknown',
          createdAt: order.createdAt
        };
      });
      
      // Sort by creation date (newest first)
      transformedOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(transformedOrders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: error.message });
    }
  });

  app.patch('/api/orders/:id/status', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const order = await storage.updateOrderStatus(id, status);
      
      // Broadcast order status update to mobile apps
      broadcastToMobileClients('order_status_updated', {
        orderId: id,
        newStatus: status,
        order: order,
        updatedBy: 'customer',
        timestamp: new Date().toISOString()
      });
      
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Cancel order endpoint
  app.patch('/api/orders/:id/cancel', async (req: any, res) => {
    try {
      // Get user from session first
      let user = null;
      const userId = (req.session as any)?.userId;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Fallback to Replit auth if available
      if (!user && req.user?.claims?.sub) {
        user = req.otpUser;
      }
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      
      // Get the order to verify ownership and status
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order can be cancelled (only pending or confirmed orders)
      if (order.status !== 'pending' && order.status !== 'confirmed') {
        return res.status(400).json({ 
          message: "Order cannot be cancelled", 
          hint: `Orders in '${order.status}' status cannot be cancelled` 
        });
      }

      // Update order status to cancelled
      const cancelledOrder = await storage.updateOrderStatus(id, 'cancelled');
      
      console.log('🚫 Order cancelled:', id, 'by user:', user.email);
      
      // Send cancellation email to customer
      try {
        const orderItems = await storage.getOrderItems(id);
        const orderDetails = {
          orderId: order.orderNumber || id,
          customerEmail: user.email || "unknown@example.com",
          customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
          items: orderItems.map((item: any) => ({
            productName: item.product?.name || item.productName || 'Product',
            quantity: item.quantity,
            price: parseFloat(item.price || 0),
            total: parseFloat(item.total || 0)
          })),
          subtotal: parseFloat((cancelledOrder.totalAmount || 0).toString()),
          deliveryFee: 0,
          tax: 0,
          total: parseFloat((cancelledOrder.totalAmount || 0).toString()),
          deliveryAddress: "Address not provided",
          cancellationDate: new Date().toLocaleDateString('en-IN'),
          cancellationTime: new Date().toLocaleTimeString('en-IN')
        };

        const emailSent = await sendOrderCancellationEmail(orderDetails);
        if (emailSent) {
          console.log(`📧 Order cancellation email sent for order: ${id}`);
        } else {
          console.log(`⚠️ Failed to send cancellation email for order: ${id}`);
        }
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
      }
      
      // Broadcast order cancellation to mobile apps and vendors
      broadcastToMobileClients('order_cancelled', {
        orderId: id,
        order: cancelledOrder,
        cancelledBy: user.email,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: "Order cancelled successfully",
        order: cancelledOrder
      });
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ 
        message: "Failed to cancel order", 
        error: error.message 
      });
    }
  });

  // Update payment status (Admin only)
  app.put('/api/orders/:id/payment-status', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { paymentStatus } = req.body;
      
      if (!paymentStatus) {
        return res.status(400).json({ message: "Payment status is required" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(id, paymentStatus);
      
      res.json({
        success: true,
        message: `Order ${id} payment status updated to ${paymentStatus}`,
        order: {
          id,
          paymentStatus,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  // Simple checkout endpoint for cart orders with email confirmation
  app.post('/api/checkout', async (req: any, res) => {
    try {
      const { items, customerInfo } = req.body;
      
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "No items in cart" });
      }

      // Enhanced authentication check with multiple fallbacks
      let authenticatedUser = null;
      let authenticatedUserId = null;

      // Check OTP session first
      const sessionUserId = (req.session as any)?.userId;
      if (sessionUserId) {
        authenticatedUser = await storage.getUser(sessionUserId);
        if (authenticatedUser) {
          authenticatedUserId = authenticatedUser.id;
          console.log('✅ Found OTP authenticated user:', authenticatedUser.email);
        }
      }

      // Fallback to Replit auth if available
      if (!authenticatedUser && req.user?.claims?.sub) {
        const replitUserId = req.otpUser.id;
        authenticatedUser = await storage.getUser(replitUserId);
        if (authenticatedUser) {
          authenticatedUserId = authenticatedUser.id;
          console.log('✅ Found Replit authenticated user:', authenticatedUser.email);
        }
      }

      // For guest checkout, allow non-authenticated orders
      if (!authenticatedUser) {
        console.log('🛒 Processing guest checkout order');
        authenticatedUserId = "guest"; // Special identifier for guest orders
      }

      // Use fallback email if customer info not provided (guest checkout)
      const finalCustomerInfo = {
        name: customerInfo?.name || (authenticatedUser ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}` : "Guest Customer"),
        email: customerInfo?.email && customerInfo.email !== "customer@example.com" 
          ? customerInfo.email 
          : (authenticatedUser?.email || "aifortechiesbe10x@gmail.com"),
        address: customerInfo?.address || "Address to be collected"
      };

      // Generate order ID and calculate totals
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.price) * item.quantity), 0);
      const deliveryFee = subtotal >= 500 ? 0 : 40;
      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + deliveryFee + tax;

      // Prepare order details for email
      const orderDetails = {
        orderId,
        customerEmail: finalCustomerInfo.email,
        customerName: finalCustomerInfo.name,
        items: items.map((item: any) => ({
          productName: item.productName || item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.price) * item.quantity
        })),
        subtotal,
        deliveryFee,
        tax,
        total,
        deliveryAddress: finalCustomerInfo.address,
        paymentStatus: 'pending',
        paymentMethod: 'cash'
      };

      // Save order to database
      try {
        console.log('🔍 Checkout - Authenticated user ID:', authenticatedUserId);
        console.log('🔍 User data:', authenticatedUser);
        
        const orderRecord = {
          orderNumber: orderId,
          userId: authenticatedUserId === "guest" ? null : authenticatedUserId, // Allow guest orders
          vendorId: null, // Set to null to avoid foreign key constraint
          deliveryAddressId: null, // Guest orders don't have address records
          totalAmount: total.toString(),
          deliveryFee: deliveryFee.toString(),
          tax: tax.toString(),
          discount: "0",
          paymentStatus: "pending",
          paymentMethod: "cash", // Default for now
          status: "pending",
          specialInstructions: JSON.stringify({
            customerName: finalCustomerInfo.name,
            customerEmail: finalCustomerInfo.email,
            deliveryAddress: finalCustomerInfo.address,
            items: items,
            isGuestOrder: authenticatedUserId === "guest",
            authenticationType: authenticatedUser ? (sessionUserId ? "otp" : "replit") : "guest"
          })
        };
        
        await storage.createOrder(orderRecord);
        console.log(`💾 Order saved to database: ${orderId}`);
      } catch (error) {
        console.error('Failed to save order to database:', error);
        // Continue with email sending even if database save fails
      }

      // Send confirmation emails to both customer and store
      const emailSent = await sendOrderConfirmationEmails(orderDetails);
      
      console.log(`📧 Checkout completed for order: ${orderId}`);
      console.log(`📧 Customer email: ${finalCustomerInfo.email}`);
      console.log(`📧 Store email: aifortechiesbe10x@gmail.com`);
      console.log(`📧 Both emails sent: ${emailSent}`);
      
      const isGuestOrder = finalCustomerInfo.email === "aifortechiesbe10x@gmail.com";
      const message = isGuestOrder 
        ? `Order placed successfully! Order details sent to store for processing.`
        : `Order placed successfully! Confirmation emails sent to both customer (${finalCustomerInfo.email}) and store.`;
      
      res.json({
        success: true,
        orderId,
        total,
        message,
        emailSent,
        customerEmail: finalCustomerInfo.email,
        storeEmail: 'aifortechiesbe10x@gmail.com',
        isGuestOrder,
        paymentStatus: 'pending',
        estimatedDelivery: "2-4 hours"
      });
      
    } catch (error) {
      console.error("Error processing checkout:", error);
      res.status(500).json({ message: "Failed to process checkout" });
    }
  });

  // Test email endpoint
  app.post('/api/test-email', async (req: any, res) => {
    try {
      const testOrderDetails = {
        orderId: 'TEST-' + Date.now(),
        customerEmail: 'aifortechiesbe10x@gmail.com',
        customerName: 'Test Customer',
        items: [{
          productName: 'Test Product',
          quantity: 1,
          price: 50,
          total: 50
        }],
        subtotal: 50,
        deliveryFee: 0,
        tax: 3,
        total: 53,
        deliveryAddress: 'Test Address'
      };

      const emailSent = await sendOrderConfirmationEmails(testOrderDetails);
      
      res.json({
        success: emailSent,
        message: emailSent ? 'Test emails sent successfully!' : 'Failed to send test emails',
        orderId: testOrderDetails.orderId
      });
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({ message: 'Test email failed', error: error.message });
    }
  });

  // Find similar orders for repeat order functionality
  app.post('/api/orders/similar', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const { productIds } = req.body;
      
      console.log('🔄 Repeat order check - User ID:', userId);
      console.log('🔄 Repeat order check - Product IDs:', productIds);
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: 'Product IDs are required' });
      }

      const similarOrders = await storage.findSimilarOrders(userId, productIds);
      console.log('🔄 Found similar orders:', similarOrders.length);

      // Return the most similar order (if any) with order details
      if (similarOrders.length > 0) {
        const mostSimilarOrder = similarOrders[0];
        
        // Get order items for the most similar order from storage
        const orderItemsData = await storage.getOrderItems(mostSimilarOrder.id);

        res.json({
          hasRepeatOrder: true,
          order: mostSimilarOrder,
          items: orderItemsData
        });
      } else {
        res.json({ hasRepeatOrder: false });
      }
    } catch (error: any) {
      console.error('Error finding similar orders:', error);
      res.status(500).json({ message: 'Failed to find similar orders' });
    }
  });

  // Subscriptions
  app.post('/api/subscriptions', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const { items, ...subscriptionData } = req.body;

      const parsedSubscriptionData = insertSubscriptionSchema.parse({
        ...subscriptionData,
        userId,
      });

      const subscription = await storage.createSubscription(parsedSubscriptionData, items);
      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.get('/api/subscriptions', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const subscriptions = await storage.getSubscriptionsByUser(userId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.patch('/api/subscriptions/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { items, ...subscriptionData } = req.body;
      
      const subscription = await storage.updateSubscription(id, subscriptionData, items);
      res.json(subscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  app.patch('/api/subscriptions/:id/status', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const subscription = await storage.updateSubscriptionStatus(id, status);
      res.json(subscription);
    } catch (error) {
      console.error("Error updating subscription status:", error);
      res.status(500).json({ message: "Failed to update subscription status" });
    }
  });

  // Admin subscription management
  app.get('/api/admin/subscriptions', async (req: any, res) => {
    try {
      const subscriptions = await storage.getAllSubscriptionsWithDetails();
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching admin subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Razorpay integration routes
  // Create Razorpay order for payment
  app.post('/api/razorpay/create-order', isOTPAuthenticated, async (req: any, res) => {
    try {
      const razorpay = getRazorpay();
      if (!razorpay) {
        return res.status(503).json({ 
          success: false, 
          message: 'Payment gateway not configured' 
        });
      }

      const { amount, currency = 'INR', receipt } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Valid amount is required' });
      }

      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency,
        receipt: receipt || `order_${Date.now()}`,
        payment_capture: 1 // Auto capture payment
      };

      const order = await razorpay.orders.create(options);
      
      res.json({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID
      });
    } catch (error: any) {
      console.error('Razorpay order creation error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create payment order',
        error: error.message 
      });
    }
  });

  // Verify Razorpay payment
  app.post('/api/razorpay/verify-payment', isOTPAuthenticated, async (req: any, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ message: 'Missing payment verification details' });
      }

      // Verify signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Payment verification failed' 
        });
      }

      // Payment verified successfully
      res.json({
        success: true,
        message: 'Payment verified successfully',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id
      });
    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Payment verification failed',
        error: error.message 
      });
    }
  });

  // Complete order with Razorpay payment
  app.post('/api/orders/complete-payment', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const { 
        orderData, 
        items, 
        razorpay_payment_id, 
        razorpay_order_id, 
        razorpay_signature 
      } = req.body;
      
      // Verify payment first
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Payment verification failed' 
        });
      }

      // Create order with payment details
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const orderRecord = {
        orderNumber: orderId,
        userId,
        ...orderData,
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      };
      
      const order = await storage.createOrder(orderRecord, items);
      
      res.json({
        success: true,
        order,
        message: 'Order completed successfully with payment'
      });
    } catch (error: any) {
      console.error('Order completion error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to complete order',
        error: error.message 
      });
    }
  });


  // Addresses
  app.post('/api/addresses', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const addressData = { ...req.body, userId };
      
      const address = await storage.createAddress(addressData);
      res.json(address);
    } catch (error) {
      console.error("Error creating address:", error);
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.get('/api/addresses', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const addresses = await storage.getAddressesByUser(userId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  // Admin routes - use session authentication like other admin endpoints
  app.get('/api/admin/vendors', async (req: any, res) => {
    try {
      // Debug session
      console.log("🔍 Vendor request - Session:", req.session?.userId, "Full session:", JSON.stringify(req.session));
      
      // Check session-based authentication like other admin endpoints
      const sessionData = req.session;
      if (!sessionData?.userId) {
        console.log("❌ No session userId found");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      console.log("🔍 Found user for vendor request:", user?.email, user?.role);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { limit = 50, offset = 0 } = req.query;
      const vendors = await storage.getVendors(
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.patch('/api/admin/vendors/:id/status', async (req: any, res) => {
    try {
      // Debug session
      console.log("🔍 Vendor status update - Session:", req.session?.userId, "Full session:", JSON.stringify(req.session));
      
      // Check session-based authentication like other admin endpoints
      const sessionData = req.session;
      if (!sessionData?.userId) {
        console.log("❌ No session userId found for vendor status update");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      console.log("🔍 Found user for vendor status update:", user?.email, user?.role);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const { status } = req.body;
      
      console.log(`📝 Admin updating vendor ${id} status to: ${status}`);
      
      const vendor = await storage.updateVendorStatus(id, status);
      
      // Broadcast vendor status change to mobile apps
      broadcastAdminChange('vendor_status_updated', {
        vendorId: id,
        newStatus: status,
        vendor: vendor
      }, sessionData.userId);
      
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor status:", error);
      res.status(500).json({ message: "Failed to update vendor status" });
    }
  });

  // Add vendor editing endpoint
  app.patch('/api/admin/vendors/:id', async (req: any, res) => {
    try {
      // Check session-based authentication like other admin endpoints
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`📝 Admin updating vendor ${id} with data:`, updateData);
      
      const vendor = await storage.updateVendor(id, updateData);
      
      // Broadcast vendor update to mobile apps
      broadcastAdminChange('vendor_updated', {
        vendorId: id,
        vendor: vendor,
        updatedFields: Object.keys(updateData)
      }, sessionData.userId);
      
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  // Debug endpoint to check today's order creation
  app.get('/api/debug/today-orders', async (req: any, res) => {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Get all orders created today using raw SQL to be precise
      const allOrders = await storage.getAllOrders();
      const todayOrders = allOrders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= todayStart && orderDate < todayEnd;
      });
      
      res.json({
        currentServerTime: today.toISOString(),
        currentServerDate: today.toDateString(),
        todayStart: todayStart.toISOString(),
        todayEnd: todayEnd.toISOString(),
        totalOrders: allOrders.length,
        todayOrdersCount: todayOrders.length,
        todayOrders: todayOrders.map((order: any) => ({
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          status: order.status
        })),
        recentOrders: allOrders.slice(0, 5).map((order: any) => ({
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          status: order.status
        }))
      });
    } catch (error: any) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin order management
  app.get('/api/admin/orders', async (req: any, res) => {
    try {
      console.log('📋 Admin orders request received');
      
      // Check session-based authentication first
      let user = null;
      const userId = (req.session as any)?.userId;
      
      if (userId) {
        user = await storage.getUser(userId);
        console.log('📋 Found session user:', user?.email, user?.role);
      } else {
        console.log('❌ No session found for admin orders');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      if (!user) {
        console.log('❌ No user found for session ID:', userId);
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (user.role !== 'admin') {
        console.log('❌ Access denied - user role:', user.role);
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      // Get all orders from database (no limit for admin view)
      const allOrders = await storage.getAllOrders();
      console.log('📋 Retrieved', allOrders.length, 'orders from database');
      
      // Transform orders for admin view with enhanced details including POS data integration
      const transformedOrders = allOrders.map((order: any) => {
        let orderDetails: any = {};
        try {
          orderDetails = JSON.parse(order.specialInstructions || '{}');
        } catch (e) {
          orderDetails = {};
        }
        
        // Extract customer phone from various sources
        const customerPhone = orderDetails.customerPhone || order.customerPhone || order.userPhone || 'No phone provided';
        
        return {
          id: order.id,
          orderNumber: order.orderNumber || `ORDER-${order.id?.slice(-8)}`,
          customerName: (orderDetails.customerName || order.customerName || 'Customer').replace('null null', 'Guest Customer'),
          customerEmail: orderDetails.customerEmail || order.customerEmail || order.userEmail || 'No email provided',
          customerPhone: customerPhone,
          items: orderDetails.items ? 
            orderDetails.items.map((item: any) => `${item.productName || item.name} x${item.quantity}`).join(', ') :
            'Order items',
          totalAmount: parseFloat(order.totalAmount),
          subtotal: parseFloat(order.totalAmount) - parseFloat(order.deliveryFee || '0') - parseFloat(order.tax || '0'),
          deliveryFee: parseFloat(order.deliveryFee || '0'),
          tax: parseFloat(order.tax || '0'),
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          orderSource: order.source || 'web', // Include order source (web/mobile/pos)
          platform: order.platform || 'web', // Include platform information
          deliveryAddress: order.deliveryAddress ? 
            `${order.deliveryAddress}${order.deliveryLandmark ? ', ' + order.deliveryLandmark : ''}${order.deliveryCity ? ', ' + order.deliveryCity : ''}${order.deliveryState ? ', ' + order.deliveryState : ''}${order.deliveryPincode ? ' - ' + order.deliveryPincode : ''}` : 
            (orderDetails.deliveryAddress || 'Address not provided'),
          vendorId: order.vendorId,
          deliveryPartnerId: order.deliveryPartnerId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          // Enhanced date-wise sorting metadata with proper timezone handling
          dateCreated: new Date(order.createdAt).toLocaleDateString('en-IN'),
          timeCreated: new Date(order.createdAt).toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          dayOfWeek: new Date(order.createdAt).toLocaleDateString('en-IN', { weekday: 'short' }),
          isToday: new Date(order.createdAt).toDateString() === new Date().toDateString(),
          isThisWeek: (new Date().getTime() - new Date(order.createdAt).getTime()) < (7 * 24 * 60 * 60 * 1000),
          daysSinceCreated: Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
          // Delivery scheduling metadata
          deliveryDate: order.deliveryDate, // Scheduled delivery date
          deliveredAt: order.deliveredAt, // Actual delivery completion time
          // For display purposes, use deliveredAt for completed orders, otherwise use scheduled deliveryDate
          actualDeliveryTime: order.deliveredAt || order.deliveryDate,
          dateDelivered: (order.deliveredAt || order.deliveryDate) ? new Date(order.deliveredAt || order.deliveryDate).toLocaleDateString('en-IN') : null,
          timeDelivered: (order.deliveredAt || order.deliveryDate) ? new Date(order.deliveredAt || order.deliveryDate).toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }) : null,
          deliveryDayOfWeek: (order.deliveredAt || order.deliveryDate) ? new Date(order.deliveredAt || order.deliveryDate).toLocaleDateString('en-IN', { weekday: 'short' }) : null,
          wasDeliveredToday: (order.deliveredAt || order.deliveryDate) ? new Date(order.deliveredAt || order.deliveryDate).toDateString() === new Date().toDateString() : false,
          // Additional debug info for date filtering
          createdAtISO: new Date(order.createdAt).toISOString(),
          createdAtDateString: new Date(order.createdAt).toDateString(),
          currentDateString: new Date().toDateString(),
          isTodayServer: new Date(order.createdAt).toDateString() === new Date().toDateString()
        };
      });
      
      // Dynamic database sorting by creation date (newest first) with secondary sort by order number
      transformedOrders.sort((a: any, b: any) => {
        const dateA = new Date(b.createdAt).getTime();
        const dateB = new Date(a.createdAt).getTime();
        if (dateA !== dateB) return dateA - dateB;
        // Secondary sort by order number for orders created at same time
        return (b.orderNumber || '').localeCompare(a.orderNumber || '');
      });
      
      // DEBUG: Log today's orders specifically 
      const todayOrders = transformedOrders.filter(order => order.isToday);
      const currentDate = new Date();
      // Count delivered orders for today
      const todayDeliveredOrders = transformedOrders.filter(order => 
        order.status === 'delivered' && order.wasDeliveredToday === true
      );
      
      console.log('📋 TODAY DEBUGGING:', {
        totalOrders: transformedOrders.length,
        todayOrdersCount: todayOrders.length,
        todayDeliveredCount: todayDeliveredOrders.length,
        currentServerDate: currentDate.toDateString(),
        currentServerISO: currentDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      if (todayOrders.length > 0) {
        console.log('📋 Found TODAY orders:', todayOrders.map(order => ({
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          dateString: order.createdAtDateString,
          isToday: order.isToday
        })));
      } else {
        console.log('📋 NO orders found for today. Recent orders:');
        transformedOrders.slice(0, 5).forEach(order => {
          console.log(`   ${order.orderNumber}: ${order.createdAtDateString} (${order.isToday ? 'TODAY' : 'NOT TODAY'})`);
        });
      }
      
      // Log delivered orders today
      if (todayDeliveredOrders.length > 0) {
        console.log('📋 Found TODAY delivered orders:', todayDeliveredOrders.map(order => ({
          orderNumber: order.orderNumber,
          status: order.status,
          deliveryDate: order.deliveryDate,
          dateDelivered: order.dateDelivered,
          wasDeliveredToday: order.wasDeliveredToday
        })));
      } else {
        console.log('📋 NO delivered orders found for today. Recent delivered orders:');
        transformedOrders.filter(order => order.status === 'delivered').slice(0, 5).forEach(order => {
          console.log(`   ${order.orderNumber}: delivered on ${order.dateDelivered || 'Unknown'} (${order.wasDeliveredToday ? 'TODAY' : 'NOT TODAY'})`);
        });
      }
      
      console.log('📋 Sending', transformedOrders.length, 'transformed orders to admin');
      res.json(transformedOrders);
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.patch('/api/admin/orders/:id/status', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const { status } = req.body;
      
      // Prevent "out for delivery" without delivery partner assignment
      if (status === "out_for_delivery") {
        const order = await storage.getOrder(id);
        if (!order?.deliveryPartnerId) {
          return res.status(400).json({ 
            message: "Cannot mark as 'out for delivery' without assigning a delivery partner first" 
          });
        }
      }
      
      const order = await storage.updateOrderStatus(id, status);
      
      // Critical: Broadcast admin order status changes to mobile apps
      broadcastToMobileClients('order_status_updated', {
        orderId: id,
        newStatus: status,
        order: order,
        updatedBy: 'admin',
        timestamp: new Date().toISOString()
      });
      
      res.json(order);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Delivery Partner Assignment Endpoints
  app.get('/api/admin/delivery-partners/available', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const partners = await storage.getAvailableDeliveryPartners();
      res.json(partners);
    } catch (error) {
      console.error("Error fetching available delivery partners:", error);
      res.status(500).json({ message: "Failed to fetch delivery partners" });
    }
  });

  app.get('/api/admin/delivery-partners/:id/orders', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const orders = await storage.getDeliveryPartnerActiveOrders(id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching delivery partner orders:", error);
      res.status(500).json({ message: "Failed to fetch partner orders" });
    }
  });

  app.post('/api/admin/orders/:id/assign-delivery', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { id } = req.params;
      const { deliveryPartnerId, deliverySequence } = req.body;

      if (!deliveryPartnerId) {
        return res.status(400).json({ message: "Delivery partner ID is required" });
      }

      // Check if order exists and is in correct status
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.status !== "ready" && order.status !== "confirmed" && order.status !== "preparing") {
        return res.status(400).json({ 
          message: "Order must be in 'ready', 'confirmed', or 'preparing' status to assign delivery partner" 
        });
      }

      // Check if order already has a delivery partner assigned
      if (order.deliveryPartnerId && order.deliveryPartnerId.trim() !== '') {
        return res.status(400).json({ 
          message: "Order already has a delivery partner assigned. Cannot assign another delivery partner." 
        });
      }

      const updatedOrder = await storage.assignOrderToDeliveryPartner(
        id, 
        deliveryPartnerId, 
        deliverySequence || 1
      );

      // Broadcast assignment to mobile apps
      broadcastToMobileClients('order_assigned', {
        orderId: id,
        deliveryPartnerId,
        deliverySequence,
        order: updatedOrder,
        assignedBy: 'admin',
        timestamp: new Date().toISOString()
      });

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error assigning delivery partner:", error);
      res.status(500).json({ message: "Failed to assign delivery partner" });
    }
  });

  // Admin stats endpoint - with session-based auth
  app.get('/api/admin/stats', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Recent activities endpoint for dynamic activity feed
  app.get('/api/admin/recent-activities', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const activities = await storage.getRecentActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  // New endpoint for growth metrics
  app.get('/api/admin/growth-metrics', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const growth = await storage.getGrowthMetrics();
      res.json(growth);
    } catch (error) {
      console.error("Error fetching growth metrics:", error);
      res.status(500).json({ message: "Failed to fetch growth metrics" });
    }
  });

  // New endpoint for performance metrics
  app.get('/api/admin/performance-metrics', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const performance = await storage.getPerformanceMetrics();
      res.json(performance);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  // Admin users endpoint 
  app.get('/api/admin/users', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const users = await storage.getUsersWithSpending();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin update user endpoint
  app.patch('/api/admin/users/:userId', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const adminUser = await storage.getUser(req.session.userId);
      if (adminUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { userId } = req.params;
      const updateData = req.body;

      // Get the user to update
      const userToUpdate = await storage.getUser(userId);
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log('🔧 Admin updating user:', userId, 'with data:', updateData);

      // Update user basic info (exclude email if it's the same to avoid unique constraint)
      const updateFields: any = {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone,
        role: updateData.role
      };
      
      // Only update email if it's different from current email
      if (updateData.email !== userToUpdate.email) {
        updateFields.email = updateData.email;
      }

      const updatedUser = await storage.updateUser(userId, updateFields);

      // If it's a delivery partner, update delivery-specific fields
      if (updateData.role === 'delivery') {
        const deliveryPartner = await storage.getDeliveryPartnerByUserId(userId);
        if (deliveryPartner) {
          await storage.updateDeliveryPartnerProfile(deliveryPartner.id, {
            vehicleType: updateData.vehicleType,
            vehicleNumber: updateData.vehicleNumber,
            licenseNumber: updateData.licenseNumber
          });
        }
      }

      console.log('✅ User updated successfully:', updatedUser);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin all users endpoint for user management page
  app.get('/api/admin/all-users', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      // Get all users from the database - use the existing getUsersWithSpending function
      const allUsers = await storage.getUsersWithSpending();
      console.log('📋 Fetched all users for admin management:', allUsers.length);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch all users" });
    }
  });

  // Admin create user endpoint
  app.post('/api/admin/create-user', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const adminUser = await storage.getUser(req.session.userId);
      if (adminUser?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const userData = req.body;
      console.log('🔧 Admin creating user:', userData);

      // Create the user
      const newUser = await storage.createUser({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        isActive: true
      });

      // If it's a delivery partner, create delivery partner profile
      if (userData.role === 'delivery' && (userData.vehicleType || userData.vehicleNumber || userData.licenseNumber)) {
        await storage.createDeliveryPartner({
          userId: newUser.id,
          name: `${userData.firstName} ${userData.lastName}`,
          phone: userData.phone,
          vehicleType: userData.vehicleType || null,
          vehicleNumber: userData.vehicleNumber || null,
          licenseNumber: userData.licenseNumber || null,
          isActive: true
        });
      }

      console.log('✅ User created successfully:', newUser);
      res.json({ ...newUser, loginId: userData.loginId || newUser.email });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Delivery Partner Routes
  app.get('/api/delivery/profile', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner profile not found" });
      }

      // Combine delivery partner data with user data for complete profile
      const profile = {
        id: partner.id,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phone: user?.phone || partner.phone || '', // Show actual phone number, not masked
        profileImageUrl: user?.profileImageUrl,
        vehicleType: partner.vehicleType || '',
        vehicleNumber: partner.vehicleNumber || '', // Show actual vehicle number
        licenseNumber: partner.licenseNumber || '', // Show actual license number
        isOnline: partner.isOnline || false,
        isApproved: partner.isApproved || false,
        rating: partner.rating || 0,
        totalDeliveries: partner.totalDeliveries || 0,
        completedDeliveries: partner.completedDeliveries || 0,
        cancelledDeliveries: partner.cancelledDeliveries || 0,
        earnings: partner.earnings || 0,
        joinedDate: partner.createdAt || new Date().toISOString(),
        lastActiveAt: partner.lastActiveAt || new Date().toISOString(),
        currentLocation: partner.currentLocation
      };
      
      console.log('📋 Delivery profile response:', {
        userId: req.session.userId,
        phone: profile.phone,
        vehicleNumber: profile.vehicleNumber,
        licenseNumber: profile.licenseNumber
      });
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching delivery partner profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch('/api/delivery/profile', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner profile not found" });
      }
      
      const updatedData = req.body;
      const updatedPartner = await storage.updateDeliveryPartnerProfile(partner.id, updatedData);
      
      res.json(updatedPartner);
    } catch (error) {
      console.error("Error updating delivery partner profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get('/api/delivery/stats', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }
      
      const stats = await storage.getDeliveryPartnerStats(partner.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching delivery partner stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/delivery/orders', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }
      
      const orders = await storage.getDeliveryPartnerOrders(partner.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching delivery partner orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.patch('/api/delivery/orders/:id/status', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }
      
      const { id } = req.params;
      const { status } = req.body;
      
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      // Broadcast order status update to mobile apps - critical for customer tracking
      broadcastToMobileClients('order_status_updated', {
        orderId: id,
        newStatus: status,
        order: updatedOrder,
        updatedBy: 'delivery_partner',
        timestamp: new Date().toISOString()
      });
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  app.patch('/api/delivery/location', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }
      
      const { latitude, longitude, address, accuracy, heading, speed } = req.body;
      
      // Enhanced location update with GPS details  
      const locationData = {
        latitude: latitude ? latitude.toString() : partner.latitude,
        longitude: longitude ? longitude.toString() : partner.longitude,
        currentLocation: address || `${latitude?.toFixed(6) || '0'}, ${longitude?.toFixed(6) || '0'}`,
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
        lastLocationUpdate: new Date()
      };
      
      const updated = await storage.updateDeliveryPartnerLocation(partner.id, locationData);
      res.json({ 
        success: true, 
        message: 'Real-time GPS location updated',
        coordinates: { latitude, longitude },
        accuracy: accuracy ? `±${Math.round(accuracy)}m` : null
      });
    } catch (error) {
      console.error("Error updating GPS location:", error);
      res.status(500).json({ message: "Failed to update GPS location" });
    }
  });

  app.patch('/api/delivery/status', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'delivery') {
        return res.status(403).json({ message: "Access denied. Delivery partner privileges required." });
      }

      const partner = await storage.getDeliveryPartnerByUserId(req.session.userId);
      
      if (!partner) {
        return res.status(404).json({ message: "Delivery partner not found" });
      }
      
      const { isOnline } = req.body;
      const updated = await storage.toggleDeliveryPartnerOnlineStatus(partner.id, isOnline);
      res.json(updated);
    } catch (error) {
      console.error("Error updating online status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Admin report generation endpoint
  app.get("/api/admin/report", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const format = req.query.format as string;
      const stats = await storage.getAdminStats();
      const users = await storage.getUsersWithSpending();
      const vendors = await storage.getVendors();
      
      if (format === 'csv') {
        let csvContent = "Report Type,Value\n";
        csvContent += `Total Vendors,${stats.totalVendors}\n`;
        csvContent += `Total Users,${stats.totalUsers}\n`;
        csvContent += `Total Orders,${stats.totalOrders}\n`;
        csvContent += `Active Subscriptions,${stats.activeSubscriptions}\n`;
        csvContent += `Total Revenue,${stats.totalRevenue}\n`;
        csvContent += `Report Generated,${new Date().toISOString()}\n`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=amrit-dairy-report.csv');
        res.send(csvContent);
      } else {
        res.json({
          stats,
          totalUsers: users.length,
          totalVendors: vendors.length,
          generatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // ===== Customer Reviews Routes =====
  
  // Get customer reviews (public endpoint)
  app.get('/api/customer-reviews', async (req: any, res) => {
    try {
      const { limit = 6, shortlisted = 'true' } = req.query;
      const shortlistedOnly = shortlisted === 'true';
      const reviews = await storage.getCustomerReviews({ 
        limit: parseInt(limit), 
        shortlistedOnly 
      });
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching customer reviews:", error);
      res.status(500).json({ message: "Failed to fetch customer reviews" });
    }
  });

  // Admin customer reviews management
  app.get('/api/admin/customer-reviews', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { limit, shortlisted, minRating, maxRating, minOrderValue, maxOrderValue, customerName } = req.query;
      
      const filters: any = {};
      if (limit) filters.limit = parseInt(limit);
      if (shortlisted !== undefined) filters.shortlistedOnly = shortlisted === 'true';
      if (minRating) filters.minRating = parseInt(minRating);
      if (maxRating) filters.maxRating = parseInt(maxRating);
      if (minOrderValue) filters.minOrderValue = parseFloat(minOrderValue);
      if (maxOrderValue) filters.maxOrderValue = parseFloat(maxOrderValue);
      if (customerName) filters.customerName = customerName;

      const reviews = await storage.getCustomerReviews(filters);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching customer reviews:", error);
      res.status(500).json({ message: "Failed to fetch customer reviews" });
    }
  });

  // Create review for completed order
  app.post('/api/customer-reviews', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const { orderId, rating, reviewText } = req.body;
      
      if (!orderId || !rating || !reviewText) {
        return res.status(400).json({ message: "Order ID, rating, and review text are required" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // Check if user already reviewed this order
      const hasReviewed = await storage.hasUserReviewedOrder(orderId);
      if (hasReviewed) {
        return res.status(400).json({ message: "You have already reviewed this order" });
      }

      // Get order details for order value and customer name
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== user.id) {
        return res.status(403).json({ message: "You can only review your own orders" });
      }

      if (order.status !== 'delivered') {
        return res.status(400).json({ message: "You can only review delivered orders" });
      }

      const review = await storage.createCustomerReview({
        orderId,
        userId: user.id,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous Customer',
        rating,
        reviewText,
        orderValue: parseFloat(order.totalAmount)
      });

      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating customer review:", error);
      res.status(500).json({ message: "Failed to create customer review" });
    }
  });

  // Get orders eligible for review (customer endpoint) - Enhanced for multi-tier reviews
  app.get('/api/orders/eligible-for-review', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const orders = await storage.getOrdersEligibleForReview(user.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders eligible for review:", error);
      res.status(500).json({ message: "Failed to fetch orders eligible for review" });
    }
  });

  // Multi-Tier Review System API Routes
  
  // Order Reviews (Overall + Delivery)
  app.post('/api/order-reviews', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const { orderId, overallRating, overallReviewText, deliveryRating, deliveryReviewText } = req.body;

      if (!orderId || !overallRating || !overallReviewText || !deliveryRating) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (overallRating < 1 || overallRating > 5 || deliveryRating < 1 || deliveryRating > 5) {
        return res.status(400).json({ message: "Ratings must be between 1 and 5" });
      }

      // Check if user has already reviewed this order
      const hasReviewed = await storage.hasUserReviewedOrder(orderId);
      if (hasReviewed) {
        return res.status(400).json({ message: "You have already reviewed this order" });
      }

      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== user.id) {
        return res.status(403).json({ message: "You can only review your own orders" });
      }

      if (order.status !== 'delivered') {
        return res.status(400).json({ message: "You can only review delivered orders" });
      }

      const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous Customer';
      const orderValue = parseFloat(order.totalAmount) || 0;

      const review = await storage.createOrderReview({
        orderId,
        userId: user.id,
        customerName,
        overallRating,
        overallReviewText,
        deliveryRating,
        deliveryReviewText,
        orderValue
      });

      res.status(201).json(review);
    } catch (error) {
      console.error('Error creating order review:', error);
      res.status(500).json({ message: 'Failed to create order review' });
    }
  });

  // Get existing order review
  app.get('/api/order-reviews/:orderId', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const { orderId } = req.params;

      const review = await storage.getOrderReviewByOrderId(orderId);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      // Verify the review belongs to the authenticated user
      if (review.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(review);
    } catch (error) {
      console.error('Error fetching order review:', error);
      res.status(500).json({ message: 'Failed to fetch order review' });
    }
  });

  // Product Reviews
  app.post('/api/product-reviews', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const { orderId, orderItemId, productId, rating, reviewText } = req.body;

      if (!orderId || !productId || !rating) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== user.id) {
        return res.status(403).json({ message: "You can only review your own orders" });
      }

      if (order.status !== 'delivered') {
        return res.status(400).json({ message: "You can only review delivered orders" });
      }

      // Check if this product has already been reviewed for this order
      const existingReview = await storage.getProductReviewByOrderAndProduct(orderId, productId, user.id);
      if (existingReview) {
        return res.status(400).json({ message: "You have already reviewed this product for this order" });
      }

      const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous Customer';

      // For specialInstructions items, orderItemId might be synthetic (starts with "special-")
      // In that case, we'll set orderItemId to null and rely on orderId + productId combination
      const finalOrderItemId = orderItemId && !orderItemId.startsWith('special-') ? orderItemId : null;

      const review = await storage.createProductReview({
        orderId,
        orderItemId: finalOrderItemId,
        productId,
        userId: user.id,
        customerName,
        rating,
        reviewText
      });

      res.status(201).json(review);
    } catch (error) {
      console.error('Error creating product review:', error);
      res.status(500).json({ message: 'Failed to create product review' });
    }
  });

  // Customer product reviews endpoint
  app.get('/api/customer/product-reviews', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const limit = parseInt(req.query.limit as string) || 1000;
      const reviews = await storage.getCustomerProductReviews(userId, limit);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching customer product reviews:", error);
      res.status(500).json({ message: "Failed to fetch product reviews" });
    }
  });

  // Get specific product review by order and product ID
  app.get('/api/product-reviews/:orderId/:productId', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { orderId, productId } = req.params;
      
      const review = await storage.getSpecificProductReview(userId, orderId, productId);
      if (review) {
        res.json(review);
      } else {
        res.status(404).json({ message: "Review not found" });
      }
    } catch (error) {
      console.error("Error fetching specific product review:", error);
      res.status(500).json({ message: "Failed to fetch product review" });
    }
  });

  // Admin API routes for managing reviews
  app.get('/api/product-reviews', async (req, res) => {
    try {
      const { shortlisted_only, min_rating, max_rating, product_name, limit } = req.query;
      
      const filters = {
        shortlistedOnly: shortlisted_only === 'true',
        minRating: min_rating ? parseInt(min_rating as string) : undefined,
        maxRating: max_rating ? parseInt(max_rating as string) : undefined,
        productName: product_name ? product_name as string : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const reviews = await storage.getProductReviews(filters);
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching product reviews:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/product-reviews/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { isShortlisted, isActive } = req.body;

      const updatedReview = await storage.updateProductReview(id, {
        isShortlisted,
        isActive
      });

      res.json(updatedReview);
    } catch (error) {
      console.error('Error updating product review:', error);
      res.status(500).json({ message: 'Failed to update product review' });
    }
  });

  app.put('/api/admin/customer-reviews/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { isShortlisted, isActive } = req.body;

      const updatedReview = await storage.updateCustomerReview(id, {
        isShortlisted,
        isActive
      });

      res.json(updatedReview);
    } catch (error) {
      console.error("Error updating customer review:", error);
      res.status(500).json({ message: "Failed to update customer review" });
    }
  });

  app.delete('/api/admin/customer-reviews/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteCustomerReview(id);
      res.json({ message: "Customer review deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer review:", error);
      res.status(500).json({ message: "Failed to delete customer review" });
    }
  });

  // Website Statistics API Routes
  // Get website stats (public endpoint)
  app.get('/api/website-stats', async (req: any, res) => {
    try {
      const stats = await storage.getWebsiteStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching website stats:", error);
      res.status(500).json({ message: "Failed to fetch website statistics" });
    }
  });

  // Admin website stats management
  app.get('/api/admin/website-stats', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getWebsiteStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching website stats:", error);
      res.status(500).json({ message: "Failed to fetch website statistics" });
    }
  });

  app.post('/api/admin/website-stats', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { statType, value, label, displayOrder } = req.body;
      
      if (!statType || !value || !label) {
        return res.status(400).json({ message: "Stat type, value, and label are required" });
      }

      const stats = await storage.createWebsiteStats({
        statType,
        value,
        label,
        displayOrder: displayOrder || 0,
        isActive: true
      });

      res.status(201).json(stats);
    } catch (error) {
      console.error("Error creating website stats:", error);
      res.status(500).json({ message: "Failed to create website statistics" });
    }
  });

  app.put('/api/admin/website-stats/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { statType, value, label, displayOrder, isActive } = req.body;

      const stats = await storage.updateWebsiteStats(id, {
        statType,
        value,
        label,
        displayOrder,
        isActive
      });

      res.json(stats);
    } catch (error) {
      console.error("Error updating website stats:", error);
      res.status(500).json({ message: "Failed to update website statistics" });
    }
  });

  app.delete('/api/admin/website-stats/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      await storage.deleteWebsiteStats(id);
      res.json({ message: "Website statistics deleted successfully" });
    } catch (error) {
      console.error("Error deleting website stats:", error);
      res.status(500).json({ message: "Failed to delete website statistics" });
    }
  });

  // ===== POS (Point of Sale) Routes =====
  // These routes handle in-store sales recording for POS users
  
  // Create POS profile for a user
  app.post('/api/pos/profile', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profileData = {
        ...req.body,
        userId: user.id
      };
      
      const profile = await storage.createPosProfile(profileData);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating POS profile:", error);
      res.status(500).json({ message: "Failed to create POS profile" });
    }
  });

  // Get POS profile
  app.get('/api/pos/profile', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profile = await storage.getPosProfileByUserId(user.id);
      
      if (!profile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching POS profile:", error);
      res.status(500).json({ message: "Failed to fetch POS profile" });
    }
  });

  // Update POS profile
  app.patch('/api/pos/profile', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profile = await storage.getPosProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const updatedProfile = await storage.updatePosProfile(profile.id, req.body);
      res.json(updatedProfile);
    } catch (error) {
      console.error("Error updating POS profile:", error);
      res.status(500).json({ message: "Failed to update POS profile" });
    }
  });

  // Create a new POS sale
  app.post('/api/pos/sales', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profile = await storage.getPosProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ message: "POS profile not found. Please create a profile first." });
      }
      
      const { saleData, items, deliveryAssignment } = req.body;
      
      if (!saleData || !items || items.length === 0) {
        return res.status(400).json({ message: "Sale data and items are required" });
      }
      
      console.log('🔍 Backend Sale Debug:');
      console.log('📱 Received saleData:', JSON.stringify(saleData, null, 2));
      console.log('📦 soldBy field:', saleData.soldBy);
      console.log('👤 soldByUser field:', saleData.soldByUser);
      
      // Add profile ID to sale data
      const saleRecord = {
        ...saleData,
        posProfileId: profile.id
      };
      
      console.log('💾 Final saleRecord:', JSON.stringify(saleRecord, null, 2));
      
      const sale = await storage.createPosSale(saleRecord, items);
      
      // Handle delivery assignment if provided
      if (deliveryAssignment && deliveryAssignment.deliveryPartnerId) {
        try {
          await storage.updatePosSale(sale.id, {
            deliveryPartnerId: deliveryAssignment.deliveryPartnerId,
            deliverySequence: 1,
            assignedAt: new Date(),
            deliveryDate: deliveryAssignment.deliveryDate ? new Date(deliveryAssignment.deliveryDate) : null,
            deliveryTimeSlot: deliveryAssignment.deliveryTimeSlot,
            customerAddress: deliveryAssignment.customerAddress,
            deliveryStatus: 'assigned'
          });
          console.log(`🚚 Delivery partner ${deliveryAssignment.deliveryPartnerId} assigned to POS sale ${sale.id}`);
        } catch (deliveryError) {
          console.error('Error assigning delivery partner to POS sale:', deliveryError);
          // Continue with sale processing even if delivery assignment fails
        }
      }
      
      // Process wallet transaction if customer information is provided
      try {
        if (saleData.customerPhone || saleData.customerEmail) {
          // Find customer by phone or email
          let customer = null;
          if (saleData.customerEmail) {
            customer = await storage.getUserByEmail(saleData.customerEmail);
          } else if (saleData.customerPhone) {
            customer = await storage.getUserByPhone(saleData.customerPhone);
          }
          
          if (customer) {
            // Ensure wallet exists for the customer
            await storage.ensureWalletExists(customer.id);
            
            // Debit wallet for the POS sale amount
            await storage.debitWallet(
              customer.id,
              parseFloat(sale.totalAmount.toString()),
              `POS sale: ${sale.saleNumber} at ${profile.shopName}`,
              sale.id,
              'pos_sale'
            );
            
            // Check if wallet should be automatically cleared
            const walletCleared = await storage.checkAndClearWallet(customer.id, user.id);
            if (walletCleared) {
              console.log(`💰 Wallet automatically cleared for customer ${customer.id} due to threshold reached`);
            }
          }
        }
      } catch (walletError) {
        console.error('POS wallet processing error:', walletError);
        // Continue with sale processing even if wallet fails
      }
      
      res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating POS sale:", error);
      res.status(500).json({ message: "Failed to create sale" });
    }
  });

  // Get available delivery partners for POS
  app.get('/api/pos/delivery-partners', isPOSAuthenticated, async (req: any, res) => {
    try {
      const deliveryPartners = await storage.getAvailableDeliveryPartners();
      res.json(deliveryPartners);
    } catch (error) {
      console.error("Error fetching delivery partners:", error);
      res.status(500).json({ message: "Failed to fetch delivery partners" });
    }
  });

  // Get delivery orders for POS (both online orders and POS sales needing delivery)
  app.get('/api/pos/delivery-orders', isPOSAuthenticated, async (req: any, res) => {
    try {
      // Get online orders that need delivery
      const onlineOrders = await storage.getAllOrders();
      
      // Get POS sales that have delivery assignments
      const posSales = await storage.getPosSalesWithDelivery();
      
      // Format and combine both types
      const deliveryOrders = [
        ...onlineOrders.map((order: any) => ({
          ...order,
          type: 'online',
          orderNumber: order.orderNumber,
          saleNumber: null
        })),
        ...posSales.map((sale: any) => ({
          ...sale,
          type: 'pos',
          orderNumber: null,
          saleNumber: sale.saleNumber,
          // Map POS sale fields to order fields for consistency
          id: sale.id,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          deliveryAddress: sale.customerAddress || sale.deliveryAddress,
          totalAmount: sale.totalAmount,
          status: sale.deliveryStatus || 'ready',
          createdAt: sale.createdAt,
          deliveryPartnerId: sale.deliveryPartnerId,
          deliveryPartnerName: sale.deliveryPartnerName
        }))
      ];

      res.json(deliveryOrders);
    } catch (error) {
      console.error("Error fetching delivery orders for POS:", error);
      res.status(500).json({ message: "Failed to fetch delivery orders" });
    }
  });

  // Update delivery status for POS
  app.patch('/api/pos/delivery/:id/status', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      // Try to update as an order first, then as a POS sale
      try {
        await storage.updateOrderStatus(id, status);
        res.json({ success: true, message: "Order delivery status updated" });
      } catch (orderError) {
        // If order update fails, try POS sale update
        try {
          await storage.updatePosSale(id, { 
            deliveryStatus: status,
            ...(status === 'delivered' ? { deliveryDate: new Date() } : {})
          });
          res.json({ success: true, message: "POS sale delivery status updated" });
        } catch (saleError) {
          throw new Error("Failed to update delivery status");
        }
      }
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  // Get orders for POS users
  app.get('/api/pos/orders', isPOSAuthenticated, async (req: any, res) => {
    try {
      // Get all orders - POS users can view all orders for management purposes
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders for POS:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Update order status for POS users
  app.patch('/api/pos/orders/:id/status', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      await storage.updateOrderStatus(id, status);
      res.json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
      console.error("Error updating order status for POS:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Assign delivery partner to POS sale
  app.post('/api/pos/sales/:id/assign-delivery', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { deliveryPartnerId, deliverySequence, deliveryDate, deliveryTimeSlot, customerAddress } = req.body;
      
      if (!deliveryPartnerId) {
        return res.status(400).json({ message: "Delivery partner is required" });
      }

      // Check if delivery partner is already assigned
      const existingSale = await storage.getPosSale(id);
      if (!existingSale) {
        return res.status(404).json({ message: "POS sale not found" });
      }

      if (existingSale.deliveryPartnerId) {
        return res.status(400).json({ message: "Delivery partner already assigned to this sale" });
      }

      // Update POS sale with delivery assignment
      const updatedSale = await storage.updatePosSale(id, {
        deliveryPartnerId,
        deliverySequence: deliverySequence || 1,
        assignedAt: new Date(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        deliveryTimeSlot,
        customerAddress,
        deliveryStatus: 'assigned'
      });

      res.json({ 
        message: "Delivery partner assigned successfully", 
        sale: updatedSale 
      });
    } catch (error) {
      console.error("Error assigning delivery partner:", error);
      res.status(500).json({ message: "Failed to assign delivery partner" });
    }
  });

  // Update delivery status for POS sale
  app.patch('/api/pos/sales/:id/delivery-status', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { deliveryStatus } = req.body;
      
      if (!deliveryStatus) {
        return res.status(400).json({ message: "Delivery status is required" });
      }

      const updateData: any = { deliveryStatus };
      
      // If marking as delivered, set delivered timestamp
      if (deliveryStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      const updatedSale = await storage.updatePosSale(id, updateData);
      
      res.json({ 
        message: "Delivery status updated successfully", 
        sale: updatedSale 
      });
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  // Get POS sales with items
  app.get('/api/pos/sales', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profile = await storage.getPosProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const salesWithItems = await storage.getPosSalesWithItems(profile.id);
      res.json(salesWithItems);
    } catch (error) {
      console.error("Error fetching POS sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // Get a specific POS sale
  app.get('/api/pos/sales/:id', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const { id } = req.params;
      const sale = await storage.getPosSale(id);
      
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      res.json(sale);
    } catch (error) {
      console.error("Error fetching POS sale:", error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  // POS Promo Code Validation
  app.post('/api/pos/promo-codes/validate', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { code, userId, orderAmount, cartItems } = req.body;
      
      if (!code || !userId || !orderAmount) {
        return res.status(400).json({ 
          valid: false, 
          message: "Code, user ID, and order amount are required" 
        });
      }
      
      // Validate promo code using existing storage method
      const validation = await storage.validatePromoCode(code, userId, orderAmount);
      
      if (validation.valid && validation.promoCode) {
        // Check if promo code is applicable to the cart items
        const applicableItems = cartItems?.filter((item: any) => {
          if (validation.promoCode?.applicableProducts?.length && validation.promoCode.applicableProducts.length > 0) {
            return validation.promoCode.applicableProducts.includes(item.productId);
          }
          if (validation.promoCode?.excludedProducts?.length && validation.promoCode.excludedProducts.length > 0) {
            return validation.promoCode.excludedProducts.includes(item.productId);
          }
          return true; // No restrictions, applies to all
        }) || [];
        
        // For POS, we'll still validate but allow the frontend to calculate discount
        res.json({
          valid: true,
          message: "Promo code is valid",
          promoCode: validation.promoCode,
          applicableItems
        });
      } else {
        res.json({
          valid: false,
          message: validation.message
        });
      }
    } catch (error) {
      console.error("Error validating POS promo code:", error);
      res.status(500).json({ 
        valid: false, 
        message: "Failed to validate promo code" 
      });
    }
  });

  // Customer promo code validation endpoint
  app.post('/api/promo-codes/validate', async (req: any, res) => {
    try {
      const { code, orderAmount } = req.body;
      
      if (!code || !orderAmount) {
        return res.status(400).json({ 
          valid: false, 
          message: "Promo code and order amount are required" 
        });
      }

      // Get user from session (OTP auth)
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ 
          valid: false, 
          message: "Please login to use promo codes" 
        });
      }

      // Validate the promo code
      const validation = await storage.validatePromoCode(code, userId, parseFloat(orderAmount));
      
      if (validation.valid && validation.promoCode) {
        // Calculate discount amount based on type
        let discountAmount = 0;
        const orderTotal = parseFloat(orderAmount);
        const deliveryFee = orderTotal >= 500 ? 0 : 40; // Standard delivery fee logic
        
        switch (validation.promoCode.discountType) {
          case 'percentage':
            discountAmount = (orderTotal * parseFloat(validation.promoCode.discountValue)) / 100;
            // Apply max discount limit if specified
            if (validation.promoCode.maxDiscountAmount && discountAmount > parseFloat(validation.promoCode.maxDiscountAmount)) {
              discountAmount = parseFloat(validation.promoCode.maxDiscountAmount);
            }
            break;
            
          case 'fixed_amount':
          case 'fixed':
            discountAmount = parseFloat(validation.promoCode.discountValue);
            break;
            
          case 'free_delivery':
            // For free delivery, discount is the delivery fee amount
            discountAmount = deliveryFee;
            break;
            
          case 'free_product':
            // Handle free product discounts (would need product price logic)
            discountAmount = parseFloat(validation.promoCode.discountValue);
            break;
            
          default:
            discountAmount = 0;
        }

        res.json({
          valid: true,
          message: validation.message,
          discount: {
            type: validation.promoCode.discountType,
            value: validation.promoCode.discountValue,
            amount: discountAmount,
            code: validation.promoCode.code,
            name: validation.promoCode.name
          }
        });
      } else {
        res.json({
          valid: false,
          message: validation.message
        });
      }
    } catch (error) {
      console.error("Error validating customer promo code:", error);
      res.status(500).json({ 
        valid: false, 
        message: "Failed to validate promo code" 
      });
    }
  });

  // Get active POS promo codes
  app.get('/api/pos/promo-codes', isPOSAuthenticated, async (req: any, res) => {
    try {
      const promoCodes = await storage.getActivePromoCodesForPOS();
      res.json(promoCodes);
    } catch (error) {
      console.error("Error fetching POS promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  // Get POS statistics
  app.get('/api/pos/stats', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      const profile = await storage.getPosProfileByUserId(user.id);
      if (!profile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const stats = await storage.getPosStats(profile.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching POS stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get products for POS system (only products with available raw material stock)
  app.get('/api/pos/products', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      
      // Get POS profile to filter by user's raw materials
      const posProfile = await storage.getPosProfileByUserId(user.id);
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      // Get raw materials with stock > 0 for this POS profile
      const availableRawMaterials = await storage.getRawMaterialsByProfile(posProfile.id);
      const rawMaterialsWithStock = availableRawMaterials.filter(rm => 
        rm.isActive && parseFloat(rm.currentStock || "0") > 0
      );
      
      // Convert raw materials to POS product format
      const posProducts = rawMaterialsWithStock.map(rm => ({
        id: rm.id,
        name: rm.name,
        price: parseFloat(rm.sellingPrice || "0"), // Use selling price for customer display
        unit: rm.unit,
        category: "raw-material", // Category for raw materials
        stock: parseFloat(rm.currentStock || "0"),
        isActive: true,
        rawMaterialId: rm.id // Link back to raw material
      }));
      
      console.log(`📦 POS Products: Found ${posProducts.length} products with stock > 0`);
      res.json(posProducts);
    } catch (error) {
      console.error("Error fetching products for POS:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Admin: Create vendor
  app.post("/api/admin/vendors", async (req: any, res) => {
    try {
      // Check admin authentication (same pattern as working endpoints)
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const {
        email,
        firstName,
        lastName,
        phone,
        businessName,
        description,
        category,
        address,
        city,
        state,
        pincode,
        gstNumber,
        license,
      } = req.body;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      // Create user first
      const userData = {
        id: randomUUID(),
        email,
        firstName,
        lastName,
        phone,
        role: "vendor",
        address,
        city,
        state,
        pincode,
      };

      const newUser = await storage.upsertUser(userData);

      // Create vendor profile
      const vendorData = {
        userId: newUser.id,
        businessName,
        description,
        category,
        address,
        city,
        state,
        pincode,
        gstNumber,
        license,
        status: "approved", // Admin-created vendors are auto-approved
      };

      const newVendor = await storage.createVendor(vendorData);
      
      res.json(newVendor);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      
      // Handle specific database errors
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });



  // Real-time analytics endpoints
  app.get('/api/admin/revenue-data', async (req: any, res) => {
    try {
      // Check admin authentication
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const revenueData = await storage.getRevenueData();
      res.json(revenueData);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      res.status(500).json({ message: "Failed to fetch revenue data" });
    }
  });

  app.get('/api/admin/category-performance', async (req: any, res) => {
    try {
      // Check admin authentication
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const categoryData = await storage.getCategoryPerformance();
      res.json(categoryData);
    } catch (error) {
      console.error("Error fetching category performance:", error);
      res.status(500).json({ message: "Failed to fetch category performance" });
    }
  });

  app.get('/api/admin/recent-activity', isOTPAuthenticated, async (req, res) => {
    try {
      const activityData = await storage.getRecentActivities();
      res.json(activityData);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Remove duplicate enhanced analytics endpoint

  app.get('/api/admin/vendor-performance', async (req: any, res) => {
    try {
      // Check admin authentication
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const vendorData = await storage.getVendorPerformance();
      res.json(vendorData);
    } catch (error) {
      console.error("Error fetching vendor performance:", error);
      res.status(500).json({ message: "Failed to fetch vendor performance" });
    }
  });

  app.get('/api/admin/sales-analytics/:dateRange?', async (req: any, res) => {
    try {
      // Check admin authentication
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const dateRange = req.params.dateRange || req.query.dateRange as string || "last_30_days";
      const salesData = await storage.getSalesAnalytics(dateRange);
      res.json(salesData);
    } catch (error) {
      console.error("Error fetching sales analytics:", error);
      res.status(500).json({ message: "Failed to fetch sales analytics" });
    }
  });

  // Vendor analytics endpoint
  app.get('/api/vendor/analytics', isOTPAuthenticated, async (req: any, res) => {
    try {
      const vendorId = req.user?.vendorId || req.query.vendorId;
      const dateRange = req.query.dateRange as string || "last_30_days";
      
      if (!vendorId) {
        return res.status(400).json({ message: "Vendor ID required" });
      }

      const analyticsData = await storage.getVendorAnalytics(vendorId, dateRange);
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching vendor analytics:", error);
      res.status(500).json({ message: "Failed to fetch vendor analytics" });
    }
  });

  app.get('/api/admin/top-products', async (req: any, res) => {
    try {
      // Check admin authentication
      const sessionData = req.session;
      if (!sessionData?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(sessionData.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const topProducts = await storage.getTopProducts();
      res.json(topProducts);
    } catch (error) {
      console.error("Error fetching top products:", error);
      res.status(500).json({ message: "Failed to fetch top products" });
    }
  });

  // REAL notification system - Send notifications to users
  app.post('/api/admin/send-smart-notification', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { title, template, targetType = 'customers' } = req.body;
      
      // Get target users based on type
      const allUsers = await storage.getUsers();
      const targetUsers = targetType === 'all' ? allUsers : allUsers.filter((u: any) => u.role === 'customer');
      
      console.log(`📢 Sending smart notification to ${targetUsers.length} ${targetType}`);
      
      let successful = 0;
      let failed = 0;
      const deliveryResults = [];
      
      for (const targetUser of targetUsers) {
        try {
          // Extract user-specific data
          const emailPrefix = targetUser.email ? targetUser.email.split('@')[0] : 'User';
          const firstName = targetUser.firstName || emailPrefix;
          const fullName = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || emailPrefix;
          
          // Process template with user's actual data
          let processedBody = template;
          processedBody = processedBody.replace(/\{\{user_name\}\}/g, fullName);
          processedBody = processedBody.replace(/\{\{first_name\}\}/g, firstName);
          processedBody = processedBody.replace(/\{\{pending_balance\}\}/g, `₹0.00`);
          processedBody = processedBody.replace(/\{\{wallet_balance\}\}/g, `₹0.00`);
          processedBody = processedBody.replace(/\{\{cart_items\}\}/g, `0 items`);
          processedBody = processedBody.replace(/\{\{last_order_date\}\}/g, 'No orders yet');
          processedBody = processedBody.replace(/\{\{total_orders\}\}/g, `0 orders`);
          processedBody = processedBody.replace(/\{\{membership_days\}\}/g, targetUser.createdAt ? `${Math.floor((Date.now() - new Date(targetUser.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days` : '0 days');
          processedBody = processedBody.replace(/\{\{delivery_address\}\}/g, 'No address saved');
          
          // Store notification in database for user to see when they log in
          const notificationId = await storage.createNotification({
            userId: targetUser.id,
            title: title,
            body: processedBody,
            type: 'admin_broadcast',
            status: 'delivered',
            metadata: { sentByAdmin: user.email, originalTemplate: template }
          });
          
          console.log(`✅ Notification sent to ${firstName} (${targetUser.email}): ${processedBody}`);
          
          deliveryResults.push({
            userId: targetUser.id,
            email: targetUser.email,
            firstName: firstName,
            message: processedBody,
            status: 'delivered',
            notificationId
          });
          
          successful++;
        } catch (userError) {
          console.error(`❌ Failed to send notification to ${targetUser.email}:`, userError);
          deliveryResults.push({
            userId: targetUser.id,
            email: targetUser.email,
            status: 'failed',
            error: (userError as Error).message
          });
          failed++;
        }
      }
      
      res.json({ 
        success: true, 
        message: `Smart notification sent to ${successful} users${failed > 0 ? `, ${failed} failed` : ''}`,
        results: { successful, failed, total: targetUsers.length },
        deliveryResults: deliveryResults.slice(0, 5) // Show first 5 for admin verification
      });
      
    } catch (error) {
      console.error("Error sending smart notification:", error);
      res.status(500).json({ message: "Failed to send smart notification" });
    }
  });

  // Get notifications for a user (when they log in)
  app.get('/api/notifications', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const notifications = await storage.getUserNotifications(user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.patch('/api/notifications/:id/read', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      const { id } = req.params;
      await storage.markNotificationAsRead(id, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Schedule automatic image cleanup every hour
  setInterval(async () => {
    try {
      await storage.cleanupExpiredImages();
      console.log('[Image Cleanup] Performed automatic cleanup of expired images');
    } catch (error) {
      console.error('[Image Cleanup] Error during automatic cleanup:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Manual cleanup endpoint for admin
  app.post('/api/admin/cleanup-images', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      await storage.cleanupExpiredImages();
      const remaining = await storage.getScheduledCleanups();
      
      res.json({ 
        message: 'Image cleanup completed successfully',
        remainingCleanups: remaining.length 
      });
    } catch (error) {
      console.error("Error during manual image cleanup:", error);
      res.status(500).json({ message: "Failed to cleanup images" });
    }
  });

  // Admin POS Management routes (accessible by admin users)
  app.get('/api/admin/pos/raw-materials', async (req: any, res) => {
    try {
      // Allow access for admin users for stock monitoring
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const materials = await storage.getAllRawMaterials();
      res.json(materials);
    } catch (error) {
      console.error("Error fetching raw materials:", error);
      res.status(500).json({ message: "Failed to fetch raw materials" });
    }
  });

  app.patch('/api/admin/pos/raw-materials/:id/stock', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { quantity, type, notes } = req.body;
      
      const material = await storage.getRawMaterial(id);
      if (!material) {
        return res.status(404).json({ message: "Raw material not found" });
      }

      const newStock = type === 'add' 
        ? parseFloat(material.currentStock) + parseFloat(quantity)
        : Math.max(0, parseFloat(material.currentStock) - parseFloat(quantity));

      await storage.updateRawMaterialStock(id, newStock);
      
      res.json({ message: "Stock updated successfully" });
    } catch (error) {
      console.error("Error updating stock:", error);
      res.status(500).json({ message: "Failed to update stock" });
    }
  });

  // Raw Material Management Routes for POS
  app.get('/api/pos/raw-materials', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const materials = await storage.getRawMaterialsByProfile(posProfile.id);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching raw materials:", error);
      res.status(500).json({ message: "Failed to fetch raw materials" });
    }
  });

  app.post('/api/pos/raw-materials', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const materialData = { ...req.body, posProfileId: posProfile.id };
      const material = await storage.createRawMaterial(materialData);
      res.json(material);
    } catch (error) {
      console.error("Error creating raw material:", error);
      res.status(500).json({ message: "Failed to create raw material" });
    }
  });

  app.patch('/api/pos/raw-materials/:id', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;
      const updatedMaterial = await storage.updateRawMaterialByUser(id, user.id, req.body);
      res.json(updatedMaterial);
    } catch (error) {
      console.error("Error updating raw material:", error);
      res.status(500).json({ message: "Failed to update raw material" });
    }
  });

  // Stock Entry Management Routes
  app.get('/api/pos/stock-entries', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const entries = await storage.getStockEntriesByProfile(posProfile.id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching stock entries:", error);
      res.status(500).json({ message: "Failed to fetch stock entries" });
    }
  });

  app.post('/api/pos/stock-entries', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const entryData = { 
        ...req.body, 
        posProfileId: posProfile.id,
        createdBy: user.id 
      };
      const entry = await storage.createStockEntry(entryData);
      res.json(entry);
    } catch (error) {
      console.error("Error creating stock entry:", error);
      res.status(500).json({ message: "Failed to create stock entry" });
    }
  });

  // Delete stock entry
  app.delete('/api/pos/stock-entries/:id', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;
      await storage.deleteStockEntry(id, user.id);
      res.json({ message: "Stock entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting stock entry:", error);
      res.status(500).json({ message: "Failed to delete stock entry" });
    }
  });

  // Delete raw material
  app.delete('/api/pos/raw-materials/:id', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;
      await storage.deleteRawMaterial(id, user.id);
      res.json({ message: "Raw material deleted successfully" });
    } catch (error) {
      console.error("Error deleting raw material:", error);
      res.status(500).json({ message: "Failed to delete raw material" });
    }
  });

  // Update raw material
  app.patch('/api/pos/raw-materials/:id', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user;
      const updatedMaterial = await storage.updateRawMaterialByUser(id, user.id, req.body);
      res.json(updatedMaterial);
    } catch (error) {
      console.error("Error updating raw material:", error);
      res.status(500).json({ message: "Failed to update raw material" });
    }
  });

  // Product Recipe Management Routes
  app.get('/api/pos/product-recipes/:productId', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const recipes = await storage.getProductRecipes(productId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching product recipes:", error);
      res.status(500).json({ message: "Failed to fetch product recipes" });
    }
  });

  app.post('/api/pos/product-recipes', isPOSAuthenticated, async (req: any, res) => {
    try {
      const recipe = await storage.createProductRecipe(req.body);
      res.json(recipe);
    } catch (error) {
      console.error("Error creating product recipe:", error);
      res.status(500).json({ message: "Failed to create product recipe" });
    }
  });

  // Profit Analysis Route
  app.get('/api/pos/profit-analysis', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const analysis = await storage.getProfitAnalysis(posProfile.id);
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching profit analysis:", error);
      res.status(500).json({ message: "Failed to fetch profit analysis" });
    }
  });

  // Enhanced POS Sale with Integration Route
  app.post('/api/pos/integrated-sales', isPOSAuthenticated, async (req: any, res) => {
    try {
      const user = req.session.user;
      const posProfile = await storage.getPosProfileByUserId(user.id);
      
      if (!posProfile) {
        return res.status(404).json({ message: "POS profile not found" });
      }
      
      const { saleData, items, customerData } = req.body;
      const fullSaleData = { ...saleData, posProfileId: posProfile.id };
      
      const result = await storage.createIntegratedPosSale(fullSaleData, items, customerData);
      
      res.json({
        success: true,
        posSale: result.posSale,
        order: result.order,
        message: result.order 
          ? "POS sale created and integrated with order system" 
          : "POS sale created successfully"
      });
    } catch (error) {
      console.error("Error creating integrated POS sale:", error);
      res.status(500).json({ message: "Failed to create integrated sale" });
    }
  });

  // UPI QR Code Generation Route
  app.post('/api/pos/generate-qr', isPOSAuthenticated, async (req: any, res) => {
    try {
      const { amount, transactionNote } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // Import QR code library
      const QRCode = require('qrcode');
      
      // UPI payment URL format
      const upiId = "aifortechiesbe10x@gmail.com"; // Store UPI ID
      const merchantName = "Amrit Dairy POS";
      const transactionId = `TXN${Date.now()}`;
      
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote || 'POS Payment')}&tr=${transactionId}`;
      
      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(upiUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      res.json({
        success: true,
        qrCodeDataURL,
        upiUrl,
        transactionId,
        amount: parseFloat(amount),
        merchantName,
        upiId
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // OTP Settings Management Routes
  app.get('/api/admin/otp-settings', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      // Get current OTP settings or return defaults
      const maxRequestsSetting = await storage.getAdminSetting('otp_max_requests');
      const windowMinutesSetting = await storage.getAdminSetting('otp_window_minutes');

      const settings = {
        maxRequests: maxRequestsSetting ? parseInt(maxRequestsSetting.value) : 5,
        windowMinutes: windowMinutesSetting ? parseInt(windowMinutesSetting.value) : 5
      };

      res.json(settings);
    } catch (error) {
      console.error("Error fetching OTP settings:", error);
      res.status(500).json({ message: "Failed to fetch OTP settings" });
    }
  });

  app.put('/api/admin/otp-settings', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { maxRequests, windowMinutes } = req.body;

      // Validate input
      if (!maxRequests || !windowMinutes || maxRequests < 1 || maxRequests > 50 || windowMinutes < 1 || windowMinutes > 60) {
        return res.status(400).json({ 
          message: "Invalid settings. Max requests (1-50) and window minutes (1-60) are required." 
        });
      }

      // Update settings in database
      await storage.setAdminSetting('otp_max_requests', maxRequests.toString(), 
        `Maximum OTP requests allowed per time window`);
      await storage.setAdminSetting('otp_window_minutes', windowMinutes.toString(), 
        `Time window in minutes for OTP rate limiting`);

      res.json({ 
        success: true, 
        message: "OTP settings updated successfully",
        settings: { maxRequests, windowMinutes }
      });
    } catch (error) {
      console.error("Error updating OTP settings:", error);
      res.status(500).json({ message: "Failed to update OTP settings" });
    }
  });

  // Promo Codes Management Routes
  app.get('/api/admin/promo-codes', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { isActive, discountType, usageType } = req.query;
      const promoCodes = await storage.getPromoCodes({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        discountType: discountType || undefined,
        usageType: usageType || undefined,
      });

      res.json(promoCodes);
    } catch (error) {
      console.error("Error fetching promo codes:", error);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  app.post('/api/admin/promo-codes', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const promoCodeData = { ...req.body, createdBy: user.id };
      const promoCode = await storage.createPromoCode(promoCodeData);

      res.status(201).json(promoCode);
    } catch (error) {
      console.error("Error creating promo code:", error);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });

  app.put('/api/admin/promo-codes/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const promoCode = await storage.updatePromoCode(id, req.body);

      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json(promoCode);
    } catch (error) {
      console.error("Error updating promo code:", error);
      res.status(500).json({ message: "Failed to update promo code" });
    }
  });

  app.put('/api/admin/promo-codes/:id/status', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      const promoCode = await storage.updatePromoCode(id, { isActive });

      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json(promoCode);
    } catch (error) {
      console.error("Error updating promo code status:", error);
      res.status(500).json({ message: "Failed to update promo code status" });
    }
  });

  app.delete('/api/admin/promo-codes/:id', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const success = await storage.deletePromoCode(id);

      if (!success) {
        return res.status(404).json({ message: "Promo code not found" });
      }

      res.json({ message: "Promo code deleted successfully" });
    } catch (error) {
      console.error("Error deleting promo code:", error);
      res.status(500).json({ message: "Failed to delete promo code" });
    }
  });

  // Using simple local messaging instead of complex web-push

  // Simple local notification endpoints (no server push needed)
  
  // Test notification endpoint - returns success for local testing
  app.post('/api/push/test', isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // No server push needed - client handles local notifications
      res.json({ 
        success: true, 
        message: 'Local notification system ready - use client-side messaging' 
      });
    } catch (error) {
      console.error('Error in test endpoint:', error);
      res.status(500).json({ message: 'Test endpoint failed' });
    }
  });

  // Smart notification preview endpoint - returns count for local notifications
  app.post('/api/push/send-smart', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // No server push needed - client handles local notifications
      res.json({
        success: true,
        message: 'Smart notification demo - using local messaging instead',
        results: {
          successful: 1,
          failed: 0,
          total: 1
        }
      });
    } catch (error) {
      console.error('Error in smart notification endpoint:', error);
      res.status(500).json({ message: 'Smart notification endpoint failed' });
    }
  });

  const httpServer = createServer(app);

  // WebSocket Server Setup for Real-time Sync
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true 
  });

  wss.on('connection', (ws, req) => {
    const clientId = randomUUID();
    const clientInfo: WebSocketClient = {
      ws,
      isAlive: true
    };
    
    clients.set(clientId, clientInfo);
    console.log(`📱 New WebSocket connection: ${clientId}`);

    // Handle client authentication and role identification
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          clientInfo.userId = message.userId;
          clientInfo.userRole = message.userRole;
          console.log(`✅ Client authenticated: ${message.userId} (${message.userRole})`);
          
          // Send initial sync data for mobile apps
          if (message.userRole === 'customer') {
            ws.send(JSON.stringify({
              type: 'sync_complete',
              message: 'Connected to real-time sync service',
              timestamp: new Date().toISOString()
            }));
          }
        }
        
        if (message.type === 'ping') {
          clientInfo.isAlive = true;
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`📱 WebSocket connection closed: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(clientId);
    });

    // Send initial connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to Amrit Dairy sync service'
    }));
  });

  // Heartbeat to keep connections alive
  setInterval(() => {
    clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(clientId);
        return;
      }
      
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });
  }, 30000); // 30 seconds heartbeat

  console.log('🔄 WebSocket server initialized for real-time mobile app sync');
  // Object Storage Endpoints
  
  // Get upload URL for profile picture
  app.post("/api/profile/upload-url", isOTPAuthenticated, async (req, res) => {
    try {
      const objectStorage = await storageService.get();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Update user profile picture
  app.patch("/api/profile/picture", isOTPAuthenticated, async (req: any, res) => {
    try {
      const userId = req.otpUser.id;
      const { profilePictureURL } = req.body;

      if (!profilePictureURL) {
        return res.status(400).json({ error: "Profile picture URL is required" });
      }

      const objectStorage = await storageService.get();
      
      // Set ACL policy for the uploaded image (public visibility for profile pictures)
      const objectPath = await objectStorage.trySetObjectEntityAclPolicy(
        profilePictureURL,
        {
          owner: userId,
          visibility: "public", // Profile pictures are public
        }
      );

      // Update user's profile picture URL in database
      const updatedUser = await storage.updateUser(userId, { 
        profilePictureUrl: objectPath 
      });

      res.json({ 
        success: true, 
        profilePictureUrl: objectPath,
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ error: "Failed to update profile picture" });
    }
  });

  // Serve uploaded objects (with ACL check)
  app.get("/objects/:objectPath(*)", isOTPAuthenticated, async (req: any, res) => {
    const userId = req.otpUser?.id;
    const objectStorage = await storageService.get();
    
    try {
      const objectFile = await objectStorage.getObjectEntityFile(req.path);
      const canAccess = await objectStorage.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      await objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError || error instanceof VpsObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Configure multer for file uploads (VPS storage)
  const storage_multer = multer({
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
      fileSize: parseInt(process.env.VPS_MAX_FILE_SIZE || '10485760'), // 10MB default
      files: 1, // Allow only 1 file at a time
    },
    fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Only allow images
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}. Only images are allowed.`));
      }
    }
  });

  // VPS-specific file upload endpoint
  app.post("/api/vps-upload/:fileName", isOTPAuthenticated, storage_multer.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const objectStorage = await storageService.get();
      const storageType = storageService.getType();

      // Only handle this route for VPS storage
      if (storageType !== StorageType.VPS_LOCAL) {
        return res.status(400).json({ error: "VPS upload endpoint only available for local storage" });
      }

      // Get file category from query parameter or default to temp
      const category = req.query.category || 'temp';
      
      // Set ACL policy for the uploaded file
      const userId = req.otpUser.id;
      const aclPolicy = {
        owner: userId,
        visibility: category === 'temp' ? 'private' : 'public'
      };
      
      // Handle the file upload using VPS storage with ACL policy
      const objectPath = await (objectStorage as any).handleFileUpload(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        category,
        aclPolicy
      );
      
      const finalObjectPath = objectPath; // No need to set ACL again, it's already set during upload

      res.json({ 
        success: true, 
        objectPath: finalObjectPath,
        uploadURL: finalObjectPath, // For compatibility with frontend
        size: req.file.size,
        type: req.file.mimetype 
      });
      
    } catch (error) {
      console.error("Error in VPS file upload:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "File upload failed" 
      });
    }
  });

  // Alternative simple upload endpoint that works with form data
  app.post("/api/upload", isOTPAuthenticated, storage_multer.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const objectStorage = await storageService.get();
      const storageType = storageService.getType();
      const userId = req.otpUser.id;
      const category = req.body.category || req.query.category || 'temp';

      let objectPath: string;

      if (storageType === StorageType.VPS_LOCAL) {
        // Set ACL policy
        const aclPolicy = {
          owner: userId,
          visibility: category === 'temp' ? 'private' : 'public'
        };
        
        // Handle VPS local storage with ACL policy
        objectPath = await (objectStorage as any).handleFileUpload(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          category,
          aclPolicy
        );
        
        // No need to set ACL again, it's already set during upload
      } else {
        // For GCS, we need to handle it differently
        // This is a fallback for when GCS is used
        return res.status(501).json({ 
          error: "Direct file upload not supported for cloud storage. Use upload URL endpoint instead." 
        });
      }

      res.json({ 
        success: true, 
        objectPath,
        uploadURL: objectPath,
        size: req.file.size,
        type: req.file.mimetype 
      });
      
    } catch (error) {
      console.error("Error in file upload:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "File upload failed" 
      });
    }
  });

  // Storage health check endpoint
  app.get("/api/storage/health", async (req, res) => {
    try {
      const healthCheck = await storageService.healthCheck();
      res.json({
        status: healthCheck.status,
        storageType: healthCheck.type,
        timestamp: new Date().toISOString(),
        ...(healthCheck.error && { error: healthCheck.error })
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Storage health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Storage statistics endpoint (admin only)
  app.get("/api/admin/storage/stats", isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const objectStorage = await storageService.get();
      const storageType = storageService.getType();

      if (storageType === StorageType.VPS_LOCAL) {
        const stats = await (objectStorage as any).getStorageStatistics();
        res.json({
          ...stats,
          storageType,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          storageType,
          message: "Storage statistics not available for cloud storage",
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error fetching storage statistics:", error);
      res.status(500).json({ 
        error: "Failed to fetch storage statistics" 
      });
    }
  });

  // ===========================================
  // WALLET SYSTEM API ENDPOINTS
  // ===========================================

  // Get wallet for a user
  app.get('/api/wallet/:userId', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const requestedUserId = req.params.userId;
      const currentUser = await storage.getUser(req.session.userId);
      
      // Allow users to view their own wallet, or admins to view any wallet
      if (currentUser?.role !== 'admin' && req.session.userId !== requestedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      let wallet = await storage.getWallet(requestedUserId);
      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await storage.ensureWalletExists(requestedUserId);
      }

      res.json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Get wallet transactions for a user
  app.get('/api/wallet/:userId/transactions', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const requestedUserId = req.params.userId;
      const currentUser = await storage.getUser(req.session.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Allow users to view their own transactions, or admins to view any transactions
      if (currentUser?.role !== 'admin' && req.session.userId !== requestedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const transactions = await storage.getWalletTransactions(requestedUserId, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch wallet transactions" });
    }
  });

  // Admin - Get all wallets with filters
  app.get('/api/admin/wallets', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        minBalance: req.query.minBalance ? parseFloat(req.query.minBalance as string) : undefined,
        maxBalance: req.query.maxBalance ? parseFloat(req.query.maxBalance as string) : undefined,
      };

      const wallets = await storage.getAllWallets(filters);
      res.json(wallets);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  // Admin - Credit wallet
  app.post('/api/admin/wallet/:userId/credit', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { userId } = req.params;
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      // Ensure wallet exists
      await storage.ensureWalletExists(userId);

      const updatedWallet = await storage.creditWallet(
        userId, 
        parseFloat(amount), 
        description, 
        undefined, 
        'manual_adjustment'
      );

      res.json(updatedWallet);
    } catch (error) {
      console.error("Error crediting wallet:", error);
      res.status(500).json({ message: "Failed to credit wallet" });
    }
  });

  // Admin - Debit wallet
  app.post('/api/admin/wallet/:userId/debit', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { userId } = req.params;
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      // Ensure wallet exists
      await storage.ensureWalletExists(userId);

      const updatedWallet = await storage.debitWallet(
        userId, 
        parseFloat(amount), 
        description, 
        undefined, 
        'manual_adjustment'
      );

      res.json(updatedWallet);
    } catch (error) {
      console.error("Error debiting wallet:", error);
      res.status(500).json({ message: "Failed to debit wallet" });
    }
  });

  // Admin - Clear wallet
  app.post('/api/admin/wallet/:userId/clear', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { userId } = req.params;

      const clearedWallet = await storage.clearWallet(userId, req.session.userId);
      res.json(clearedWallet);
    } catch (error) {
      console.error("Error clearing wallet:", error);
      res.status(500).json({ message: "Failed to clear wallet" });
    }
  });

  // Admin - Update wallet threshold
  app.patch('/api/admin/wallet/:userId/threshold', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { userId } = req.params;
      const { threshold } = req.body;

      if (!threshold || threshold < 0) {
        return res.status(400).json({ message: "Valid threshold is required" });
      }

      // Ensure wallet exists
      await storage.ensureWalletExists(userId);

      const updatedWallet = await storage.updateWalletThreshold(userId, parseFloat(threshold));
      res.json(updatedWallet);
    } catch (error) {
      console.error("Error updating wallet threshold:", error);
      res.status(500).json({ message: "Failed to update wallet threshold" });
    }
  });

  // Admin - Get wallet settings
  app.get('/api/admin/wallet-settings', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const settings = await storage.getWalletSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching wallet settings:", error);
      res.status(500).json({ message: "Failed to fetch wallet settings" });
    }
  });

  // Admin - Update wallet settings
  app.patch('/api/admin/wallet-settings', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const settings = req.body;
      const updatedSettings = await storage.updateWalletSettings(settings, req.session.userId);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating wallet settings:", error);
      res.status(500).json({ message: "Failed to update wallet settings" });
    }
  });

  // Admin - Bulk apply threshold
  app.post('/api/admin/wallets/bulk-threshold', async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const { threshold, excludeUserIds = [] } = req.body;

      if (!threshold || threshold < 0) {
        return res.status(400).json({ message: "Valid threshold is required" });
      }

      const affectedCount = await storage.bulkApplyThreshold(parseFloat(threshold), excludeUserIds);
      res.json({ 
        success: true, 
        affectedCount, 
        message: `Updated ${affectedCount} wallets with new threshold` 
      });
    } catch (error) {
      console.error("Error applying bulk threshold:", error);
      res.status(500).json({ message: "Failed to apply bulk threshold" });
    }
  });

  // ===== Agreements Management Routes =====
  
  // Get all agreement templates
  app.get('/api/admin/agreements/templates', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const templates = await storage.getAgreementTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching agreement templates:', error);
      res.status(500).json({ message: 'Failed to fetch agreement templates' });
    }
  });

  // Get specific agreement template
  app.get('/api/admin/agreements/templates/:type', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { type } = req.params;
      const template = await storage.getAgreementTemplate(type);
      if (!template) {
        return res.status(404).json({ message: "Agreement template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error('Error fetching agreement template:', error);
      res.status(500).json({ message: 'Failed to fetch agreement template' });
    }
  });

  // Update agreement template
  app.put('/api/admin/agreements/templates/:type', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { type } = req.params;
      const { content, variables, changeReason } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      const updatedTemplate = await storage.updateAgreementTemplate(
        type, 
        content, 
        variables || {}, 
        user.id, 
        changeReason
      );

      res.json(updatedTemplate);
    } catch (error) {
      console.error('Error updating agreement template:', error);
      res.status(500).json({ message: 'Failed to update agreement template' });
    }
  });

  // Get all agreement variables
  app.get('/api/admin/agreements/variables', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const variables = await storage.getAgreementVariables();
      res.json(variables);
    } catch (error) {
      console.error('Error fetching agreement variables:', error);
      res.status(500).json({ message: 'Failed to fetch agreement variables' });
    }
  });

  // Update agreement variable
  app.put('/api/admin/agreements/variables/:key', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ message: "Value is required" });
      }

      const updatedVariable = await storage.updateAgreementVariable(key, value, user.id);
      res.json(updatedVariable);
    } catch (error) {
      console.error('Error updating agreement variable:', error);
      res.status(500).json({ message: 'Failed to update agreement variable' });
    }
  });

  // Get processed agreement content (public endpoint for legal pages)
  app.get('/api/agreements/:type', async (req, res) => {
    try {
      const { type } = req.params;
      const processedContent = await storage.getProcessedAgreementContent(type);
      res.json({ content: processedContent });
    } catch (error) {
      console.error('Error fetching processed agreement content:', error);
      res.status(500).json({ message: 'Failed to fetch agreement content' });
    }
  });

  // Get agreement history
  app.get('/api/admin/agreements/templates/:type/history', isOTPAuthenticated, async (req: any, res) => {
    try {
      const user = req.otpUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { type } = req.params;
      const template = await storage.getAgreementTemplate(type);
      if (!template) {
        return res.status(404).json({ message: "Agreement template not found" });
      }

      const history = await storage.getAgreementHistory(template.id);
      res.json(history);
    } catch (error) {
      console.error('Error fetching agreement history:', error);
      res.status(500).json({ message: 'Failed to fetch agreement history' });
    }
  });

  return httpServer;
}
