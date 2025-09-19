import {
  users,
  vendors,
  products,
  orders,
  orderItems,
  subscriptions,
  subscriptionItems,
  addresses,
  deliveries,
  deliveryPartners,
  reviews,
  categories,
  advertisements,
  customerReviews,
  orderReviews,
  productReviews,
  websiteStats,
  imageCleanup,
  adminSettings,
  posProfiles,
  posSales,
  posSaleItems,
  rawMaterials,
  stockEntries,
  productRecipes,
  otps,
  otpRateLimits,
  wallets,
  walletTransactions,
  walletSettings,
  agreementTemplates,
  agreementVariables,
  agreementHistory,
  promoCodes,
  promoCodeUsages,
  notifications,
  type User,
  type UpsertUser,
  type Vendor,
  type Product,
  type Order,
  type OrderItem,
  type Subscription,
  type Address,
  type Delivery,
  type Review,
  type Category,
  type Advertisement,
  type CustomerReview,
  type OrderReview,
  type ProductReview,
  type WebsiteStats,
  type ImageCleanup,
  type PosProfile,
  type PosSale,
  type PosSaleItem,
  type RawMaterial,
  type StockEntry,
  type ProductRecipe,
  type Wallet,
  type WalletTransaction,
  type WalletSettings,
  type AgreementTemplate,
  type AgreementVariable,
  type AgreementHistory,
  type PromoCode,
  type PromoCodeUsage,
  type OtpRateLimit,
  type InsertOtpRateLimit,
  type InsertVendor,
  type InsertProduct,
  type InsertOrder,
  type InsertSubscription,
  type InsertPosProfile,
  type InsertPosSale,
  type InsertPosSaleItem,
  type InsertRawMaterial,
  type InsertStockEntry,
  type InsertProductRecipe,
  type InsertWebsiteStats,
  type InsertWallet,
  type InsertWalletTransaction,
  type InsertWalletSettings,
  type InsertPromoCode,
  type InsertPromoCodeUsage,
  type InsertAgreementTemplate,
  type InsertAgreementVariable,
  type InsertAgreementHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, count, sum, gte, lte, lt, isNull, isNotNull, or, like, ilike, inArray, ne } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(userData: any): Promise<User>;
  updateUser(id: string, userData: any): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // OTP operations
  createOTP(contact: string, otp: string, purpose: string, contactType: 'email' | 'phone', expiresAt: Date): Promise<any>;
  getValidOTP(contact: string, purpose: string): Promise<any>;
  markOTPAsUsed(id: string): Promise<void>;
  cleanupExpiredOTPs(): Promise<void>;
  
  // OTP Rate Limiting operations (CRITICAL SECURITY FIX)
  createOrUpdateOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string, ipAddress?: string, userAgent?: string): Promise<OtpRateLimit>;
  getOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string): Promise<OtpRateLimit | undefined>;
  checkOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string, ipAddress?: string): Promise<{ allowed: boolean; requestCount: number; maxRequests: number; windowMinutes: number; timeUntilReset: number; blockedUntil?: Date }>;
  resetOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string): Promise<void>;
  cleanupExpiredOtpRateLimits(): Promise<void>;
  blockOtpContact(contact: string, contactType: 'email' | 'phone', purpose: string, blockDurationMinutes: number): Promise<void>;
  
  // Vendor operations
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  getVendor(id: string): Promise<Vendor | undefined>;
  getVendorByUserId(userId: string): Promise<Vendor | undefined>;
  updateVendorStatus(id: string, status: string): Promise<Vendor>;
  getVendors(limit?: number, offset?: number): Promise<Vendor[]>;
  
  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductsByVendor(vendorId: string): Promise<Product[]>;
  getProducts(limit?: number, offset?: number, categoryId?: string): Promise<Product[]>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product>;
  updateProductStock(id: string, stock: number): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  
  // Category operations
  createCategory(category: { name: string; description?: string; imageUrl?: string; gstRate?: string; gstType?: string }): Promise<Category>;
  getCategory(id: string): Promise<Category | undefined>;
  updateCategory(id: string, updates: { name?: string; description?: string; imageUrl?: string; isActive?: boolean; gstRate?: string; gstType?: string }): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  
  // Order operations
  createOrder(orderData: any, items?: any[]): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  getOrdersByVendor(vendorId: string): Promise<Order[]>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<Order>;
  findSimilarOrders(userId: string, productIds: string[]): Promise<Order[]>;
  getOrderItems(orderId: string): Promise<any[]>;
  
  // Cart operations
  getCartItems(userId: string): Promise<any[]>;
  addToCart(userId: string, productId: string, quantity: number): Promise<any>;
  updateCartItemQuantity(userId: string, itemId: string, quantity: number): Promise<any>;
  removeFromCart(userId: string, itemId: string): Promise<void>;
  
  // Advertisement operations
  getActiveAdvertisements(): Promise<Advertisement[]>;
  
  // Customer review operations (order-based)
  getCustomerReviews(filters?: { limit?: number; shortlistedOnly?: boolean; minRating?: number; maxRating?: number; minOrderValue?: number; maxOrderValue?: number; customerName?: string }): Promise<any[]>;
  createCustomerReview(review: { orderId: string; userId?: string; customerName: string; rating: number; reviewText: string; orderValue: number }): Promise<CustomerReview>;
  updateCustomerReview(id: string, updates: { customerName?: string; rating?: number; reviewText?: string; isShortlisted?: boolean; isActive?: boolean }): Promise<CustomerReview>;
  deleteCustomerReview(id: string): Promise<void>;
  getOrdersEligibleForReview(userId: string): Promise<any[]>;
  hasUserReviewedOrder(orderId: string): Promise<boolean>;
  getOrderReviewByOrderId(orderId: string): Promise<OrderReview | undefined>;
  
  // Website statistics operations
  getWebsiteStats(): Promise<WebsiteStats[]>;
  createWebsiteStats(stats: InsertWebsiteStats): Promise<WebsiteStats>;
  updateWebsiteStats(id: string, updates: Partial<InsertWebsiteStats>): Promise<WebsiteStats>;
  deleteWebsiteStats(id: string): Promise<void>;
  
  // Image cleanup operations
  scheduleImageCleanup(imageUrl: string, entityType: string, entityId: string): Promise<void>;
  cleanupExpiredImages(): Promise<number>;
  getScheduledCleanups(): Promise<ImageCleanup[]>;

  
  // Subscription operations
  createSubscription(subscription: InsertSubscription, items: Array<{ productId: string; quantity: number; price: number }>): Promise<Subscription>;
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  getSubscriptionsByVendor(vendorId: string): Promise<Subscription[]>;
  updateSubscriptionStatus(id: string, status: string): Promise<Subscription>;
  
  // Address operations
  createAddress(address: Omit<Address, 'id' | 'createdAt'>): Promise<Address>;
  getAddressesByUser(userId: string): Promise<Address[]>;
  updateAddress(id: string, updates: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>): Promise<Address>;
  deleteAddress(id: string): Promise<void>;
  
  getCategories(): Promise<Category[]>;
  
  // Analytics
  getVendorStats(vendorId: string): Promise<any>;
  getAdminStats(): Promise<any>;
  getGrowthMetrics(): Promise<any>;
  getPerformanceMetrics(): Promise<any>;
  getRecentActivities(): Promise<any[]>;
  
  // User analytics
  getUsersWithSpending(): Promise<any[]>;
  
  // Admin settings operations
  getAdminSetting(key: string): Promise<{ value: string } | undefined>;
  setAdminSetting(key: string, value: string, description?: string): Promise<void>;
  getAdminSettings(): Promise<Array<{ key: string; value: string; description?: string }>>;
  
  // POS operations
  createPosProfile(posProfile: InsertPosProfile): Promise<PosProfile>;
  getPosProfile(id: string): Promise<PosProfile | undefined>;
  getPosProfileByUserId(userId: string): Promise<PosProfile | undefined>;
  updatePosProfile(id: string, updates: Partial<InsertPosProfile>): Promise<PosProfile>;
  createPosSale(saleData: InsertPosSale, items: InsertPosSaleItem[]): Promise<PosSale>;
  getPosSale(id: string): Promise<PosSale | undefined>;
  updatePosSale(id: string, updates: Partial<InsertPosSale>): Promise<PosSale>;
  getPosSalesByProfile(posProfileId: string): Promise<PosSale[]>;
  getPosSalesWithItems(posProfileId: string): Promise<any[]>;
  getPosStats(posProfileId: string): Promise<any>;

  // Wallet operations
  getWallet(userId: string): Promise<Wallet | undefined>;
  createWallet(walletData: InsertWallet): Promise<Wallet>;
  updateWalletBalance(userId: string, amount: number, description: string, reference?: string, referenceType?: string, processedBy?: string): Promise<Wallet>;
  debitWallet(userId: string, amount: number, description: string, reference?: string, referenceType?: string): Promise<Wallet>;
  creditWallet(userId: string, amount: number, description: string, reference?: string, referenceType?: string): Promise<Wallet>;
  clearWallet(userId: string, processedBy: string): Promise<Wallet>;
  getWalletTransactions(userId: string, limit?: number): Promise<WalletTransaction[]>;
  getAllWallets(filters?: { page?: number; limit?: number; minBalance?: number; maxBalance?: number }): Promise<any[]>;
  updateWalletThreshold(userId: string, threshold: number): Promise<Wallet>;
  getWalletSettings(): Promise<WalletSettings | undefined>;
  updateWalletSettings(settings: Partial<InsertWalletSettings>, updatedBy: string): Promise<WalletSettings>;
  bulkApplyThreshold(threshold: number, excludeUserIds?: string[]): Promise<number>;

  // Agreement management operations
  getAgreementTemplates(): Promise<AgreementTemplate[]>;
  getAgreementTemplate(type: string): Promise<AgreementTemplate | undefined>;
  updateAgreementTemplate(type: string, content: string, variables: Record<string, any>, updatedBy: string, changeReason?: string): Promise<AgreementTemplate>;
  getAgreementVariables(): Promise<AgreementVariable[]>;
  getAgreementVariable(key: string): Promise<AgreementVariable | undefined>;
  updateAgreementVariable(key: string, value: string, updatedBy: string): Promise<AgreementVariable>;
  getProcessedAgreementContent(type: string): Promise<string>;
  getAgreementHistory(templateId: string): Promise<AgreementHistory[]>;
  // Promo code management
  getPromoCodes(filters?: { isActive?: boolean; discountType?: string; usageType?: string }): Promise<PromoCode[]>;
  getPromoCode(id: string): Promise<PromoCode | undefined>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  updatePromoCode(id: string, promoCode: Partial<InsertPromoCode>): Promise<PromoCode | undefined>;
  deletePromoCode(id: string): Promise<boolean>;
  
  // Promo code usage tracking
  recordPromoCodeUsage(usage: InsertPromoCodeUsage): Promise<PromoCodeUsage>;
  getPromoCodeUsages(promoCodeId?: string, userId?: string): Promise<PromoCodeUsage[]>;
  validatePromoCode(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; message: string; promoCode?: PromoCode }>;
  incrementPromoCodeUsage(promoCodeId: string): Promise<void>;
  getActivePromoCodesForPOS(): Promise<PromoCode[]>;
  
  // Push notification operations
  savePushSubscription(userId: string, subscription: any): Promise<void>;
  removePushSubscription(userId: string): Promise<void>;
  getPushSubscription(userId: string): Promise<{ userId: string; subscription: any } | null>;
  getPushSubscriptionsByRole(role: string): Promise<Array<{ userId: string; subscription: any }>>;
  getAllPushSubscriptions(): Promise<Array<{ userId: string; subscription: any }>>;
  getAllUsersWithSubscriptions(): Promise<any[]>;
  updateUserLastNotified(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(userData: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, userData: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // OTP operations
  async createOTP(contact: string, otp: string, purpose: string, contactType: 'email' | 'phone', expiresAt: Date): Promise<any> {
    // First cleanup expired OTPs for this contact to avoid conflicts
    await this.cleanupExpiredOTPs();
    
    // Invalidate any existing OTPs for this contact and purpose
    await db
      .update(otps)
      .set({ isUsed: true })
      .where(and(eq(otps.contact, contact), eq(otps.purpose, purpose), eq(otps.isUsed, false)));
    
    // Create new OTP
    const [newOtp] = await db
      .insert(otps)
      .values({
        contact,
        otp,
        purpose,
        contactType,
        expiresAt,
        isUsed: false,
      })
      .returning();
    
    console.log(`💾 Database: Created OTP for ${contact}, expires: ${expiresAt.toISOString()}`);
    return newOtp;
  }

  async getValidOTP(contact: string, purpose: string): Promise<any> {
    const [otp] = await db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.contact, contact),
          eq(otps.purpose, purpose),
          eq(otps.isUsed, false),
          gte(otps.expiresAt, new Date())
        )
      )
      .orderBy(desc(otps.createdAt))
      .limit(1);
    
    return otp;
  }

  async markOTPAsUsed(id: string): Promise<void> {
    await db
      .update(otps)
      .set({ isUsed: true })
      .where(eq(otps.id, id));
    
    console.log(`✅ Database: Marked OTP ${id} as used`);
  }

  async cleanupExpiredOTPs(): Promise<void> {
    const result = await db
      .delete(otps)
      .where(lt(otps.expiresAt, new Date()));
    
    console.log(`🧹 Database: Cleaned up expired OTPs`);
  }

  // ===============================================
  // OTP RATE LIMITING OPERATIONS (CRITICAL SECURITY FIX)
  // ===============================================

  async createOrUpdateOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string, ipAddress?: string, userAgent?: string): Promise<OtpRateLimit> {
    const now = new Date();
    
    // Try to find existing rate limit record
    const existing = await db
      .select()
      .from(otpRateLimits)
      .where(and(
        eq(otpRateLimits.contact, contact),
        eq(otpRateLimits.contactType, contactType),
        eq(otpRateLimits.purpose, purpose)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const current = existing[0];
      const [updated] = await db
        .update(otpRateLimits)
        .set({
          requestCount: current.requestCount + 1,
          lastRequestAt: now,
          ipAddress: ipAddress || current.ipAddress,
          userAgent: userAgent || current.userAgent,
          updatedAt: now
        })
        .where(eq(otpRateLimits.id, current.id))
        .returning();
      
      console.log(`📊 Rate limit updated for ${contact}: ${updated.requestCount} requests`);
      return updated;
    } else {
      // Create new rate limit record
      const [created] = await db
        .insert(otpRateLimits)
        .values({
          contact,
          contactType,
          purpose,
          ipAddress,
          userAgent,
          requestCount: 1,
          windowStart: now,
          lastRequestAt: now
        })
        .returning();
      
      console.log(`📊 Rate limit created for ${contact}: First request`);
      return created;
    }
  }

  async getOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string): Promise<OtpRateLimit | undefined> {
    const [rateLimit] = await db
      .select()
      .from(otpRateLimits)
      .where(and(
        eq(otpRateLimits.contact, contact),
        eq(otpRateLimits.contactType, contactType),
        eq(otpRateLimits.purpose, purpose)
      ))
      .limit(1);
    
    return rateLimit;
  }

  async checkOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string, ipAddress?: string): Promise<{ allowed: boolean; requestCount: number; maxRequests: number; windowMinutes: number; timeUntilReset: number; blockedUntil?: Date }> {
    // Get admin-configurable rate limit settings or use defaults
    const maxRequestsSetting = await this.getAdminSetting('otp_max_requests');
    const windowMinutesSetting = await this.getAdminSetting('otp_window_minutes');
    const maxRequests = maxRequestsSetting ? parseInt(maxRequestsSetting.value) : 5;
    const windowMinutes = windowMinutesSetting ? parseInt(windowMinutesSetting.value) : 5;
    
    const now = new Date();
    const windowMs = windowMinutes * 60 * 1000;
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Clean up expired rate limit windows first
    await this.cleanupExpiredOtpRateLimits();
    
    // Get current rate limit record
    const rateLimit = await this.getOtpRateLimit(contact, contactType, purpose);
    
    if (!rateLimit) {
      // No existing rate limit, allow request
      return {
        allowed: true,
        requestCount: 0,
        maxRequests,
        windowMinutes,
        timeUntilReset: 0
      };
    }
    
    // Check if contact is currently blocked
    if (rateLimit.blockedUntil && rateLimit.blockedUntil > now) {
      const timeUntilReset = rateLimit.blockedUntil.getTime() - now.getTime();
      console.log(`🚫 Contact ${contact} is blocked until ${rateLimit.blockedUntil.toISOString()}`);
      return {
        allowed: false,
        requestCount: rateLimit.requestCount,
        maxRequests,
        windowMinutes,
        timeUntilReset,
        blockedUntil: rateLimit.blockedUntil
      };
    }
    
    // Check if we need to reset the window
    if (rateLimit.windowStart < windowStart) {
      // Reset the window
      await db
        .update(otpRateLimits)
        .set({
          requestCount: 0,
          windowStart: now,
          blockedUntil: null, // Clear any blocks when resetting window
          updatedAt: now
        })
        .where(eq(otpRateLimits.id, rateLimit.id));
      
      console.log(`🔄 Rate limit window reset for ${contact}`);
      return {
        allowed: true,
        requestCount: 0,
        maxRequests,
        windowMinutes,
        timeUntilReset: 0
      };
    }
    
    // Check if within rate limits
    const allowed = rateLimit.requestCount < maxRequests;
    const oldestRequestTime = rateLimit.windowStart.getTime();
    const timeUntilReset = Math.max(0, (oldestRequestTime + windowMs) - now.getTime());
    
    console.log(`🔍 Rate limit check for ${contact}: ${rateLimit.requestCount}/${maxRequests} requests, allowed: ${allowed}`);
    
    return {
      allowed,
      requestCount: rateLimit.requestCount,
      maxRequests,
      windowMinutes,
      timeUntilReset
    };
  }

  async resetOtpRateLimit(contact: string, contactType: 'email' | 'phone', purpose: string): Promise<void> {
    await db
      .update(otpRateLimits)
      .set({
        requestCount: 0,
        windowStart: new Date(),
        blockedUntil: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(otpRateLimits.contact, contact),
        eq(otpRateLimits.contactType, contactType),
        eq(otpRateLimits.purpose, purpose)
      ));
    
    console.log(`🔄 Rate limit manually reset for ${contact}`);
  }

  async cleanupExpiredOtpRateLimits(): Promise<void> {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24 hours
    
    // Delete old rate limit records that are no longer relevant
    const deleteResult = await db
      .delete(otpRateLimits)
      .where(
        and(
          lt(otpRateLimits.windowStart, staleThreshold),
          or(
            isNull(otpRateLimits.blockedUntil),
            lt(otpRateLimits.blockedUntil, now)
          )
        )
      );
    
    console.log(`🧹 Cleaned up stale OTP rate limit records`);
  }

  async blockOtpContact(contact: string, contactType: 'email' | 'phone', purpose: string, blockDurationMinutes: number): Promise<void> {
    const now = new Date();
    const blockedUntil = new Date(now.getTime() + (blockDurationMinutes * 60 * 1000));
    
    // Get or create rate limit record
    let rateLimit = await this.getOtpRateLimit(contact, contactType, purpose);
    
    if (rateLimit) {
      // Update existing record
      await db
        .update(otpRateLimits)
        .set({
          blockedUntil,
          updatedAt: now
        })
        .where(eq(otpRateLimits.id, rateLimit.id));
    } else {
      // Create new blocked record
      await db
        .insert(otpRateLimits)
        .values({
          contact,
          contactType,
          purpose,
          requestCount: 99, // High count to indicate abuse
          windowStart: now,
          lastRequestAt: now,
          blockedUntil
        });
    }
    
    console.log(`🔒 Contact ${contact} blocked until ${blockedUntil.toISOString()} (${blockDurationMinutes} minutes)`);
  }

  // Vendor operations
  async createVendor(vendorData: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(vendorData).returning();
    return vendor;
  }

  async getVendor(id: string): Promise<any | undefined> {
    const [vendorWithUser] = await db
      .select({
        // Vendor fields
        id: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        description: vendors.description,
        category: vendors.category,
        address: vendors.address,
        city: vendors.city,
        state: vendors.state,
        pincode: vendors.pincode,
        gstNumber: vendors.gstNumber,
        license: vendors.license,
        status: vendors.status,
        rating: vendors.rating,
        totalOrders: vendors.totalOrders,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
        // User fields
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(vendors)
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.id, id));
    
    return vendorWithUser;
  }

  async getVendorByUserId(userId: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId));
    return vendor;
  }

  async updateVendorStatus(id: string, status: string): Promise<Vendor> {
    const [vendor] = await db
      .update(vendors)
      .set({ status, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return vendor;
  }

  async updateVendor(id: string, updateData: any): Promise<any> {
    // Separate user data from vendor data
    const userData = {
      firstName: updateData.firstName,
      lastName: updateData.lastName,
      email: updateData.email,
      phone: updateData.phone,
    };
    
    const vendorData = {
      businessName: updateData.businessName,
      description: updateData.description,
      category: updateData.category,
      address: updateData.address,
      city: updateData.city,
      state: updateData.state,
      pincode: updateData.pincode,
      gstNumber: updateData.gstNumber,
      license: updateData.license,
    };

    // Get the vendor to find the userId
    const existingVendor = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!existingVendor.length) {
      throw new Error("Vendor not found");
    }

    const userId = existingVendor[0].userId;

    // Update both user and vendor tables
    await db.transaction(async (tx) => {
      // Update user data
      await tx
        .update(users)
        .set({ 
          ...userData, 
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId));

      // Update vendor data
      await tx
        .update(vendors)
        .set({ 
          ...vendorData, 
          updatedAt: new Date() 
        })
        .where(eq(vendors.id, id));
    });

    // Return the updated vendor with user data
    return this.getVendor(id);
  }

  async getVendors(limit = 50, offset = 0): Promise<any[]> {
    const vendorsWithUsers = await db
      .select({
        // Vendor fields
        id: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        description: vendors.description,
        category: vendors.category,
        address: vendors.address,
        city: vendors.city,
        state: vendors.state,
        pincode: vendors.pincode,
        gstNumber: vendors.gstNumber,
        license: vendors.license,
        status: vendors.status,
        rating: vendors.rating,
        totalOrders: vendors.totalOrders,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
        // User fields
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(vendors)
      .leftJoin(users, eq(vendors.userId, users.id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(vendors.createdAt));
    
    return vendorsWithUsers;
  }

  // Product operations
  async createProduct(productData: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(productData).returning();
    return product;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductsByVendor(vendorId: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(and(eq(products.vendorId, vendorId), eq(products.isActive, true)))
      .orderBy(desc(products.createdAt));
  }

  async getProducts(limit = 50, offset = 0, categoryId?: string): Promise<Product[]> {
    const conditions = [eq(products.isActive, true)];
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    return await db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async updateProductImage(id: string, newImageUrl: string): Promise<Product> {
    // Get current product to schedule old image cleanup
    const currentProduct = await this.getProduct(id);
    if (currentProduct?.imageUrl) {
      await this.scheduleImageCleanup(currentProduct.imageUrl, 'product', id);
    }

    const [product] = await db
      .update(products)
      .set({ imageUrl: newImageUrl, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async updateProductStock(id: string, stock: number): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ stock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Category management methods
  async createCategory(category: { name: string; description?: string; imageUrl?: string; gstRate?: string; gstType?: string }): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateCategory(id: string, updates: { name?: string; description?: string; imageUrl?: string; isActive?: boolean; gstRate?: string; gstType?: string }): Promise<Category> {
    const [category] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async updateCategoryImage(id: string, newImageUrl: string): Promise<Category> {
    // Get current category to schedule old image cleanup
    const currentCategory = await this.getCategory(id);
    if (currentCategory?.imageUrl) {
      await this.scheduleImageCleanup(currentCategory.imageUrl, 'category', id);
    }

    const [category] = await db
      .update(categories)
      .set({ imageUrl: newImageUrl })
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Advertisement operations
  async getActiveAdvertisements(): Promise<Advertisement[]> {
    const result = await db
      .select()
      .from(advertisements)
      .where(eq(advertisements.isActive, true))
      .orderBy(asc(advertisements.displayOrder));
    return result;
  }

  async getAllAdvertisements(): Promise<Advertisement[]> {
    const result = await db
      .select()
      .from(advertisements)
      .orderBy(asc(advertisements.displayOrder));
    return result;
  }

  async createAdvertisement(ad: {
    title: string;
    description?: string;
    imageUrl: string;
    linkUrl?: string;
    displayOrder?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<Advertisement> {
    const [advertisement] = await db
      .insert(advertisements)
      .values({
        ...ad,
        startDate: ad.startDate ? new Date(ad.startDate) : null,
        endDate: ad.endDate ? new Date(ad.endDate) : null,
      })
      .returning();
    return advertisement;
  }

  async updateAdvertisement(id: string, updates: {
    title?: string;
    description?: string;
    imageUrl?: string;
    linkUrl?: string;
    displayOrder?: number;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  }): Promise<Advertisement> {
    const [advertisement] = await db
      .update(advertisements)
      .set({
        ...updates,
        startDate: updates.startDate ? new Date(updates.startDate) : undefined,
        endDate: updates.endDate ? new Date(updates.endDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(advertisements.id, id))
      .returning();
    return advertisement;
  }

  async deleteAdvertisement(id: string): Promise<void> {
    await db.delete(advertisements).where(eq(advertisements.id, id));
  }

  // Order operations
  async createOrder(orderData: any, items?: any[]): Promise<Order> {
    // Generate MK format order number with alphanumeric format
    const timestamp = Date.now();
    const orderNumber = this.generateMKOrderNumber(timestamp);
    
    const [order] = await db
      .insert(orders)
      .values({ ...orderData, orderNumber })
      .returning();

    // Insert order items if provided
    if (items && items.length > 0) {
      const orderItemsData = items.map(item => ({
        orderId: order.id,
        productId: item.productId || `product-${Date.now()}`, // Fallback product ID
        quantity: item.quantity || 1,
        price: (item.price || 0).toString(),
        total: ((item.quantity || 1) * (item.price || 0)).toString(),
      }));

      await db.insert(orderItems).values(orderItemsData);
    }

    return order;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async findSimilarOrders(userId: string, productIds: string[]): Promise<Order[]> {
    // Find orders from the same user that contain at least one of the specified products
    const ordersWithSimilarProducts = await db
      .select({
        order: orders,
        orderItem: orderItems
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.userId, userId),
          inArray(orderItems.productId, productIds)
        )
      )
      .orderBy(desc(orders.createdAt));

    // Group by order ID and calculate similarity score
    const orderGroups = new Map<string, { order: Order; matchingProducts: Set<string> }>();
    
    ordersWithSimilarProducts.forEach(({ order, orderItem }) => {
      if (!orderGroups.has(order.id)) {
        orderGroups.set(order.id, {
          order,
          matchingProducts: new Set()
        });
      }
      if (productIds.includes(orderItem.productId)) {
        orderGroups.get(order.id)!.matchingProducts.add(orderItem.productId);
      }
    });

    // Sort by similarity (number of matching products) and return orders
    const similarOrders = Array.from(orderGroups.values())
      .sort((a, b) => b.matchingProducts.size - a.matchingProducts.size)
      .map(group => group.order);

    return similarOrders;
  }

  async getOrderItems(orderId: string): Promise<any[]> {
    const orderItemsData = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        total: orderItems.total,
        product: products
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return orderItemsData;
  }

  async getOrders(limit: number = 50, offset: number = 0): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getOrdersByVendor(vendorId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.vendorId, vendorId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<any[]> {
    try {
      const ordersData = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          userId: orders.userId,
          vendorId: orders.vendorId,
          totalAmount: orders.totalAmount,
          deliveryFee: orders.deliveryFee,
          tax: orders.tax,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          paymentMethod: orders.paymentMethod,
          deliveryAddressId: orders.deliveryAddressId,
          deliveryPartnerId: orders.deliveryPartnerId,
          deliveryDate: orders.deliveryDate,
          specialInstructions: orders.specialInstructions,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          deliveredAt: orders.deliveredAt
        })
        .from(orders)
        .orderBy(desc(orders.createdAt));

      // Get customer and vendor info for each order
      const enrichedOrders = await Promise.all(
        ordersData.map(async (order) => {
          // Get customer info
          const customer = order.userId ? await this.getUser(order.userId) : null;
          
          // Get vendor info if vendorId exists
          let vendor = null;
          if (order.vendorId) {
            vendor = await this.getVendor(order.vendorId);
          }

          // Get delivery address if exists
          let deliveryAddress = 'Address not provided';
          if (order.deliveryAddressId) {
            try {
              const address = await db
                .select()
                .from(addresses)
                .where(eq(addresses.id, order.deliveryAddressId))
                .limit(1);
              
              if (address.length > 0) {
                const addr = address[0];
                deliveryAddress = `${addr.address}, ${addr.city}, ${addr.state} ${addr.pincode}`;
              }
            } catch (e) {
              console.log('Address fetch error:', e);
            }
          }

          // Get order items
          const orderItems = await this.getOrderItems(order.id);

          return {
            ...order,
            customerName: customer?.firstName || customer?.email || 'Unknown Customer',
            customerEmail: customer?.email || 'N/A',
            vendorName: vendor?.businessName || 'Direct Order',
            deliveryAddress,
            orderItems,
            items: orderItems.map(item => `${item.productName} x${item.quantity}`).join(', ')
          };
        })
      );

      return enrichedOrders;
    } catch (error) {
      console.error('Error in getAllOrders:', error);
      return [];
    }
  }

  async updateOrderStatus(id: string, status: string, additionalData?: any): Promise<Order> {
    const updateData: any = { 
      status, 
      updatedAt: new Date(),
      ...additionalData 
    };
    
    // Set delivery timestamps when order is marked as delivered
    if (status === 'delivered') {
      const now = new Date();
      updateData.deliveredAt = now;
      updateData.deliveryDate = now; // For the new delivery date tracking
    }
    
    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // Subscription operations
  async createSubscription(subscriptionData: InsertSubscription, items: Array<{ productId: string; quantity: number; price: number }>): Promise<Subscription> {
    // Calculate next delivery date based on frequency
    let nextDeliveryDate = null;
    const now = new Date();
    switch (subscriptionData.frequency) {
      case 'daily':
        nextDeliveryDate = new Date(now.setDate(now.getDate() + 1));
        break;
      case 'weekly':
        nextDeliveryDate = new Date(now.setDate(now.getDate() + 7));
        break;
      case 'monthly':
        nextDeliveryDate = new Date(now.setMonth(now.getMonth() + 1));
        break;
    }

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ...subscriptionData,
        nextDeliveryDate
      })
      .returning();

    // Insert subscription items
    const subscriptionItemsData = items.map(item => ({
      subscriptionId: subscription.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price.toString(),
    }));

    await db.insert(subscriptionItems).values(subscriptionItemsData);

    return subscription;
  }

  // Generate MK order number in alphanumeric format (e.g., "MK123456")
  private generateMKOrderNumber(timestamp: number): string {
    // Generate alphanumeric order number with MK prefix
    const lastSixDigits = timestamp.toString().slice(-6);
    return `MK${lastSixDigits}`;
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return subscription;
  }

  async getSubscriptionsByUser(userId: string): Promise<any[]> {
    const subscriptionsData = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));

    // Get subscription items for each subscription
    const subscriptionsWithItems = await Promise.all(
      subscriptionsData.map(async (subscription) => {
        const items = await db
          .select()
          .from(subscriptionItems)
          .where(eq(subscriptionItems.subscriptionId, subscription.id));
        
        return {
          ...subscription,
          items
        };
      })
    );

    return subscriptionsWithItems;
  }

  async getAllSubscriptionsWithDetails(): Promise<any[]> {
    const subscriptionsData = await db
      .select({
        subscription: subscriptions,
        customer: users,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.createdAt));

    // Get subscription items and product details for each subscription
    const subscriptionsWithDetails = await Promise.all(
      subscriptionsData.map(async ({ subscription, customer }) => {
        const items = await db
          .select({
            item: subscriptionItems,
            product: products,
          })
          .from(subscriptionItems)
          .leftJoin(products, eq(subscriptionItems.productId, products.id))
          .where(eq(subscriptionItems.subscriptionId, subscription.id));
        
        return {
          ...subscription,
          customer,
          items: items.map(({ item, product }) => ({
            ...item,
            product
          }))
        };
      })
    );

    return subscriptionsWithDetails;
  }

  async getSubscriptionsByVendor(vendorId: string): Promise<Subscription[]> {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.vendorId, vendorId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async updateSubscription(id: string, subscriptionData: Partial<Subscription>, items?: Array<{ productId: string; quantity: number; price: number }>): Promise<Subscription> {
    // Calculate next delivery date based on frequency
    let nextDeliveryDate = null;
    if (subscriptionData.frequency) {
      const now = new Date();
      switch (subscriptionData.frequency) {
        case 'daily':
          nextDeliveryDate = new Date(now.setDate(now.getDate() + 1));
          break;
        case 'weekly':
          nextDeliveryDate = new Date(now.setDate(now.getDate() + 7));
          break;
        case 'monthly':
          nextDeliveryDate = new Date(now.setMonth(now.getMonth() + 1));
          break;
      }
    }

    const [subscription] = await db
      .update(subscriptions)
      .set({ 
        ...subscriptionData, 
        nextDeliveryDate,
        updatedAt: new Date() 
      })
      .where(eq(subscriptions.id, id))
      .returning();

    // Update subscription items if provided
    if (items && items.length > 0) {
      // Delete existing items
      await db.delete(subscriptionItems).where(eq(subscriptionItems.subscriptionId, id));
      
      // Insert new items
      const subscriptionItemsData = items.map(item => ({
        subscriptionId: id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price.toString(),
      }));

      await db.insert(subscriptionItems).values(subscriptionItemsData);
    }

    return subscription;
  }

  async updateSubscriptionStatus(id: string, status: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  // Address operations
  async createAddress(addressData: Omit<Address, 'id' | 'createdAt'>): Promise<Address> {
    const [address] = await db.insert(addresses).values(addressData).returning();
    return address;
  }

  async getAddressesByUser(userId: string): Promise<Address[]> {
    return await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  }

  async updateAddress(id: string, updates: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>): Promise<Address> {
    const [address] = await db
      .update(addresses)
      .set(updates)
      .where(eq(addresses.id, id))
      .returning();
    return address;
  }

  async deleteAddress(id: string): Promise<void> {
    await db.delete(addresses).where(eq(addresses.id, id));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.name));
  }

  // Delivery Partner operations
  async getDeliveryPartnerByUserId(userId: string): Promise<any> {
    const [partner] = await db
      .select()
      .from(deliveryPartners)
      .leftJoin(users, eq(deliveryPartners.userId, users.id))
      .where(eq(deliveryPartners.userId, userId));
    
    return partner ? { ...partner.delivery_partners, user: partner.users } : null;
  }

  async getDeliveryPartnerStats(partnerId: string): Promise<any> {
    // Get today's date range (start and end of today in local timezone)
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Delivered orders TODAY only (must have deliveredAt timestamp from today)
    const [deliveredOrdersToday] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        eq(orders.deliveryPartnerId, partnerId), 
        eq(orders.status, "delivered"),
        isNotNull(orders.deliveredAt), // Only count orders that actually have a delivered timestamp
        gte(orders.deliveredAt, startOfToday),
        lt(orders.deliveredAt, endOfToday)
      ));

    // Total lifetime earnings
    const [totalEarnings] = await db
      .select({ total: sum(orders.deliveryFee) })
      .from(orders)
      .where(and(
        eq(orders.deliveryPartnerId, partnerId), 
        eq(orders.status, "delivered")
      ));

    // Active orders (out for delivery or ready for pickup)
    const [activeOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        eq(orders.deliveryPartnerId, partnerId),
        or(
          eq(orders.status, "preparing"),
          eq(orders.status, "ready"),
          eq(orders.status, "out_for_delivery")
        )
      ));

    // Total lifetime delivered orders for reference
    const [lifetimeDelivered] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        eq(orders.deliveryPartnerId, partnerId), 
        eq(orders.status, "delivered")
      ));

    return {
      deliveredOrders: deliveredOrdersToday.count, // TODAY's deliveries
      totalEarnings: Number(totalEarnings?.total || 0),
      activeOrders: activeOrders.count,
      lifetimeDelivered: lifetimeDelivered.count, // Lifetime total for reference
    };
  }

  async getDeliveryPartnerOrders(partnerId: string): Promise<any[]> {
    const ordersWithDetails = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        deliveryFee: orders.deliveryFee,
        customerName: users.firstName,
        customerPhone: users.phone,
        customerEmail: users.email,
        address: addresses.address,
        city: addresses.city,
        state: addresses.state,
        zipCode: addresses.pincode, // Fix: use pincode instead of zipCode
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        deliveredAt: orders.deliveredAt,
        deliveryDate: orders.deliveryDate,
        specialInstructions: orders.specialInstructions,
        vendorId: orders.vendorId,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(addresses, eq(orders.deliveryAddressId, addresses.id))
      .where(eq(orders.deliveryPartnerId, partnerId))
      .orderBy(desc(orders.createdAt));

    // Fetch order items separately for each order
    const ordersWithItems = await Promise.all(
      ordersWithDetails.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            price: orderItems.price,
            total: orderItems.total,
            productName: products.name,
            productImage: products.imageUrl,
            category: categories.name,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(eq(orderItems.orderId, order.id));

        return {
          ...order,
          items: items, // Add the fetched items to the order
        };
      })
    );

    return ordersWithItems;
  }

  async assignOrderToDeliveryPartner(orderId: string, partnerId: string, deliverySequence?: number): Promise<any> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ 
        deliveryPartnerId: partnerId,
        deliverySequence: deliverySequence || 1,
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();

    return updatedOrder;
  }

  async getAvailableDeliveryPartners(): Promise<any[]> {
    const partners = await db
      .select({
        id: deliveryPartners.id,
        userId: deliveryPartners.userId,
        name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        email: users.email,
        phone: users.phone,
        vehicleType: deliveryPartners.vehicleType,
        vehicleNumber: deliveryPartners.vehicleNumber,
        isOnline: deliveryPartners.isOnline,
        currentLocation: deliveryPartners.currentLocation,
        rating: deliveryPartners.rating,
        totalDeliveries: deliveryPartners.totalDeliveries,
        activeOrders: sql<number>`(
          SELECT COUNT(*) FROM ${orders} 
          WHERE ${orders.deliveryPartnerId} = ${deliveryPartners.id} 
          AND ${orders.status} IN ('preparing', 'ready', 'out_for_delivery')
        )`
      })
      .from(deliveryPartners)
      .leftJoin(users, eq(deliveryPartners.userId, users.id))
      .where(eq(deliveryPartners.status, "active"));

    return partners.map(partner => ({
      ...partner,
      activeOrders: Number(partner.activeOrders || 0),
      rating: Number(partner.rating || 0),
      totalDeliveries: Number(partner.totalDeliveries || 0)
    }));
  }

  async getDeliveryPartnerActiveOrders(partnerId: string): Promise<any[]> {
    const activeOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        deliverySequence: orders.deliverySequence,
        totalAmount: orders.totalAmount,
        customerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        address: addresses.address,
        city: addresses.city,
        createdAt: orders.createdAt,
        assignedAt: orders.assignedAt
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(addresses, eq(orders.deliveryAddressId, addresses.id))
      .where(and(
        eq(orders.deliveryPartnerId, partnerId),
        sql`${orders.status} IN ('preparing', 'ready', 'out_for_delivery')`
      ))
      .orderBy(asc(orders.deliverySequence), asc(orders.assignedAt));

    return activeOrders;
  }



  async updateDeliveryPartnerProfile(partnerId: string, profileData: any): Promise<any> {
    try {
      const result = await db
        .update(deliveryPartners)
        .set({
          vehicleType: profileData.vehicleType || deliveryPartners.vehicleType,
          vehicleNumber: profileData.vehicleNumber || deliveryPartners.vehicleNumber,
          licenseNumber: profileData.licenseNumber || deliveryPartners.licenseNumber,
          aadharNumber: profileData.aadharNumber || deliveryPartners.aadharNumber,
          panNumber: profileData.panNumber || deliveryPartners.panNumber,
          bankAccount: profileData.bankAccount || deliveryPartners.bankAccount,
          ifscCode: profileData.ifscCode || deliveryPartners.ifscCode,
          updatedAt: new Date()
        })
        .where(eq(deliveryPartners.id, partnerId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating delivery partner profile:", error);
      throw error;
    }
  }

  async toggleDeliveryPartnerOnlineStatus(partnerId: string, isOnline: boolean): Promise<any> {
    const [updated] = await db
      .update(deliveryPartners)
      .set({ 
        isOnline,
        updatedAt: new Date()
      })
      .where(eq(deliveryPartners.id, partnerId))
      .returning();

    return updated;
  }

  // Analytics
  async getVendorStats(vendorId: string): Promise<any> {
    const [totalOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.vendorId, vendorId));

    const [totalProducts] = await db
      .select({ count: count() })
      .from(products)
      .where(and(eq(products.vendorId, vendorId), eq(products.isActive, true)));

    const [activeSubscriptions] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.vendorId, vendorId), eq(subscriptions.status, "active")));

    return {
      totalOrders: totalOrders.count,
      totalProducts: totalProducts.count,
      activeSubscriptions: activeSubscriptions.count,
    };
  }

  async getAdminStats(): Promise<any> {
    const [totalVendors] = await db.select({ count: count() }).from(vendors);
    const [totalUsers] = await db.select({ count: count() }).from(users).where(eq(users.role, "customer"));
    const [totalOrders] = await db.select({ count: count() }).from(orders);
    const [activeSubscriptions] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active"));
    
    // Get total revenue from online orders (all orders except cancelled)
    const [totalRevenue] = await db
      .select({ total: sum(orders.totalAmount) })
      .from(orders)
      .where(ne(orders.status, "cancelled"));
    
    // Get total revenue from POS sales
    const [posRevenue] = await db
      .select({ total: sum(posSales.totalAmount) })
      .from(posSales);
      
    // Get POS sales count
    const [totalPosSales] = await db.select({ count: count() }).from(posSales);
    
    // Get recent orders count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [recentOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        gte(orders.createdAt, sevenDaysAgo),
        ne(orders.status, "cancelled")
      ));

    const onlineRevenue = Number(totalRevenue?.total || 0);
    const posRevenueTotal = Number(posRevenue?.total || 0);

    return {
      totalVendors: totalVendors.count,
      totalUsers: totalUsers.count,
      totalOrders: totalOrders.count + totalPosSales.count,
      onlineOrders: totalOrders.count,
      posOrders: totalPosSales.count,
      activeSubscriptions: activeSubscriptions.count,
      totalRevenue: onlineRevenue + posRevenueTotal,
      onlineRevenue: onlineRevenue,
      posRevenue: posRevenueTotal,
      recentOrders: recentOrders.count,
    };
  }

  async getGrowthMetrics(): Promise<any> {
    try {
      // Get current totals (all time)
      const [totalVendors] = await db.select({ count: count() }).from(vendors);
      const [totalUsers] = await db.select({ count: count() }).from(users).where(eq(users.role, "customer"));
      const [totalOrders] = await db.select({ count: count() }).from(orders);
      const [totalPosOrders] = await db.select({ count: count() }).from(posSales);
      const [totalSubscriptions] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active"));

      // Get last month's totals (everything created up to last month end)
      const now = new Date();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [lastMonthVendors] = await db.select({ count: count() }).from(vendors)
        .where(lte(vendors.createdAt, lastMonthEnd));
      
      const [lastMonthUsers] = await db.select({ count: count() }).from(users)
        .where(and(eq(users.role, "customer"), lte(users.createdAt, lastMonthEnd)));
      
      const [lastMonthOrders] = await db.select({ count: count() }).from(orders)
        .where(lte(orders.createdAt, lastMonthEnd));
      
      const [lastMonthPosOrders] = await db.select({ count: count() }).from(posSales)
        .where(lte(posSales.createdAt, lastMonthEnd));

      const [lastMonthSubscriptions] = await db.select({ count: count() }).from(subscriptions)
        .where(and(eq(subscriptions.status, "active"), lte(subscriptions.createdAt, lastMonthEnd)));

      // Calculate growth percentages based on total vs last month total
      const calculateGrowth = (current: number, lastMonth: number): number => {
        if (lastMonth === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - lastMonth) / lastMonth) * 100);
      };

      const currentTotalOrders = totalOrders.count + totalPosOrders.count;
      const lastMonthTotalOrders = lastMonthOrders.count + lastMonthPosOrders.count;

      return {
        vendorGrowth: calculateGrowth(totalVendors.count, lastMonthVendors.count),
        userGrowth: calculateGrowth(totalUsers.count, lastMonthUsers.count),
        orderGrowth: calculateGrowth(currentTotalOrders, lastMonthTotalOrders),
        subscriptionGrowth: calculateGrowth(totalSubscriptions.count, lastMonthSubscriptions.count),
        currentTotal: {
          vendors: totalVendors.count,
          users: totalUsers.count,
          orders: currentTotalOrders,
          subscriptions: totalSubscriptions.count
        },
        lastMonthTotal: {
          vendors: lastMonthVendors.count,
          users: lastMonthUsers.count,
          orders: lastMonthTotalOrders,
          subscriptions: lastMonthSubscriptions.count
        }
      };
    } catch (error) {
      console.error("Error calculating growth metrics:", error);
      return {
        vendorGrowth: 0,
        userGrowth: 0,
        orderGrowth: 0,
        subscriptionGrowth: 0,
        currentTotal: { vendors: 0, users: 0, orders: 0, subscriptions: 0 },
        lastMonthTotal: { vendors: 0, users: 0, orders: 0, subscriptions: 0 }
      };
    }
  }

  async getPerformanceMetrics(): Promise<any> {
    try {
      // Calculate Order Completion Rate
      const [totalOrders] = await db.select({ count: count() }).from(orders);
      const [deliveredOrders] = await db.select({ count: count() }).from(orders)
        .where(or(eq(orders.status, "delivered"), eq(orders.status, "completed")));
      
      const completionRate = totalOrders.count > 0 
        ? Math.round((deliveredOrders.count / totalOrders.count) * 100)
        : 0;

      // Calculate Average Customer Satisfaction (from order reviews)
      const [avgRating] = await db.select({ 
        avg: sql<number>`COALESCE(AVG(CAST(${orderReviews.overallRating} AS DECIMAL)), 0)`
      }).from(orderReviews);
      
      const customerSatisfaction = Number(avgRating?.avg || 0).toFixed(1);

      // Calculate Average Delivery Time (from delivered orders)
      const deliveredOrdersWithTimes = await db
        .select({
          createdAt: orders.createdAt,
          deliveredAt: orders.updatedAt
        })
        .from(orders)
        .where(eq(orders.status, "delivered"))
        .limit(50); // Last 50 delivered orders

      let avgDeliveryMinutes = 24; // Default fallback
      if (deliveredOrdersWithTimes.length > 0) {
        const totalMinutes = deliveredOrdersWithTimes.reduce((sum, order) => {
          if (order.createdAt && order.deliveredAt) {
            const diffMs = order.deliveredAt.getTime() - order.createdAt.getTime();
            return sum + (diffMs / (1000 * 60)); // Convert to minutes
          }
          return sum;
        }, 0);
        avgDeliveryMinutes = Math.round(totalMinutes / deliveredOrdersWithTimes.length);
      }

      // Calculate Vendor Response Rate (vendors with active products)
      const [totalVendors] = await db.select({ count: count() }).from(vendors);
      const [activeVendors] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${products.vendorId})` })
        .from(products)
        .where(eq(products.isActive, true));
      
      const vendorResponseRate = totalVendors.count > 0 
        ? Math.round((Number(activeVendors.count) / totalVendors.count) * 100)
        : 0;

      // Calculate Weekly Revenue Growth
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // This week's revenue
      const [thisWeekRevenue] = await db
        .select({ total: sum(orders.totalAmount) })
        .from(orders)
        .where(and(
          gte(orders.createdAt, sevenDaysAgo),
          or(
            eq(orders.paymentStatus, "paid"),
            and(eq(orders.status, "delivered"), eq(orders.paymentStatus, "pending"))
          )
        ));

      const [thisWeekPosRevenue] = await db
        .select({ total: sum(posSales.totalAmount) })
        .from(posSales)
        .where(gte(posSales.createdAt, sevenDaysAgo));

      // Last week's revenue
      const [lastWeekRevenue] = await db
        .select({ total: sum(orders.totalAmount) })
        .from(orders)
        .where(and(
          gte(orders.createdAt, fourteenDaysAgo),
          lte(orders.createdAt, sevenDaysAgo),
          or(
            eq(orders.paymentStatus, "paid"),
            and(eq(orders.status, "delivered"), eq(orders.paymentStatus, "pending"))
          )
        ));

      const [lastWeekPosRevenue] = await db
        .select({ total: sum(posSales.totalAmount) })
        .from(posSales)
        .where(and(
          gte(posSales.createdAt, fourteenDaysAgo),
          lte(posSales.createdAt, sevenDaysAgo)
        ));

      const thisWeekTotal = Number(thisWeekRevenue?.total || 0) + Number(thisWeekPosRevenue?.total || 0);
      const lastWeekTotal = Number(lastWeekRevenue?.total || 0) + Number(lastWeekPosRevenue?.total || 0);
      
      const weeklyGrowth = lastWeekTotal > 0 
        ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
        : (thisWeekTotal > 0 ? 100 : 0);

      return {
        orderCompletionRate: completionRate,
        customerSatisfaction: customerSatisfaction,
        averageDeliveryMinutes: avgDeliveryMinutes,
        vendorResponseRate: vendorResponseRate,
        weeklyGrowth: weeklyGrowth,
        thisWeekRevenue: thisWeekTotal,
        lastWeekRevenue: lastWeekTotal
      };
    } catch (error) {
      console.error("Error calculating performance metrics:", error);
      return {
        orderCompletionRate: 0,
        customerSatisfaction: "0.0",
        averageDeliveryMinutes: 24,
        vendorResponseRate: 0,
        weeklyGrowth: 0,
        thisWeekRevenue: 0,
        lastWeekRevenue: 0
      };
    }
  }

  async getUsersWithSpending(): Promise<any[]> {
    // Get all users first
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // Calculate spending and order info for each user, including delivery partner data
    const processedUsers = await Promise.all(
      allUsers.map(async (user) => {
        const [spentResult] = await db
          .select({ totalAmount: sum(orders.totalAmount) })
          .from(orders)
          .where(eq(orders.userId, user.id));
        
        const [ordersResult] = await db
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.userId, user.id));
        
        const [subscriptionsResult] = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.userId, user.id));

        // Get delivery partner data if user is delivery partner
        let deliveryPartnerData = {};
        if (user.role === 'delivery') {
          const [deliveryPartner] = await db
            .select({
              vehicleType: deliveryPartners.vehicleType,
              vehicleNumber: deliveryPartners.vehicleNumber,
              licenseNumber: deliveryPartners.licenseNumber
            })
            .from(deliveryPartners)
            .where(eq(deliveryPartners.userId, user.id));
          
          if (deliveryPartner) {
            deliveryPartnerData = {
              vehicleType: deliveryPartner.vehicleType,
              vehicleNumber: deliveryPartner.vehicleNumber,
              licenseNumber: deliveryPartner.licenseNumber
            };
          }
        }

        return {
          ...user,
          ...deliveryPartnerData,
          totalSpent: Number(spentResult?.totalAmount || 0),
          totalOrders: Number(ordersResult?.count || 0),
          totalSubscriptions: Number(subscriptionsResult?.count || 0),
        };
      })
    );

    return processedUsers;
  }

  // Update delivery partner location
  async updateDeliveryPartnerLocation(userId: string, locationData: {
    latitude: number;
    longitude: number;
    currentLocation: string;
    lastLocationUpdate: Date;
  }) {
    try {
      const result = await db
        .update(deliveryPartners)
        .set({
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
          currentLocation: locationData.currentLocation,
          lastLocationUpdate: locationData.lastLocationUpdate,
          updatedAt: new Date()
        })
        .where(eq(deliveryPartners.userId, userId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating delivery partner location:", error);
      throw error;
    }
  }

  // Update delivery partner online status
  async updateDeliveryPartnerStatus(userId: string, isOnline: boolean) {
    try {
      const result = await db
        .update(deliveryPartners)
        .set({
          isOnline,
          updatedAt: new Date()
        })
        .where(eq(deliveryPartners.userId, userId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating delivery partner status:", error);
      throw error;
    }
  }

  // Image cleanup functionality - DISABLED FOR TESTING
  async scheduleImageCleanup(imageUrl: string, entityType: string, entityId: string) {
    // DISABLED: Automatic image cleanup disabled for testing
    console.log(`Image cleanup disabled for testing: ${imageUrl} (${entityType}:${entityId})`);
    return;
    
    // Original code disabled:
    // try {
    //   const cleanupDate = new Date();
    //   cleanupDate.setDate(cleanupDate.getDate() + 2); // Cleanup after 2 days
    //   
    //   await db.insert(imageCleanup).values({
    //     imageUrl,
    //     entityType,
    //     entityId,
    //     scheduledDeletion: cleanupDate,
    //   });
    // } catch (error) {
    //   console.error("Error scheduling image cleanup:", error);
    //   // Don't throw error as this shouldn't block the main operation
    // }
  }

  async cleanupExpiredImages() {
    try {
      const now = new Date();
      const expiredImages = await db
        .select()
        .from(imageCleanup)
        .where(sql`${imageCleanup.scheduledDeletion} <= ${now}`);
      
      if (expiredImages.length > 0) {
        // Remove expired cleanup records
        await db
          .delete(imageCleanup)
          .where(sql`${imageCleanup.scheduledDeletion} <= ${now}`);
        
        console.log(`[Image Cleanup] Removed ${expiredImages.length} expired image cleanup records`);
      }
      
      return expiredImages.length;
    } catch (error) {
      console.error("Error during image cleanup:", error);
      throw error;
    }
  }

  async getScheduledCleanups() {
    try {
      return await db.select().from(imageCleanup);
    } catch (error) {
      console.error("Error fetching scheduled cleanups:", error);
      return [];
    }
  }

  // Real-time analytics methods
  async getRevenueData() {
    try {
      // Simplified approach - get totals for current year
      const currentYear = new Date().getFullYear();
      
      // Get total revenue and orders from both sources (including delivered orders with pending payment)
      const [orderStats] = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), '0')`,
          totalOrders: sql<number>`COUNT(*)`
        })
        .from(orders)
        .where(or(
          eq(orders.paymentStatus, "paid"),
          and(eq(orders.status, "delivered"), eq(orders.paymentStatus, "pending")),
          and(ne(orders.status, "cancelled"), eq(orders.paymentStatus, "pending"))
        ));

      const [posStats] = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${posSales.totalAmount}), '0')`,
          totalOrders: sql<number>`COUNT(*)`
        })
        .from(posSales);

      // Return current month data with combined totals
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
      
      const onlineRevenue = Number(orderStats?.totalRevenue || 0);
      const posRevenue = Number(posStats?.totalRevenue || 0);
      const onlineOrders = Number(orderStats?.totalOrders || 0);
      const posOrders = Number(posStats?.totalOrders || 0);

      return [{
        month: currentMonth,
        revenue: onlineRevenue + posRevenue,
        orders: onlineOrders + posOrders,
        onlineRevenue: onlineRevenue,
        posRevenue: posRevenue,
        onlineOrders: onlineOrders,
        posOrders: posOrders
      }];
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      return [];
    }
  }

  async getVendorPerformance() {
    try {
      // Use the working SQL from the manual test
      const vendorPerformanceData = await db.execute(sql`
        SELECT 
          v.business_name as vendor_name,
          COALESCE(pos_revenue, 0) as pos_sales,
          COALESCE(delivery_revenue, 0) as delivery_sales,
          (COALESCE(pos_revenue, 0) + COALESCE(delivery_revenue, 0)) as total_revenue,
          COALESCE(pos_orders, 0) + COALESCE(delivery_orders, 0) as total_orders
        FROM vendors v
        LEFT JOIN (
          SELECT 
            p.vendor_id,
            SUM(psi.total_price) as pos_revenue,
            COUNT(DISTINCT ps.id) as pos_orders
          FROM pos_sale_items psi
          JOIN products p ON psi.product_id = p.id
          JOIN pos_sales ps ON psi.pos_sale_id = ps.id
          GROUP BY p.vendor_id
        ) pos_cat ON v.id = pos_cat.vendor_id
        LEFT JOIN (
          SELECT 
            p.vendor_id,
            SUM(oi.quantity * oi.price) as delivery_revenue,
            COUNT(DISTINCT o.id) as delivery_orders
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          JOIN products p ON oi.product_id = p.id
          WHERE o.payment_status = 'paid'
          GROUP BY p.vendor_id
        ) delivery_cat ON v.id = delivery_cat.vendor_id
        WHERE (COALESCE(pos_revenue, 0) + COALESCE(delivery_revenue, 0)) > 0
        ORDER BY total_revenue DESC
      `);

      return vendorPerformanceData.rows.map((row: any) => ({
        vendor: row.vendor_name,
        revenue: Number(row.total_revenue || 0),
        orders: Number(row.total_orders || 0),
        rating: 4.5
      }));
    } catch (error) {
      console.error("Error fetching vendor performance:", error);
      return [];
    }
  }

  // REAL notification system methods
  async getUsers() {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      return [];
    }
  }

  async createNotification(notification: {
    userId: string;
    title: string;
    body: string;
    type: string;
    status: string;
    metadata?: any;
  }) {
    try {
      const [result] = await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: notification.userId,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        status: notification.status,
        metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
        createdAt: new Date(),
        readAt: null
      }).returning();
      return result.id;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async getUserNotifications(userId: string) {
    try {
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async getSalesAnalytics(dateRange: string = "last_30_days") {
    try {
      let dateFilter;
      const now = new Date();
      
      switch (dateRange) {
        case "last_7_days":
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last_90_days":
          dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get delivery order sales by date (including all revenue-generating orders)
      const deliverySalesData = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          deliverySales: sum(orders.totalAmount),
          deliveryOrders: count()
        })
        .from(orders)
        .where(and(
          gte(orders.createdAt, dateFilter),
          or(
            eq(orders.paymentStatus, "paid"),
            and(eq(orders.status, "delivered"), eq(orders.paymentStatus, "pending")),
            and(ne(orders.status, "cancelled"), eq(orders.paymentStatus, "pending"))
          )
        ))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      // Get POS sales by date
      const posSalesData = await db
        .select({
          date: sql<string>`DATE(${posSales.createdAt})`,
          posSales: sum(posSales.totalAmount),
          posOrders: count()
        })
        .from(posSales)
        .where(gte(posSales.createdAt, dateFilter))
        .groupBy(sql`DATE(${posSales.createdAt})`)
        .orderBy(sql`DATE(${posSales.createdAt})`);

      // Combine and merge data by date
      const salesMap = new Map();

      deliverySalesData.forEach(row => {
        salesMap.set(row.date, {
          date: row.date,
          deliverySales: Number(row.deliverySales || 0),
          deliveryOrders: Number(row.deliveryOrders || 0),
          posSales: 0,
          posOrders: 0
        });
      });

      posSalesData.forEach(row => {
        const existing = salesMap.get(row.date) || {
          date: row.date,
          deliverySales: 0,
          deliveryOrders: 0,
          posSales: 0,
          posOrders: 0
        };
        existing.posSales = Number(row.posSales || 0);
        existing.posOrders = Number(row.posOrders || 0);
        salesMap.set(row.date, existing);
      });

      return Array.from(salesMap.values())
        .map(row => ({
          date: row.date,
          revenue: row.deliverySales + row.posSales,
          orders: row.deliveryOrders + row.posOrders,
          deliveryRevenue: row.deliverySales,
          posRevenue: row.posSales
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error("Error fetching sales analytics:", error);
      return [];
    }
  }

  async getVendorAnalytics(vendorId: string, dateRange: string = "last_30_days") {
    try {
      let dateFilter;
      const now = new Date();
      
      switch (dateRange) {
        case "last_7_days":
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last_90_days":
          dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get vendor's products
      const vendorProducts = await db
        .select()
        .from(products)
        .where(eq(products.vendorId, vendorId));

      // Get orders for vendor's products
      const vendorOrders = await db
        .select({
          totalRevenue: sum(orders.totalAmount),
          totalOrders: count(),
          avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
        })
        .from(orders)
        .where(and(
          eq(orders.vendorId, vendorId),
          gte(orders.createdAt, dateFilter),
          eq(orders.paymentStatus, "paid")
        ));

      return {
        overview: {
          totalRevenue: Number(vendorOrders[0]?.totalRevenue || 0),
          totalOrders: Number(vendorOrders[0]?.totalOrders || 0),
          avgOrderValue: Number(vendorOrders[0]?.avgOrderValue || 0),
          productCount: vendorProducts.length,
          rating: 4.7 // Mock for now
        },
        products: vendorProducts
      };
    } catch (error) {
      console.error("Error fetching vendor analytics:", error);
      return null;
    }
  }

  async getCategoryPerformance() {
    try {
      // Get POS sales by category
      const posCategorySales = await db
        .select({
          categoryId: products.categoryId,
          posRevenue: sum(posSaleItems.totalPrice)
        })
        .from(posSaleItems)
        .leftJoin(products, eq(posSaleItems.productId, products.id))
        .where(isNotNull(products.categoryId))
        .groupBy(products.categoryId);

      // Get delivery sales by category
      const deliveryCategorySales = await db
        .select({
          categoryId: products.categoryId,
          deliveryRevenue: sum(sql<number>`${orderItems.quantity} * ${orderItems.price}`)
        })
        .from(orderItems)
        .leftJoin(orders, eq(orderItems.orderId, orders.id))
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(and(
          eq(orders.paymentStatus, "paid"),
          isNotNull(products.categoryId)
        ))
        .groupBy(products.categoryId);

      // Create sales maps
      const posMap = new Map();
      posCategorySales.forEach(sale => {
        posMap.set(sale.categoryId, Number(sale.posRevenue || 0));
      });

      const deliveryMap = new Map();
      deliveryCategorySales.forEach(sale => {
        deliveryMap.set(sale.categoryId, Number(sale.deliveryRevenue || 0));
      });

      // Get all categories with product counts
      const categoryStats = await db
        .select({
          categoryId: categories.id,
          category: categories.name,
          products: count(products.id)
        })
        .from(categories)
        .leftJoin(products, eq(categories.id, products.categoryId))
        .groupBy(categories.id, categories.name);

      return categoryStats.map(row => {
        const posRevenue = posMap.get(row.categoryId) || 0;
        const deliveryRevenue = deliveryMap.get(row.categoryId) || 0;
        const totalSales = posRevenue + deliveryRevenue;

        return {
          category: row.category,
          sales: totalSales,
          products: Number(row.products || 0),
          posRevenue,
          deliveryRevenue
        };
      });
    } catch (error) {
      console.error("Error fetching category performance:", error);
      return [];
    }
  }

  async getRecentActivities(): Promise<any[]> {
    try {
      const activities: any[] = [];

      // Get recent vendor approvals (last 30 days)
      const recentVendors = await db
        .select({
          id: vendors.id,
          businessName: vendors.businessName,
          status: vendors.status,
          createdAt: vendors.createdAt,
          updatedAt: vendors.updatedAt
        })
        .from(vendors)
        .where(and(
          eq(vendors.status, 'approved'),
          gte(vendors.updatedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(vendors.updatedAt))
        .limit(5);

      recentVendors.forEach(vendor => {
        activities.push({
          id: `vendor-${vendor.id}`,
          type: 'vendor_approved',
          title: 'New vendor approved',
          description: `${vendor.businessName} joined platform`,
          icon: 'UserCheck',
          color: 'green',
          timestamp: vendor.updatedAt,
          link: '/admin/vendors',
          linkText: 'View Vendors'
        });
      });

      // Get recent products added (last 30 days) 
      const recentProducts = await db
        .select({
          id: products.id,
          name: products.name,
          vendorName: vendors.businessName,
          createdAt: products.createdAt
        })
        .from(products)
        .leftJoin(vendors, eq(products.vendorId, vendors.id))
        .where(gte(products.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        .orderBy(desc(products.createdAt))
        .limit(5);

      recentProducts.forEach(product => {
        activities.push({
          id: `product-${product.id}`,
          type: 'product_added',
          title: 'New product added',
          description: `${product.name} by ${product.vendorName || 'Unknown Vendor'}`,
          icon: 'Package',
          color: 'blue',
          timestamp: product.createdAt,
          link: '/admin/products',
          linkText: 'View Products'
        });
      });

      // Get pending vendor approvals for alerts
      const [pendingVendors] = await db
        .select({ count: count() })
        .from(vendors)
        .where(eq(vendors.status, 'pending'));

      if (pendingVendors.count > 0) {
        activities.push({
          id: 'pending-vendors',
          type: 'system_alert',
          title: 'Vendor approval required',
          description: `${pendingVendors.count} vendor${pendingVendors.count > 1 ? 's' : ''} awaiting approval`,
          icon: 'Bell',
          color: 'yellow',
          timestamp: new Date(),
          link: '/admin/vendors',
          linkText: 'Review Vendors'
        });
      }

      // Get high order volume alert (more than 10 orders today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [todayOrders] = await db
        .select({ count: count() })
        .from(orders)
        .where(gte(orders.createdAt, today));

      if (todayOrders.count > 10) {
        activities.push({
          id: 'high-order-volume',
          type: 'system_alert',
          title: 'High order volume detected',
          description: `${todayOrders.count} orders received today`,
          icon: 'Bell',
          color: 'yellow',
          timestamp: new Date(),
          link: '/admin/orders',
          linkText: 'View Orders'
        });
      }

      // Get current low stock alerts from raw materials (POS system) - real-time check
      const lowStockItems = await db
        .select({
          id: rawMaterials.id,
          name: rawMaterials.name,
          currentStock: rawMaterials.currentStock,
          minimumStock: rawMaterials.minimumStock,
          unit: rawMaterials.unit,
          updatedAt: rawMaterials.updatedAt,
          isActive: rawMaterials.isActive
        })
        .from(rawMaterials)
        .where(
          and(
            eq(rawMaterials.isActive, true),
            sql`${rawMaterials.currentStock} <= ${rawMaterials.minimumStock}`
          )
        )
        .orderBy(desc(rawMaterials.updatedAt))
        .limit(5);

      // Only show items that are currently low stock (real-time validation)
      lowStockItems.forEach(item => {
        if (item.currentStock <= item.minimumStock && item.isActive) {
          activities.push({
            id: `low-stock-${item.id}`,
            type: 'low_stock_alert',
            title: 'Low stock alert',
            description: `${item.name}: ${item.currentStock}${item.unit} remaining (min: ${item.minimumStock}${item.unit})`,
            icon: 'AlertTriangle',
            color: 'red',
            timestamp: item.updatedAt || new Date(),
            link: '/admin/pos',
            linkText: 'Manage Stock'
          });
        }
      });

      // Sort by timestamp and return top 6 activities
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6);
        
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      return [];
    }
  }

  async getTopProducts() {
    try {
      // Get POS sales data by product
      const posSales = await db
        .select({
          productId: posSaleItems.productId,
          productName: posSaleItems.productName,
          totalRevenue: sum(posSaleItems.totalPrice),
          totalQuantity: sum(posSaleItems.quantity)
        })
        .from(posSaleItems)
        .groupBy(posSaleItems.productId, posSaleItems.productName);

      // Get delivery order data by product
      const deliverySales = await db
        .select({
          productId: orderItems.productId,
          totalRevenue: sum(sql<number>`${orderItems.quantity} * ${orderItems.price}`),
          totalQuantity: sum(orderItems.quantity)
        })
        .from(orderItems)
        .leftJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.paymentStatus, "paid"))
        .groupBy(orderItems.productId);

      // Create combined sales map
      const salesMap = new Map();

      // Add POS sales
      posSales.forEach(sale => {
        salesMap.set(sale.productId, {
          revenue: Number(sale.totalRevenue || 0),
          quantity: Number(sale.totalQuantity || 0),
          posRevenue: Number(sale.totalRevenue || 0),
          deliveryRevenue: 0
        });
      });

      // Add delivery sales
      deliverySales.forEach(sale => {
        const existing = salesMap.get(sale.productId) || {
          revenue: 0,
          quantity: 0,
          posRevenue: 0,
          deliveryRevenue: 0
        };
        existing.deliveryRevenue = Number(sale.totalRevenue || 0);
        existing.revenue += existing.deliveryRevenue;
        existing.quantity += Number(sale.totalQuantity || 0);
        salesMap.set(sale.productId, existing);
      });

      // Get all products and sort by total sales
      const allProducts = await db
        .select({
          id: products.id,
          name: products.name,
          category: categories.name,
          price: products.price,
          image: products.imageUrl
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id));

      // Sort products by total revenue and return top 5
      const sortedProducts = allProducts
        .map(row => {
          const salesData = salesMap.get(row.id) || { revenue: 0, quantity: 0, posRevenue: 0, deliveryRevenue: 0 };
          return {
            id: row.id,
            name: row.name,
            category: row.category,
            price: Number(row.price || 0),
            sales: salesData.revenue, // Combined POS + delivery revenue
            orders: salesData.quantity, // Combined quantity
            posRevenue: salesData.posRevenue,
            deliveryRevenue: salesData.deliveryRevenue,
            image: row.image
          };
        })
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      return sortedProducts;
    } catch (error) {
      console.error("Error fetching top products:", error);
      return [];
    }
  }

  // Admin settings operations
  async getAdminSetting(key: string): Promise<{ value: string } | undefined> {
    try {
      const [setting] = await db
        .select({ value: adminSettings.value })
        .from(adminSettings)
        .where(eq(adminSettings.key, key));
      return setting;
    } catch (error) {
      console.error("Error getting admin setting:", error);
      return undefined;
    }
  }

  async setAdminSetting(key: string, value: string, description?: string): Promise<void> {
    try {
      await db
        .insert(adminSettings)
        .values({ key, value, description })
        .onConflictDoUpdate({
          target: adminSettings.key,
          set: { 
            value: value,
            description: description,
            updatedAt: new Date()
          }
        });
    } catch (error) {
      console.error("Error setting admin setting:", error);
      throw error;
    }
  }

  async getAdminSettings(): Promise<Array<{ key: string; value: string; description?: string }>> {
    try {
      const settings = await db
        .select({
          key: adminSettings.key,
          value: adminSettings.value,
          description: adminSettings.description
        })
        .from(adminSettings)
        .orderBy(adminSettings.key);
      
      return settings.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description || undefined
      }));
    } catch (error) {
      console.error("Error getting admin settings:", error);
      return [];
    }
  }

  // Cart methods
  async getCartItems(userId: string) {
    try {
      // For now, return empty cart - in a real app, you'd have a cart table
      return [];
    } catch (error) {
      console.error("Error fetching cart items:", error);
      return [];
    }
  }

  async addToCart(userId: string, productId: string, quantity: number) {
    try {
      // For now, just return success - in a real app, you'd store in cart table
      return { id: `cart_${Date.now()}`, userId, productId, quantity, message: "Added to cart" };
    } catch (error) {
      console.error("Error adding to cart:", error);
      throw error;
    }
  }

  async updateCartItemQuantity(userId: string, itemId: string, quantity: number) {
    try {
      // For now, just return success - in a real app, you'd update cart table
      return { id: itemId, userId, quantity, message: "Quantity updated" };
    } catch (error) {
      console.error("Error updating cart item quantity:", error);
      throw error;
    }
  }

  async removeFromCart(userId: string, itemId: string) {
    try {
      // For now, just return success - in a real app, you'd delete from cart table
      console.log(`Removing item ${itemId} from cart for user ${userId}`);
    } catch (error) {
      console.error("Error removing from cart:", error);
      throw error;
    }
  }

  // POS operations
  async createPosProfile(posProfileData: InsertPosProfile): Promise<PosProfile> {
    const [posProfile] = await db
      .insert(posProfiles)
      .values(posProfileData)
      .returning();
    return posProfile;
  }

  async getPosProfile(id: string): Promise<PosProfile | undefined> {
    const [posProfile] = await db
      .select()
      .from(posProfiles)
      .where(eq(posProfiles.id, id));
    return posProfile;
  }

  async getPosProfileByUserId(userId: string): Promise<PosProfile | undefined> {
    const [posProfile] = await db
      .select()
      .from(posProfiles)
      .where(eq(posProfiles.userId, userId));
    return posProfile;
  }

  async updatePosProfile(id: string, updates: Partial<InsertPosProfile>): Promise<PosProfile> {
    const [posProfile] = await db
      .update(posProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(posProfiles.id, id))
      .returning();
    return posProfile;
  }

  async createPosSale(saleData: InsertPosSale, items: InsertPosSaleItem[]): Promise<PosSale> {
    // Generate unique sale number
    const saleNumber = `POS${Date.now()}`;
    
    // Create the sale record
    const [sale] = await db
      .insert(posSales)
      .values({ 
        ...saleData, 
        saleNumber,
        createdAt: new Date(),
        updatedAt: new Date() 
      })
      .returning();

    // Add sale items
    if (items.length > 0) {
      await db
        .insert(posSaleItems)
        .values(items.map(item => ({ ...item, posSaleId: sale.id })));
    }

    return sale;
  }

  async getPosSale(id: string): Promise<PosSale | undefined> {
    const [sale] = await db
      .select()
      .from(posSales)
      .where(eq(posSales.id, id));
    return sale;
  }

  async updatePosSale(id: string, updates: Partial<InsertPosSale>): Promise<PosSale> {
    const [sale] = await db
      .update(posSales)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(posSales.id, id))
      .returning();
    return sale;
  }

  async getPosSalesByProfile(posProfileId: string): Promise<PosSale[]> {
    return await db
      .select()
      .from(posSales)
      .where(eq(posSales.posProfileId, posProfileId))
      .orderBy(desc(posSales.createdAt));
  }

  async getPosSalesWithDelivery(): Promise<any[]> {
    // Get POS sales that have delivery assignments or need delivery
    return await db
      .select({
        id: posSales.id,
        saleNumber: posSales.saleNumber,
        customerName: posSales.customerName,
        customerPhone: posSales.customerPhone,
        customerAddress: posSales.customerAddress,
        totalAmount: posSales.totalAmount,
        tax: posSales.tax,
        discount: posSales.discount,
        paymentMethod: posSales.paymentMethod,
        paymentStatus: posSales.paymentStatus,
        deliveryPartnerId: posSales.deliveryPartnerId,
        deliveryStatus: posSales.deliveryStatus,
        deliveryDate: posSales.deliveryDate,
        deliveryTimeSlot: posSales.deliveryTimeSlot,
        assignedAt: posSales.assignedAt,
        createdAt: posSales.createdAt,
        updatedAt: posSales.updatedAt,
        // Get delivery partner name if assigned
        deliveryPartnerName: sql`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as('deliveryPartnerName')
      })
      .from(posSales)
      .leftJoin(deliveryPartners, eq(posSales.deliveryPartnerId, deliveryPartners.id))
      .leftJoin(users, eq(deliveryPartners.userId, users.id))
      .where(
        or(
          isNotNull(posSales.deliveryPartnerId),
          isNotNull(posSales.customerAddress)
        )
      )
      .orderBy(desc(posSales.createdAt));
  }

  async getPosSalesWithItems(posProfileId: string): Promise<any[]> {
    const sales = await db
      .select({
        id: posSales.id,
        saleNumber: posSales.saleNumber,
        customerName: posSales.customerName,
        customerPhone: posSales.customerPhone,
        totalAmount: posSales.totalAmount,
        tax: posSales.tax,
        discount: posSales.discount,
        paymentMethod: posSales.paymentMethod,
        paymentStatus: posSales.paymentStatus,
        notes: posSales.notes,
        createdAt: posSales.createdAt,
      })
      .from(posSales)
      .where(eq(posSales.posProfileId, posProfileId))
      .orderBy(desc(posSales.createdAt));

    // Fetch items for each sale
    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const items = await db
          .select({
            id: posSaleItems.id,
            productId: posSaleItems.productId,
            productName: posSaleItems.productName,
            quantity: posSaleItems.quantity,
            unitPrice: posSaleItems.unitPrice,
            totalPrice: posSaleItems.totalPrice,
            unit: posSaleItems.unit,
          })
          .from(posSaleItems)
          .where(eq(posSaleItems.posSaleId, sale.id));

        return { ...sale, items };
      })
    );

    return salesWithItems;
  }

  async getPosStats(posProfileId: string): Promise<any> {
    const [totalSales] = await db
      .select({ count: count() })
      .from(posSales)
      .where(eq(posSales.posProfileId, posProfileId));

    const [totalRevenue] = await db
      .select({ total: sum(posSales.totalAmount) })
      .from(posSales)
      .where(and(eq(posSales.posProfileId, posProfileId), eq(posSales.paymentStatus, "paid")));

    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todaySales] = await db
      .select({ count: count() })
      .from(posSales)
      .where(and(
        eq(posSales.posProfileId, posProfileId),
        gte(posSales.createdAt, today)
      ));

    const [todayRevenue] = await db
      .select({ total: sum(posSales.totalAmount) })
      .from(posSales)
      .where(and(
        eq(posSales.posProfileId, posProfileId),
        gte(posSales.createdAt, today),
        eq(posSales.paymentStatus, "paid")
      ));

    return {
      totalSales: totalSales.count,
      totalRevenue: Number(totalRevenue?.total || 0),
      todaySales: todaySales.count,
      todayRevenue: Number(todayRevenue?.total || 0),
    };
  }

  // Raw Material Management Methods
  async createRawMaterial(materialData: InsertRawMaterial): Promise<RawMaterial> {
    const [material] = await db
      .insert(rawMaterials)
      .values(materialData)
      .returning();
    return material;
  }

  async getRawMaterialsByProfile(posProfileId: string): Promise<RawMaterial[]> {
    return await db
      .select()
      .from(rawMaterials)
      .where(eq(rawMaterials.posProfileId, posProfileId))
      .orderBy(desc(rawMaterials.createdAt));
  }

  async getAllRawMaterials(): Promise<RawMaterial[]> {
    return await db.select().from(rawMaterials).orderBy(desc(rawMaterials.createdAt));
  }

  async getRawMaterial(id: string): Promise<RawMaterial | undefined> {
    const [material] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, id));
    return material;
  }

  async updateRawMaterialStock(id: string, newStock: number): Promise<void> {
    await db
      .update(rawMaterials)
      .set({ 
        currentStock: newStock.toString(),
        updatedAt: new Date()
      })
      .where(eq(rawMaterials.id, id));
  }

  async updateRawMaterial(id: string, updates: Partial<InsertRawMaterial>): Promise<RawMaterial> {
    const [material] = await db
      .update(rawMaterials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rawMaterials.id, id))
      .returning();
    return material;
  }

  async updateStockQuantity(materialId: string, newQuantity: number): Promise<void> {
    await db
      .update(rawMaterials)
      .set({ 
        currentStock: newQuantity.toString(),
        updatedAt: new Date() 
      })
      .where(eq(rawMaterials.id, materialId));
  }

  async createStockEntry(entryData: InsertStockEntry): Promise<StockEntry> {
    const [entry] = await db
      .insert(stockEntries)
      .values(entryData)
      .returning();
      
    // Update material stock based on entry type
    if (entryData.rawMaterialId) {
      const material = await this.getRawMaterial(entryData.rawMaterialId);
      if (material) {
        const currentStock = parseFloat(material.currentStock || "0");
        let newStock = currentStock;
        
        if (entryData.entryType === 'purchase' || entryData.entryType === 'adjustment') {
          newStock = currentStock + parseFloat(entryData.quantity.toString());
        } else if (entryData.entryType === 'usage') {
          newStock = Math.max(0, currentStock - parseFloat(entryData.quantity.toString()));
        }
        
        await this.updateStockQuantity(entryData.rawMaterialId, newStock);
      }
    }
    
    return entry;
  }

  async getStockEntriesByProfile(posProfileId: string): Promise<StockEntry[]> {
    return await db
      .select({
        id: stockEntries.id,
        posProfileId: stockEntries.posProfileId,
        rawMaterialId: stockEntries.rawMaterialId,
        entryType: stockEntries.entryType,
        quantity: stockEntries.quantity,
        unitPrice: stockEntries.unitPrice,
        totalAmount: stockEntries.totalAmount,
        supplier: stockEntries.supplier,
        invoiceNumber: stockEntries.invoiceNumber,
        notes: stockEntries.notes,
        createdAt: stockEntries.createdAt,
        createdBy: stockEntries.createdBy,
        rawMaterial: {
          id: rawMaterials.id,
          name: rawMaterials.name,
          unit: rawMaterials.unit,
          category: rawMaterials.category
        }
      })
      .from(stockEntries)
      .leftJoin(rawMaterials, eq(stockEntries.rawMaterialId, rawMaterials.id))
      .where(eq(stockEntries.posProfileId, posProfileId))
      .orderBy(desc(stockEntries.createdAt));
  }

  async getStockEntriesByMaterial(materialId: string): Promise<StockEntry[]> {
    return await db
      .select()
      .from(stockEntries)
      .where(eq(stockEntries.rawMaterialId, materialId))
      .orderBy(desc(stockEntries.createdAt));
  }

  async createProductRecipe(recipeData: InsertProductRecipe): Promise<ProductRecipe> {
    const [recipe] = await db
      .insert(productRecipes)
      .values(recipeData)
      .returning();
    return recipe;
  }

  async getProductRecipes(productId: string): Promise<ProductRecipe[]> {
    return await db
      .select()
      .from(productRecipes)
      .where(eq(productRecipes.productId, productId));
  }

  async processProductSale(productId: string, quantity: number, posProfileId: string): Promise<void> {
    // Get product recipes to deduct raw materials
    const recipes = await this.getProductRecipes(productId);
    
    console.log(`🍶 Processing sale for product ${productId}, quantity: ${quantity}`);
    console.log(`📝 Found ${recipes.length} recipes for this product`);
    
    for (const recipe of recipes) {
      const requiredQuantity = parseFloat(recipe.quantityRequired?.toString() || "0") * quantity;
      if (recipe.rawMaterialId && requiredQuantity > 0) {
        const material = await this.getRawMaterial(recipe.rawMaterialId);
        
        if (material) {
          const currentStock = parseFloat(material.currentStock || "0");
          console.log(`📦 Material: ${material.name}, Current stock: ${currentStock}, Required: ${requiredQuantity}`);
          
          // Only use createStockEntry - it handles both logging AND stock update
          await this.createStockEntry({
            rawMaterialId: recipe.rawMaterialId,
            posProfileId: posProfileId,
            entryType: 'usage',
            quantity: requiredQuantity.toString(),
            notes: `Used for product sale: ${productId} (qty: ${quantity})`,
            invoiceNumber: null,
            createdBy: null
          });
          
          console.log(`✅ Stock updated for ${material.name}: ${currentStock} → ${Math.max(0, currentStock - requiredQuantity)}`);
        } else {
          console.log(`❌ Raw material not found: ${recipe.rawMaterialId}`);
        }
      }
    }
  }

  async getProfitAnalysis(posProfileId: string): Promise<{
    totalRevenue: number;
    totalCost: number;
    profit: number;
    profitMargin: number;
    salesCount: number;
  }> {
    // Get all sales for the profile
    const sales = await db
      .select({
        totalAmount: posSales.totalAmount,
        saleId: posSales.id
      })
      .from(posSales)
      .where(and(
        eq(posSales.posProfileId, posProfileId),
        eq(posSales.paymentStatus, "paid")
      ));

    let totalRevenue = 0;
    let totalCost = 0;

    for (const sale of sales) {
      totalRevenue += parseFloat(sale.totalAmount.toString());
      
      // Calculate cost for each sale item
      const saleItems = await db
        .select()
        .from(posSaleItems)
        .where(eq(posSaleItems.posSaleId, sale.saleId));
        
      for (const item of saleItems) {
        // Get product recipes to calculate raw material cost
        if (!item.productId) continue;
        const recipes = await this.getProductRecipes(item.productId);
        let itemCost = 0;
        
        for (const recipe of recipes) {
          const material = await this.getRawMaterial(recipe.rawMaterialId || "");
          if (material) {
            const materialCostPerUnit = parseFloat(recipe.quantityRequired?.toString() || "0") * parseFloat(material.buyingPrice?.toString() || "0");
            itemCost += materialCostPerUnit * item.quantity;
          }
        }
        
        totalCost += itemCost;
      }
    }

    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      profit,
      profitMargin,
      salesCount: sales.length
    };
  }

  // Enhanced POS Sale creation with integrated order system
  async createIntegratedPosSale(
    saleData: InsertPosSale, 
    items: InsertPosSaleItem[], 
    customerData?: { email?: string; phone?: string }
  ): Promise<{ posSale: PosSale; order?: Order }> {
    // Generate unique sale number
    const saleNumber = `POS${Date.now()}`;
    
    // Create the POS sale record
    const [posSale] = await db
      .insert(posSales)
      .values({ 
        ...saleData, 
        saleNumber,
        createdAt: new Date(),
        updatedAt: new Date() 
      })
      .returning();

    // Add sale items
    if (items.length > 0) {
      await db
        .insert(posSaleItems)
        .values(items.map(item => ({ ...item, posSaleId: posSale.id })));
    }

    // Process stock deductions for each product
    for (const item of items) {
      if (item.productId) {
        await this.processProductSale(item.productId, item.quantity, saleData.posProfileId);
      }
    }

    let order: Order | undefined;

    // Create corresponding order if customer data is provided
    if (customerData && (customerData.email || customerData.phone)) {
      try {
        // Find or create customer
        let customer = null;
        if (customerData.email) {
          customer = await this.getUserByEmail(customerData.email);
        } else if (customerData.phone) {
          customer = await this.getUserByPhone(customerData.phone);
        }

        if (!customer && (customerData.email || customerData.phone)) {
          // Create new customer
          const userData = {
            email: customerData.email,
            phone: customerData.phone,
            role: 'customer' as const,
            firstName: saleData.customerName?.split(' ')[0] || 'Customer',
            lastName: saleData.customerName?.split(' ').slice(1).join(' ') || '',
            isEmailVerified: !!customerData.email,
            isPhoneVerified: !!customerData.phone
          };
          customer = await this.createUser(userData);
        }

        if (customer) {
          // Create order record
          const orderData = {
            userId: customer.id,
            totalAmount: saleData.totalAmount,
            tax: saleData.tax || "0",
            discount: saleData.discount || "0",
            status: 'delivered' as const, // POS sales are immediate
            paymentMethod: saleData.paymentMethod,
            paymentStatus: 'paid' as const,
            notes: `POS Sale: ${saleNumber}`,
            deliveryType: 'pickup' as const,
            orderSource: 'pos' as const
          };

          [order] = await db
            .insert(orders)
            .values({
              ...orderData,
              orderNumber: saleNumber
            })
            .returning();

          // Create order items
          const orderItemsData = items.map(item => ({
            orderId: order!.id,
            productId: item.productId || "",
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          }));

          await db.insert(orderItems).values(orderItemsData.map(item => ({
            ...item,
            price: item.unitPrice,
            total: item.totalPrice
          })));
        }
      } catch (error) {
        console.error('Error creating integrated order:', error);
        // Continue with POS sale even if order creation fails
      }
    }

    return { posSale, order };
  }

  // Delete stock entry
  async deleteStockEntry(entryId: string, userId: string): Promise<void> {
    const [stockEntry] = await db.select().from(stockEntries).where(eq(stockEntries.id, entryId)).limit(1);
    if (!stockEntry) {
      throw new Error("Stock entry not found");
    }

    // Verify user owns this entry through their POS profile
    const posProfile = await this.getPosProfileByUserId(userId);
    if (!posProfile || stockEntry.posProfileId !== posProfile.id) {
      throw new Error("Unauthorized to delete this stock entry");
    }

    // Store the raw material ID to recalculate stock after deletion
    const rawMaterialId = stockEntry.rawMaterialId;

    // Delete the stock entry first
    await db.delete(stockEntries).where(eq(stockEntries.id, entryId));

    // Recalculate stock from remaining entries (more accurate than manual reversal)
    if (rawMaterialId) {
      const remainingEntries = await db
        .select()
        .from(stockEntries)
        .where(eq(stockEntries.rawMaterialId, rawMaterialId));

      let totalStock = 0;
      for (const entry of remainingEntries) {
        const quantity = parseFloat(entry.quantity.toString());
        if (entry.entryType === 'purchase' || entry.entryType === 'adjustment') {
          totalStock += quantity;
        } else if (entry.entryType === 'usage' || entry.entryType === 'sale') {
          totalStock -= quantity;
        }
      }

      // Ensure stock doesn't go below 0
      totalStock = Math.max(0, totalStock);

      // Update the raw material's current stock
      await db
        .update(rawMaterials)
        .set({ 
          currentStock: totalStock.toString(),
          updatedAt: new Date()
        })
        .where(eq(rawMaterials.id, rawMaterialId));
    }
  }

  // Delete raw material
  async deleteRawMaterial(materialId: string, userId: string): Promise<void> {
    const rawMaterial = await db.select().from(rawMaterials).where(eq(rawMaterials.id, materialId)).limit(1);
    if (rawMaterial.length === 0) {
      throw new Error("Raw material not found");
    }

    // Verify user owns this material through their POS profile
    const posProfile = await this.getPosProfileByUserId(userId);
    if (!posProfile || rawMaterial[0].posProfileId !== posProfile.id) {
      throw new Error("Unauthorized to delete this raw material");
    }

    await db.delete(rawMaterials).where(eq(rawMaterials.id, materialId));
  }

  // Update raw material with user authorization
  async updateRawMaterialByUser(materialId: string, userId: string, updates: any): Promise<any> {
    const rawMaterial = await db.select().from(rawMaterials).where(eq(rawMaterials.id, materialId)).limit(1);
    if (rawMaterial.length === 0) {
      throw new Error("Raw material not found");
    }

    // Verify user owns this material through their POS profile
    const posProfile = await this.getPosProfileByUserId(userId);
    if (!posProfile || rawMaterial[0].posProfileId !== posProfile.id) {
      throw new Error("Unauthorized to update this raw material");
    }

    const [updatedMaterial] = await db
      .update(rawMaterials)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(rawMaterials.id, materialId))
      .returning();

    return updatedMaterial;
  }

  // Customer Review Methods (Order-based)
  // Order Reviews (Overall + Delivery)
  async getOrderReviews(filters?: { limit?: number; shortlistedOnly?: boolean; minRating?: number; maxRating?: number; minOrderValue?: number; maxOrderValue?: number; customerName?: string }): Promise<any[]> {
    let whereConditions = [eq(orderReviews.isActive, true)];
    
    if (filters?.shortlistedOnly) {
      whereConditions.push(eq(orderReviews.isShortlisted, true));
    }
    
    if (filters?.minRating) {
      whereConditions.push(gte(orderReviews.overallRating, filters.minRating));
    }
    
    if (filters?.maxRating) {
      whereConditions.push(lte(orderReviews.overallRating, filters.maxRating));
    }
    
    if (filters?.minOrderValue) {
      whereConditions.push(gte(orderReviews.orderValue, filters.minOrderValue.toString()));
    }
    
    if (filters?.maxOrderValue) {
      whereConditions.push(lte(orderReviews.orderValue, filters.maxOrderValue.toString()));
    }
    
    if (filters?.customerName) {
      whereConditions.push(ilike(orderReviews.customerName, `%${filters.customerName}%`));
    }

    let query = db
      .select({
        id: orderReviews.id,
        orderId: orderReviews.orderId,
        userId: orderReviews.userId,
        customerName: orderReviews.customerName,
        overallRating: orderReviews.overallRating,
        overallReviewText: orderReviews.overallReviewText,
        deliveryRating: orderReviews.deliveryRating,
        deliveryReviewText: orderReviews.deliveryReviewText,
        orderValue: orderReviews.orderValue,
        isShortlisted: orderReviews.isShortlisted,
        isActive: orderReviews.isActive,
        createdAt: orderReviews.createdAt,
        orderNumber: orders.orderNumber,
        orderDate: orders.createdAt,
      })
      .from(orderReviews)
      .leftJoin(orders, eq(orderReviews.orderId, orders.id))
      .where(and(...whereConditions))
      .orderBy(desc(orderReviews.createdAt));
    
    if (filters?.limit) {
      return await query.limit(filters.limit);
    }
    
    return await query;
  }

  // Product Reviews
  async getProductReviews(filters?: { limit?: number; shortlistedOnly?: boolean; minRating?: number; maxRating?: number; productName?: string }): Promise<any[]> {
    let whereConditions = [eq(productReviews.isActive, true)];
    
    if (filters?.shortlistedOnly) {
      whereConditions.push(eq(productReviews.isShortlisted, true));
    }
    
    if (filters?.minRating) {
      whereConditions.push(gte(productReviews.rating, filters.minRating));
    }
    
    if (filters?.maxRating) {
      whereConditions.push(lte(productReviews.rating, filters.maxRating));
    }
    
    if (filters?.productName) {
      whereConditions.push(ilike(products.name, `%${filters.productName}%`));
    }

    let query = db
      .select({
        id: productReviews.id,
        orderId: productReviews.orderId,
        orderItemId: productReviews.orderItemId,
        productId: productReviews.productId,
        userId: productReviews.userId,
        customerName: productReviews.customerName,
        rating: productReviews.rating,
        reviewText: productReviews.reviewText,
        isShortlisted: productReviews.isShortlisted,
        isActive: productReviews.isActive,
        createdAt: productReviews.createdAt,
        productName: products.name,
        productImage: products.imageUrl,
        orderNumber: orders.orderNumber,
      })
      .from(productReviews)
      .leftJoin(products, eq(productReviews.productId, products.id))
      .leftJoin(orders, eq(productReviews.orderId, orders.id))
      .where(and(...whereConditions))
      .orderBy(desc(productReviews.createdAt));
    
    if (filters?.limit) {
      return await query.limit(filters.limit);
    }
    
    return await query;
  }

  // Backward compatibility - Query the actual customer_reviews table
  async getCustomerReviews(filters?: { limit?: number; shortlistedOnly?: boolean; minRating?: number; maxRating?: number; minOrderValue?: number; maxOrderValue?: number; customerName?: string }): Promise<any[]> {
    // Query the actual customer_reviews table directly for the admin panel
    let whereConditions = [sql`is_active = true`];
    
    if (filters?.shortlistedOnly) {
      whereConditions.push(sql`is_shortlisted = true`);
    }
    
    if (filters?.minRating) {
      whereConditions.push(sql`rating >= ${filters.minRating}`);
    }
    
    if (filters?.maxRating) {
      whereConditions.push(sql`rating <= ${filters.maxRating}`);
    }
    
    if (filters?.minOrderValue) {
      whereConditions.push(sql`order_value >= ${filters.minOrderValue}`);
    }
    
    if (filters?.maxOrderValue) {
      whereConditions.push(sql`order_value <= ${filters.maxOrderValue}`);
    }
    
    if (filters?.customerName) {
      whereConditions.push(sql`customer_name ILIKE ${'%' + filters.customerName + '%'}`);
    }

    const whereClause = whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``;
    const limitClause = filters?.limit ? sql`LIMIT ${filters.limit}` : sql``;
    
    const query = sql`
      SELECT 
        id,
        order_id as "orderId",
        customer_name as "customerName", 
        rating,
        review_text as "reviewText",
        order_value as "orderValue",
        is_shortlisted as "isShortlisted",
        is_active as "isActive",
        created_at as "createdAt",
        order_id as "orderNumber"
      FROM customer_reviews 
      ${whereClause}
      ORDER BY created_at DESC 
      ${limitClause}
    `;

    const result = await db.execute(query);
    return result.rows;
  }

  async createOrderReview(review: { 
    orderId: string; 
    userId?: string; 
    customerName: string; 
    overallRating: number; 
    overallReviewText: string; 
    deliveryRating: number; 
    deliveryReviewText?: string;
    orderValue: number 
  }): Promise<OrderReview> {
    const [newReview] = await db
      .insert(orderReviews)
      .values({
        orderId: review.orderId,
        userId: review.userId || null,
        customerName: review.customerName,
        overallRating: review.overallRating,
        overallReviewText: review.overallReviewText,
        deliveryRating: review.deliveryRating,
        deliveryReviewText: review.deliveryReviewText || null,
        orderValue: review.orderValue.toString(),
        isShortlisted: false,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();
    return newReview;
  }

  async getProductReviewByOrderAndProduct(orderId: string, productId: string, userId: string): Promise<ProductReview | undefined> {
    const [review] = await db
      .select()
      .from(productReviews)
      .where(and(
        eq(productReviews.orderId, orderId),
        eq(productReviews.productId, productId),
        eq(productReviews.userId, userId)
      ));
    
    return review || undefined;
  }

  async getCustomerProductReviews(userId: string, limit: number = 1000): Promise<any[]> {
    try {
      const reviews = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.userId, userId))
        .orderBy(sql`${productReviews.createdAt} DESC`)
        .limit(limit);
      
      return reviews;
    } catch (error) {
      console.error('Error fetching customer product reviews:', error);
      throw error;
    }
  }

  async getSpecificProductReview(userId: string, orderId: string, productId: string): Promise<any> {
    try {
      const review = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.userId, userId),
            eq(productReviews.orderId, orderId),
            eq(productReviews.productId, productId)
          )
        )
        .limit(1);
      
      return review[0] || null;
    } catch (error) {
      console.error('Error fetching specific product review:', error);
      throw error;
    }
  }

  async createProductReview(review: { 
    orderId: string; 
    orderItemId: string | null;
    productId: string;
    userId?: string; 
    customerName: string; 
    rating: number; 
    reviewText?: string; 
  }): Promise<ProductReview> {
    const [newReview] = await db
      .insert(productReviews)
      .values({
        orderId: review.orderId,
        orderItemId: review.orderItemId || null, // Allow null for specialInstructions items
        productId: review.productId,
        userId: review.userId || null,
        customerName: review.customerName,
        rating: review.rating,
        reviewText: review.reviewText || null,
        isShortlisted: false,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();
    return newReview;
  }

  // Backward compatibility
  async createCustomerReview(review: { orderId: string; userId?: string; customerName: string; rating: number; reviewText: string; orderValue: number }): Promise<OrderReview> {
    return this.createOrderReview({
      orderId: review.orderId,
      userId: review.userId,
      customerName: review.customerName,
      overallRating: review.rating,
      overallReviewText: review.reviewText,
      deliveryRating: review.rating, // Default delivery rating to overall rating
      orderValue: review.orderValue
    });
  }

  async updateOrderReview(id: string, updates: { 
    customerName?: string; 
    overallRating?: number; 
    overallReviewText?: string;
    deliveryRating?: number;
    deliveryReviewText?: string;
    isShortlisted?: boolean; 
    isActive?: boolean 
  }): Promise<OrderReview> {
    const [updatedReview] = await db
      .update(orderReviews)
      .set({
        customerName: updates.customerName,
        overallRating: updates.overallRating,
        overallReviewText: updates.overallReviewText,
        deliveryRating: updates.deliveryRating,
        deliveryReviewText: updates.deliveryReviewText,
        isShortlisted: updates.isShortlisted,
        isActive: updates.isActive,
      })
      .where(eq(orderReviews.id, id))
      .returning();
    return updatedReview;
  }

  async updateProductReview(id: string, updates: { 
    customerName?: string; 
    rating?: number; 
    reviewText?: string;
    isShortlisted?: boolean; 
    isActive?: boolean 
  }): Promise<ProductReview> {
    const [updatedReview] = await db
      .update(productReviews)
      .set({
        customerName: updates.customerName,
        rating: updates.rating,
        reviewText: updates.reviewText,
        isShortlisted: updates.isShortlisted,
        isActive: updates.isActive,
      })
      .where(eq(productReviews.id, id))
      .returning();
    return updatedReview;
  }

  // Backward compatibility
  async updateCustomerReview(id: string, updates: { customerName?: string; rating?: number; reviewText?: string; isShortlisted?: boolean; isActive?: boolean }): Promise<OrderReview> {
    return this.updateOrderReview(id, {
      customerName: updates.customerName,
      overallRating: updates.rating,
      overallReviewText: updates.reviewText,
      isShortlisted: updates.isShortlisted,
      isActive: updates.isActive,
    });
  }

  async deleteCustomerReview(id: string): Promise<void> {
    await db
      .delete(customerReviews)
      .where(eq(customerReviews.id, id));
  }

  async getOrdersEligibleForReview(userId: string): Promise<any[]> {
    // Get all delivered orders (removed the review filter to show all orders)
    const ordersWithItems = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        deliveredAt: orders.deliveredAt,
        createdAt: orders.createdAt,
        specialInstructions: orders.specialInstructions, // Contains items JSON
        hasOrderReview: orderReviews.id,
      })
      .from(orders)
      .leftJoin(orderReviews, eq(orders.id, orderReviews.orderId))
      .where(and(
        eq(orders.userId, userId),
        eq(orders.status, 'delivered')
        // Removed isNull(orderReviews.id) to show all orders including reviewed ones
      ))
      .orderBy(desc(orders.deliveredAt));

    console.log(`📋 Found ${ordersWithItems.length} delivered orders for user ${userId}`);
    console.log('📋 Order numbers:', ordersWithItems.map(o => o.orderNumber));

    if (ordersWithItems.length === 0) {
      return [];
    }

    // Get all order IDs for batch processing
    const orderIds = ordersWithItems.map(order => order.id);

    // Batch fetch all order items for all orders at once
    const allOrderItems = await db
      .select({
        orderId: orderItems.orderId,
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productName: products.name,
        productImage: products.imageUrl,
        hasReview: productReviews.id,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productReviews, eq(orderItems.id, productReviews.orderItemId))
      .where(inArray(orderItems.orderId, orderIds));

    console.log(`📋 Found ${allOrderItems.length} order items for ${orderIds.length} orders`);
    console.log('📋 Sample order items:', allOrderItems.slice(0, 3));

    // Group order items by order ID and deduplicate products by name
    const itemsByOrderId = new Map<string, any[]>();
    const itemsNeedingReviewByOrderId = new Map<string, any[]>();
    
    // Process items for each order separately to handle deduplication properly
    const orderItemsMap = new Map<string, any[]>();
    allOrderItems.forEach(item => {
      if (!orderItemsMap.has(item.orderId)) {
        orderItemsMap.set(item.orderId, []);
      }
      orderItemsMap.get(item.orderId)!.push(item);
    });

    // Process each order's items with deduplication
    orderItemsMap.forEach((items, orderId) => {
      console.log(`📋 Processing ${items.length} items for order ${orderId}`);
      
      // Deduplicate products by name within this order
      const productMap = new Map();
      
      items.forEach(item => {
        const key = item.productName?.toLowerCase() || item.productId; // Use product name as key
        if (!productMap.has(key)) {
          productMap.set(key, {
            ...item,
            hasReview: !!item.hasReview,
            quantity: parseInt(item.quantity?.toString() || '0'), // Convert to integer for proper calculation
            totalQuantity: parseInt(item.quantity?.toString() || '0')
          });
        } else {
          // If product already exists, update review status and combine quantities
          const existing = productMap.get(key);
          if (item.hasReview && !existing.hasReview) {
            existing.hasReview = true;
          }
          const additionalQty = parseInt(item.quantity?.toString() || '0');
          existing.totalQuantity += additionalQty;
          // Update quantity to show the combined total
          existing.quantity = existing.totalQuantity;
        }
      });

      // Convert map to arrays
      const allItems = Array.from(productMap.values());
      const itemsNeedingReview = allItems.filter(item => !item.hasReview);
      
      console.log(`📋 Order ${orderId}: ${allItems.length} unique items, ${itemsNeedingReview.length} need reviews`);
      
      itemsByOrderId.set(orderId, allItems);
      itemsNeedingReviewByOrderId.set(orderId, itemsNeedingReview);
    });

    // Build the final result and filter out orders with no items
    const ordersWithItemsData = ordersWithItems
      .map(order => {
        const allItems = itemsByOrderId.get(order.id) || [];
        const itemsNeedingReview = itemsNeedingReviewByOrderId.get(order.id) || [];
        
        return {
          ...order,
          orderItems: allItems, // Show all items
          needsProductReviews: itemsNeedingReview.length > 0, // Track if there are items needing reviews
          hasOrderReview: !!order.hasOrderReview, // Convert to boolean
          hasAnyReviews: !!order.hasOrderReview || (allItems.length > itemsNeedingReview.length) // Has reviews if order review exists OR some products were reviewed
        };
      })
      
    // First, get product reviews for all orders that might need them (those with specialInstructions)
    const ordersNeedingReviewCheck = ordersWithItemsData.filter(order => order.orderItems.length === 0);
    const allSpecialOrderIds = ordersNeedingReviewCheck.map(order => order.id);
    
    // Batch fetch product reviews for all special orders at once
    const allSpecialReviews = allSpecialOrderIds.length > 0 ? await db
      .select({
        orderId: productReviews.orderId,
        productId: productReviews.productId,
        reviewId: productReviews.id
      })
      .from(productReviews)
      .where(inArray(productReviews.orderId, allSpecialOrderIds)) : [];
    
    // Group reviews by orderId for quick lookup
    const reviewsByOrderId = new Map<string, Set<string>>();
    allSpecialReviews.forEach(review => {
      if (!reviewsByOrderId.has(review.orderId)) {
        reviewsByOrderId.set(review.orderId, new Set());
      }
      reviewsByOrderId.get(review.orderId)!.add(review.productId);
    });

    // Process orders with specialInstructions
    const processedOrders = ordersWithItemsData.map(order => {
        // For orders with no items, try to extract from specialInstructions JSON
        if (order.orderItems.length === 0) {
          console.log(`📋 Order ${order.orderNumber} has no order_items, checking specialInstructions...`);
          
          try {
            const specialInstructions = ordersWithItems.find(o => o.id === order.id)?.specialInstructions;
            if (specialInstructions) {
              const instructionsData = JSON.parse(specialInstructions);
              if (instructionsData.items && Array.isArray(instructionsData.items)) {
                console.log(`📋 Found ${instructionsData.items.length} items in specialInstructions for order ${order.orderNumber}`);
                
                // Get reviewed product IDs for this order
                const reviewedProductIds = reviewsByOrderId.get(order.id) || new Set();
                
                order.orderItems = instructionsData.items.map((item: any, index: number) => ({
                  id: `special-${order.id}-${index}`,
                  orderId: order.id,
                  productId: item.productId || null,
                  productName: item.productName || item.name,
                  productImage: null,
                  quantity: parseInt(item.quantity || '1'),
                  price: item.price || '0.00',
                  hasReview: item.productId ? reviewedProductIds.has(item.productId) : false
                }));
                // Check if any items still need reviews
                const unreviewed = order.orderItems.filter(item => !item.hasReview);
                order.needsProductReviews = unreviewed.length > 0;
              }
            }
          } catch (error) {
            console.log(`📋 Error parsing specialInstructions for order ${order.orderNumber}:`, error);
          }
          
          // If still no items, create placeholder
          if (order.orderItems.length === 0) {
            console.log(`📋 Creating placeholder for Order ${order.orderNumber} with total ₹${order.totalAmount}`);
            order.orderItems = [{
              id: `placeholder-${order.id}`,
              orderId: order.id,
              productId: null,
              productName: 'Product details unavailable',
              productImage: null,
              quantity: 1,
              price: order.totalAmount,
              hasReview: false
            }];
            order.needsProductReviews = true;
          }
        }
        return order;
      });
    
    console.log(`📋 Processed ${processedOrders.length} orders with items for review`);
    return processedOrders;
  }

  async getOrderItemsForReview(orderId: string): Promise<any[]> {
    // Get all products from order items, but group by product to avoid duplicates
    const allItems = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productName: products.name,
        productImage: products.imageUrl,
        hasReview: productReviews.id,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productReviews, eq(orderItems.id, productReviews.orderItemId))
      .where(eq(orderItems.orderId, orderId));
    
    // Group by product name to handle duplicate products with same name but different IDs
    const productMap = new Map();
    
    allItems.forEach(item => {
      const key = item.productName?.toLowerCase() || item.productId; // Use product name as key
      if (!productMap.has(key)) {
        productMap.set(key, {
          ...item,
          hasReview: !!item.hasReview,
          quantity: parseInt(item.quantity?.toString() || '0'), // Convert to integer for proper calculation
          totalQuantity: parseInt(item.quantity?.toString() || '0')
        });
      } else {
        // If product already exists, update review status and combine quantities
        const existing = productMap.get(key);
        if (item.hasReview && !existing.hasReview) {
          existing.hasReview = true;
        }
        const additionalQty = parseInt(item.quantity?.toString() || '0');
        existing.totalQuantity += additionalQty;
        existing.quantity = existing.totalQuantity; // Update quantity to show the combined total
      }
    });
    
    // Return only items that need reviews (no review yet)
    return Array.from(productMap.values()).filter(item => !item.hasReview);
  }

  async getAllOrderItems(orderId: string): Promise<any[]> {
    // Get all products from order items (including reviewed ones)
    const allProducts = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productName: products.name,
        productImage: products.imageUrl,
        hasReview: productReviews.id,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productReviews, eq(orderItems.id, productReviews.orderItemId))
      .where(eq(orderItems.orderId, orderId));
    
    // Group by product name to handle duplicate products with same name but different IDs
    const uniqueProducts = new Map();
    
    allProducts.forEach(item => {
      const key = item.productName?.toLowerCase() || item.productId; // Use product name as key
      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, {
          ...item,
          hasReview: !!item.hasReview,
          quantity: parseInt(item.quantity?.toString() || '0'), // Convert to integer for proper calculation
          totalQuantity: parseInt(item.quantity?.toString() || '0')
        });
      } else {
        // If product already exists, update review status and combine quantities
        const existing = uniqueProducts.get(key);
        if (item.hasReview && !existing.hasReview) {
          existing.hasReview = true;
        }
        const additionalQty = parseInt(item.quantity?.toString() || '0');
        existing.totalQuantity += additionalQty;
        existing.quantity = existing.totalQuantity; // Update quantity to show the combined total
      }
    });
    
    return Array.from(uniqueProducts.values());
  }

  async hasUserReviewedOrder(orderId: string): Promise<boolean> {
    const [review] = await db
      .select()
      .from(orderReviews)
      .where(eq(orderReviews.orderId, orderId))
      .limit(1);
    return !!review;
  }

  async getOrderReviewByOrderId(orderId: string): Promise<OrderReview | undefined> {
    const [review] = await db
      .select()
      .from(orderReviews)
      .where(eq(orderReviews.orderId, orderId))
      .limit(1);
    return review;
  }

  async getReviewStatusForOrder(orderId: string): Promise<{
    hasOrderReview: boolean;
    productReviewsCompleted: number;
    totalProductsToReview: number;
    isCompletelyReviewed: boolean;
  }> {
    // Check if order review exists
    const [orderReview] = await db
      .select()
      .from(orderReviews)
      .where(eq(orderReviews.orderId, orderId))
      .limit(1);

    // Get total unique products in order
    const totalProducts = await db
      .select({ count: sql<number>`count(*)` })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get completed product reviews count
    const completedReviews = await db
      .select({ count: sql<number>`count(*)` })
      .from(productReviews)
      .where(eq(productReviews.orderId, orderId));

    const totalProductsCount = totalProducts[0]?.count || 0;
    const completedReviewsCount = completedReviews[0]?.count || 0;

    return {
      hasOrderReview: !!orderReview,
      productReviewsCompleted: completedReviewsCount,
      totalProductsToReview: totalProductsCount,
      isCompletelyReviewed: !!orderReview && completedReviewsCount >= totalProductsCount
    };
  }

  // Website Statistics Methods
  async getWebsiteStats(): Promise<WebsiteStats[]> {
    return await db
      .select()
      .from(websiteStats)
      .where(eq(websiteStats.isActive, true))
      .orderBy(asc(websiteStats.displayOrder));
  }

  async createWebsiteStats(stats: InsertWebsiteStats): Promise<WebsiteStats> {
    const [newStats] = await db
      .insert(websiteStats)
      .values({
        ...stats,
        updatedAt: new Date(),
      })
      .returning();
    return newStats;
  }

  async updateWebsiteStats(id: string, updates: Partial<InsertWebsiteStats>): Promise<WebsiteStats> {
    const [updatedStats] = await db
      .update(websiteStats)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(websiteStats.id, id))
      .returning();
    return updatedStats;
  }

  async deleteWebsiteStats(id: string): Promise<void> {
    await db
      .delete(websiteStats)
      .where(eq(websiteStats.id, id));
  }
  // Wallet operations
  async getWallet(userId: string): Promise<Wallet | undefined> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));
      return wallet;
    } catch (error) {
      console.error("Error getting wallet:", error);
      return undefined;
    }
  }

  async createWallet(walletData: InsertWallet): Promise<Wallet> {
    try {
      const [wallet] = await db
        .insert(wallets)
        .values(walletData)
        .returning();
      return wallet;
    } catch (error) {
      console.error("Error creating wallet:", error);
      throw error;
    }
  }

  async updateWalletBalance(
    userId: string, 
    amount: number, 
    description: string, 
    reference?: string, 
    referenceType?: string, 
    processedBy?: string
  ): Promise<Wallet> {
    try {
      return await db.transaction(async (tx) => {
        // Get current wallet
        const [currentWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId));

        if (!currentWallet) {
          throw new Error("Wallet not found");
        }

        const previousBalance = parseFloat(currentWallet.balance || '0');
        const newBalance = previousBalance + amount;

        // Update wallet balance
        const [updatedWallet] = await tx
          .update(wallets)
          .set({ 
            balance: newBalance.toFixed(2),
            updatedAt: new Date() 
          })
          .where(eq(wallets.userId, userId))
          .returning();

        // Create transaction record
        await tx
          .insert(walletTransactions)
          .values({
            walletId: currentWallet.id,
            userId,
            type: amount > 0 ? 'credit' : 'debit',
            amount: Math.abs(amount).toFixed(2),
            previousBalance: previousBalance.toFixed(2),
            newBalance: newBalance.toFixed(2),
            description,
            reference,
            referenceType,
            processedBy,
          });

        return updatedWallet;
      });
    } catch (error) {
      console.error("Error updating wallet balance:", error);
      throw error;
    }
  }

  async debitWallet(
    userId: string, 
    amount: number, 
    description: string, 
    reference?: string, 
    referenceType?: string
  ): Promise<Wallet> {
    return this.updateWalletBalance(userId, -Math.abs(amount), description, reference, referenceType);
  }

  async creditWallet(
    userId: string, 
    amount: number, 
    description: string, 
    reference?: string, 
    referenceType?: string
  ): Promise<Wallet> {
    return this.updateWalletBalance(userId, Math.abs(amount), description, reference, referenceType);
  }

  async clearWallet(userId: string, processedBy: string): Promise<Wallet> {
    try {
      return await db.transaction(async (tx) => {
        const [currentWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, userId));

        if (!currentWallet) {
          throw new Error("Wallet not found");
        }

        const currentBalance = parseFloat(currentWallet.balance || '0');
        
        if (currentBalance === 0) {
          return currentWallet; // No need to clear if balance is already 0
        }

        // Clear the wallet (set balance to 0)
        const [clearedWallet] = await tx
          .update(wallets)
          .set({ 
            balance: "0.00",
            updatedAt: new Date() 
          })
          .where(eq(wallets.userId, userId))
          .returning();

        // Create clearance transaction record
        await tx
          .insert(walletTransactions)
          .values({
            walletId: currentWallet.id,
            userId,
            type: 'clearance',
            amount: Math.abs(currentBalance).toFixed(2),
            previousBalance: currentBalance.toFixed(2),
            newBalance: "0.00",
            description: currentBalance < 0 ? "Negative balance cleared by admin" : "Wallet balance cleared by admin",
            processedBy,
          });

        return clearedWallet;
      });
    } catch (error) {
      console.error("Error clearing wallet:", error);
      throw error;
    }
  }

  async getWalletTransactions(userId: string, limit: number = 50): Promise<WalletTransaction[]> {
    try {
      return await db
        .select({
          id: walletTransactions.id,
          walletId: walletTransactions.walletId,
          userId: walletTransactions.userId,
          type: walletTransactions.type,
          amount: walletTransactions.amount,
          previousBalance: walletTransactions.previousBalance,
          newBalance: walletTransactions.newBalance,
          description: walletTransactions.description,
          reference: walletTransactions.reference,
          referenceType: walletTransactions.referenceType,
          processedBy: walletTransactions.processedBy,
          createdAt: walletTransactions.createdAt,
          processedByUser: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          }
        })
        .from(walletTransactions)
        .leftJoin(users, eq(walletTransactions.processedBy, users.id))
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting wallet transactions:", error);
      return [];
    }
  }

  async getAllWallets(filters?: { 
    page?: number; 
    limit?: number; 
    minBalance?: number; 
    maxBalance?: number; 
  }): Promise<any[]> {
    try {
      const { page = 1, limit = 50, minBalance, maxBalance } = filters || {};
      const offset = (page - 1) * limit;

      let whereConditions = [];
      
      if (minBalance !== undefined) {
        whereConditions.push(gte(wallets.balance, minBalance.toString()));
      }
      
      if (maxBalance !== undefined) {
        whereConditions.push(lte(wallets.balance, maxBalance.toString()));
      }

      return await db
        .select({
          id: wallets.id,
          userId: wallets.userId,
          balance: wallets.balance,
          clearanceThreshold: wallets.clearanceThreshold,
          isActive: wallets.isActive,
          createdAt: wallets.createdAt,
          updatedAt: wallets.updatedAt,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            phone: users.phone,
            role: users.role,
          }
        })
        .from(wallets)
        .leftJoin(users, eq(wallets.userId, users.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(wallets.updatedAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error("Error getting all wallets:", error);
      return [];
    }
  }

  async updateWalletThreshold(userId: string, threshold: number): Promise<Wallet> {
    try {
      const [wallet] = await db
        .update(wallets)
        .set({ 
          clearanceThreshold: threshold.toFixed(2),
          updatedAt: new Date() 
        })
        .where(eq(wallets.userId, userId))
        .returning();
      
      if (!wallet) {
        throw new Error("Wallet not found");
      }
      
      return wallet;
    } catch (error) {
      console.error("Error updating wallet threshold:", error);
      throw error;
    }
  }

  async getWalletSettings(): Promise<WalletSettings | undefined> {
    try {
      const [settings] = await db
        .select()
        .from(walletSettings)
        .limit(1);
      return settings;
    } catch (error) {
      console.error("Error getting wallet settings:", error);
      return undefined;
    }
  }

  async updateWalletSettings(settings: Partial<InsertWalletSettings>, updatedBy: string): Promise<WalletSettings> {
    try {
      // Check if settings exist
      const existing = await this.getWalletSettings();
      
      if (existing) {
        const [updated] = await db
          .update(walletSettings)
          .set({ 
            ...settings, 
            updatedBy,
            updatedAt: new Date() 
          })
          .where(eq(walletSettings.id, existing.id))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(walletSettings)
          .values({ 
            ...settings, 
            updatedBy,
            updatedAt: new Date() 
          })
          .returning();
        return created;
      }
    } catch (error) {
      console.error("Error updating wallet settings:", error);
      throw error;
    }
  }

  async bulkApplyThreshold(threshold: number, excludeUserIds: string[] = []): Promise<number> {
    try {
      let whereCondition = eq(wallets.isActive, true);
      
      if (excludeUserIds.length > 0) {
        whereCondition = and(
          eq(wallets.isActive, true),
          ne(wallets.userId, excludeUserIds[0]) // Simple version for one exclusion
        ) as any;
      }

      const result = await db
        .update(wallets)
        .set({ 
          clearanceThreshold: threshold.toFixed(2),
          updatedAt: new Date() 
        })
        .where(whereCondition);

      // Count affected rows
      const affectedWallets = await db
        .select({ count: count() })
        .from(wallets)
        .where(whereCondition);

      return affectedWallets[0]?.count || 0;
    } catch (error) {
      console.error("Error bulk applying threshold:", error);
      throw error;
    }
  }

  // Helper method to create wallet for new users
  async ensureWalletExists(userId: string): Promise<Wallet> {
    let wallet = await this.getWallet(userId);
    
    if (!wallet) {
      // Get default threshold from settings
      const settings = await this.getWalletSettings();
      const defaultThreshold = settings?.defaultClearanceThreshold || "100.00";
      
      wallet = await this.createWallet({
        userId,
        balance: "0.00",
        clearanceThreshold: defaultThreshold,
        isActive: true,
      });
    }
    
    return wallet;
  }

  // Auto-clearance check - call this after processing orders/sales
  async checkAndClearWallet(userId: string, processedBy?: string): Promise<boolean> {
    try {
      const wallet = await this.getWallet(userId);
      if (!wallet) return false;

      const balance = parseFloat(wallet.balance || '0');
      const threshold = parseFloat(wallet.clearanceThreshold || '0');

      // Check if wallet should be cleared (negative balance reaching threshold)
      if (balance <= -threshold) {
        await this.clearWallet(userId, processedBy || 'system');
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking wallet clearance:", error);
      return false;
    }
  }

  // Agreement management operations
  async getAgreementTemplates(): Promise<AgreementTemplate[]> {
    return await db.select().from(agreementTemplates).orderBy(asc(agreementTemplates.type));
  }

  async getAgreementTemplate(type: string): Promise<AgreementTemplate | undefined> {
    const [template] = await db
      .select()
      .from(agreementTemplates)
      .where(eq(agreementTemplates.type, type as any));
    return template;
  }

  async updateAgreementTemplate(type: string, content: string, variables: Record<string, any>, updatedBy: string, changeReason?: string): Promise<AgreementTemplate> {
    // Get current template for history
    const currentTemplate = await this.getAgreementTemplate(type);
    
    if (currentTemplate) {
      // Save to history
      await db.insert(agreementHistory).values({
        templateId: currentTemplate.id,
        type: type as any,
        content: currentTemplate.content,
        variables: currentTemplate.variables as any,
        version: currentTemplate.version || 1,
        changeReason,
        changedBy: updatedBy,
      });
    }

    // Update template
    const [updatedTemplate] = await db
      .update(agreementTemplates)
      .set({
        content,
        variables: variables as any,
        version: currentTemplate ? (currentTemplate.version || 0) + 1 : 1,
        updatedAt: new Date(),
      })
      .where(eq(agreementTemplates.type, type as any))
      .returning();

    return updatedTemplate;
  }

  async getAgreementVariables(): Promise<AgreementVariable[]> {
    return await db.select().from(agreementVariables).orderBy(asc(agreementVariables.category), asc(agreementVariables.key));
  }

  async getAgreementVariable(key: string): Promise<AgreementVariable | undefined> {
    const [variable] = await db
      .select()
      .from(agreementVariables)
      .where(eq(agreementVariables.key, key));
    return variable;
  }

  async updateAgreementVariable(key: string, value: string, updatedBy: string): Promise<AgreementVariable> {
    const [updatedVariable] = await db
      .update(agreementVariables)
      .set({
        value,
        updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(agreementVariables.key, key))
      .returning();

    return updatedVariable;
  }

  async getProcessedAgreementContent(type: string): Promise<string> {
    const template = await this.getAgreementTemplate(type);
    if (!template) {
      throw new Error(`Agreement template not found: ${type}`);
    }

    const variables = await this.getAgreementVariables();
    const variableMap = variables.reduce((acc, variable) => {
      acc[variable.key] = variable.value;
      return acc;
    }, {} as Record<string, string>);

    // Replace all {{variableName}} placeholders in content
    let processedContent = template.content;
    Object.entries(variableMap).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(placeholder, value);
    });

    return processedContent;
  }

  async getAgreementHistory(templateId: string): Promise<AgreementHistory[]> {
    return await db
      .select()
      .from(agreementHistory)
      .where(eq(agreementHistory.templateId, templateId))
      .orderBy(desc(agreementHistory.createdAt));
  }

  // Promo code management operations
  async getPromoCodes(filters?: { isActive?: boolean; discountType?: string; usageType?: string }): Promise<PromoCode[]> {
    const conditions = [];
    
    if (filters) {
      if (filters.isActive !== undefined) {
        conditions.push(eq(promoCodes.isActive, filters.isActive));
      }
      if (filters.discountType) {
        conditions.push(eq(promoCodes.discountType, filters.discountType));
      }
      if (filters.usageType) {
        conditions.push(eq(promoCodes.usageType, filters.usageType));
      }
    }
    
    const query = db.select().from(promoCodes);
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(promoCodes.createdAt));
    }
    
    return await query.orderBy(desc(promoCodes.createdAt));
  }

  async getPromoCode(id: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.id, id));
    return promoCode;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | undefined> {
    const [promoCode] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, code));
    return promoCode;
  }

  async createPromoCode(promoCodeData: InsertPromoCode): Promise<PromoCode> {
    // Process the data to handle date strings and empty freeProductId
    const processedData = { ...promoCodeData };
    
    // Convert date strings to Date objects
    if (processedData.validFrom && typeof processedData.validFrom === 'string') {
      processedData.validFrom = new Date(processedData.validFrom);
    }
    if (processedData.validUntil && typeof processedData.validUntil === 'string') {
      processedData.validUntil = new Date(processedData.validUntil);
    }
    
    // Handle empty freeProductId - convert empty string to undefined (will be omitted)
    if (processedData.freeProductId === '') {
      delete processedData.freeProductId;
    }

    const [promoCode] = await db
      .insert(promoCodes)
      .values(processedData)
      .returning();
    return promoCode;
  }

  async updatePromoCode(id: string, updates: Partial<InsertPromoCode>): Promise<PromoCode | undefined> {
    // Process the updates to handle date strings and empty freeProductId
    const processedUpdates = { ...updates };
    
    // Convert date strings to Date objects
    if (processedUpdates.validFrom && typeof processedUpdates.validFrom === 'string') {
      processedUpdates.validFrom = new Date(processedUpdates.validFrom);
    }
    if (processedUpdates.validUntil && typeof processedUpdates.validUntil === 'string') {
      processedUpdates.validUntil = new Date(processedUpdates.validUntil);
    }
    
    // Handle empty freeProductId - convert empty string to undefined (will be omitted)
    if (processedUpdates.freeProductId === '') {
      delete processedUpdates.freeProductId;
    }

    const [promoCode] = await db
      .update(promoCodes)
      .set({ ...processedUpdates, updatedAt: new Date() })
      .where(eq(promoCodes.id, id))
      .returning();
    return promoCode;
  }

  async deletePromoCode(id: string): Promise<boolean> {
    const result = await db
      .delete(promoCodes)
      .where(eq(promoCodes.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Promo code usage tracking
  async recordPromoCodeUsage(usageData: InsertPromoCodeUsage): Promise<PromoCodeUsage> {
    const [usage] = await db
      .insert(promoCodeUsages)
      .values(usageData)
      .returning();
    return usage;
  }

  async getPromoCodeUsages(promoCodeId?: string, userId?: string): Promise<PromoCodeUsage[]> {
    const conditions = [];
    
    if (promoCodeId) {
      conditions.push(eq(promoCodeUsages.promoCodeId, promoCodeId));
    }
    if (userId) {
      conditions.push(eq(promoCodeUsages.userId, userId));
    }
    
    const query = db.select().from(promoCodeUsages);
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(promoCodeUsages.createdAt));
    }
    
    return await query.orderBy(desc(promoCodeUsages.createdAt));
  }

  async validatePromoCode(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; message: string; promoCode?: PromoCode }> {
    const promoCode = await this.getPromoCodeByCode(code);
    
    if (!promoCode) {
      return { valid: false, message: "Promo code not found" };
    }
    
    if (!promoCode.isActive) {
      return { valid: false, message: "Promo code is not active" };
    }
    
    const now = new Date();
    const validFrom = promoCode.validFrom ? new Date(promoCode.validFrom) : new Date();
    const validUntil = promoCode.validUntil ? new Date(promoCode.validUntil) : null;
    
    if (now < validFrom) {
      return { valid: false, message: "Promo code is not yet valid" };
    }
    
    if (validUntil && now > validUntil) {
      return { valid: false, message: "Promo code has expired" };
    }
    
    if (promoCode.maxUses && (promoCode.currentUses || 0) >= promoCode.maxUses) {
      return { valid: false, message: "Promo code usage limit exceeded" };
    }
    
    if (orderAmount < parseFloat(promoCode.minOrderValue || '0')) {
      return { valid: false, message: `Minimum order value of ₹${promoCode.minOrderValue} required` };
    }
    
    // Check user-specific usage limits
    const userUsages = await this.getPromoCodeUsages(promoCode.id, userId);
    if (promoCode.usageType === 'once' && userUsages.length > 0) {
      return { valid: false, message: "You have already used this promo code" };
    }
    
    if (promoCode.usageType === 'multiple' && userUsages.length >= (promoCode.maxUsesPerUser || 1)) {
      return { valid: false, message: `You have exceeded the maximum usage limit for this promo code (${promoCode.maxUsesPerUser} times)` };
    }
    
    return { valid: true, message: "Promo code is valid", promoCode };
  }

  async incrementPromoCodeUsage(promoCodeId: string): Promise<void> {
    await db
      .update(promoCodes)
      .set({ 
        currentUses: sql`${promoCodes.currentUses} + 1`,
        updatedAt: new Date()
      })
      .where(eq(promoCodes.id, promoCodeId));
  }

  async getActivePromoCodesForPOS(): Promise<PromoCode[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(promoCodes)
      .where(
        and(
          eq(promoCodes.isActive, true),
          or(
            eq(promoCodes.posOnly, true), // POS-only codes
            isNull(promoCodes.posOnly),   // null means general codes, usable in POS too
            eq(promoCodes.posOnly, false) // explicitly false means general codes
          ),
          lte(promoCodes.validFrom, now),
          or(
            isNull(promoCodes.validUntil),
            gte(promoCodes.validUntil, now)
          )
        )
      )
      .orderBy(asc(promoCodes.name));
  }

  // Push notification operations
  async savePushSubscription(userId: string, subscription: any): Promise<void> {
    // Store push subscription in user preferences or separate table
    // For now, we'll store it as JSON in user metadata
    const subscriptionData = JSON.stringify(subscription);
    
    // You can create a separate push_subscriptions table or store in user metadata
    // For simplicity, I'll add it to users table as a JSON field
    await db
      .update(users)
      .set({ 
        pushSubscription: subscriptionData,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async removePushSubscription(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        pushSubscription: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getPushSubscription(userId: string): Promise<{ userId: string; subscription: any } | null> {
    const [user] = await db
      .select({ 
        id: users.id, 
        pushSubscription: users.pushSubscription 
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.pushSubscription) {
      return null;
    }

    try {
      return {
        userId: user.id,
        subscription: JSON.parse(user.pushSubscription)
      };
    } catch (error) {
      console.error('Error parsing push subscription:', error);
      return null;
    }
  }

  async getPushSubscriptionsByRole(role: string): Promise<Array<{ userId: string; subscription: any }>> {
    const usersWithSubs = await db
      .select({ 
        id: users.id, 
        pushSubscription: users.pushSubscription 
      })
      .from(users)
      .where(
        and(
          eq(users.role, role),
          isNotNull(users.pushSubscription)
        )
      );

    return usersWithSubs
      .map(user => {
        try {
          return {
            userId: user.id,
            subscription: JSON.parse(user.pushSubscription!)
          };
        } catch (error) {
          console.error('Error parsing push subscription for user:', user.id);
          return null;
        }
      })
      .filter(Boolean) as Array<{ userId: string; subscription: any }>;
  }

  async getAllPushSubscriptions(): Promise<Array<{ userId: string; subscription: any }>> {
    const usersWithSubs = await db
      .select({ 
        id: users.id, 
        pushSubscription: users.pushSubscription 
      })
      .from(users)
      .where(isNotNull(users.pushSubscription));

    return usersWithSubs
      .map(user => {
        try {
          return {
            userId: user.id,
            subscription: JSON.parse(user.pushSubscription!)
          };
        } catch (error) {
          console.error('Error parsing push subscription for user:', user.id);
          return null;
        }
      })
      .filter(Boolean) as Array<{ userId: string; subscription: any }>;
  }

  async getAllUsersWithSubscriptions(): Promise<any[]> {
    // Get users with enhanced data for smart filtering
    const usersWithData = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
        pushSubscription: users.pushSubscription,
        createdAt: users.createdAt
      })
      .from(users)
      .where(isNotNull(users.pushSubscription));

    // Enhance with additional data
    const enhancedUsers = await Promise.all(
      usersWithData.map(async (user) => {
        // Get user's order statistics
        const orderStats = await db
          .select({
            totalOrders: sql<number>`count(*)`.as('totalOrders'),
            lastOrderDate: sql<string>`max(${orders.createdAt})`.as('lastOrderDate')
          })
          .from(orders)
          .where(eq(orders.userId, user.id))
          .then(([stats]) => stats || { totalOrders: 0, lastOrderDate: null });

        // Get primary address
        const [primaryAddress] = await db
          .select({ address: addresses.address })
          .from(addresses)
          .where(and(eq(addresses.userId, user.id), eq(addresses.isDefault, true)))
          .limit(1);

        return {
          ...user,
          walletBalance: '0.00', // Default wallet balance for display
          totalOrders: orderStats.totalOrders || 0,
          lastOrderDate: orderStats.lastOrderDate || null,
          primaryAddress: primaryAddress?.address || 'No address saved',
          cartItemCount: 0, // TODO: implement cart count if needed
          lastNotifiedAt: null
        };
      })
    );

    return enhancedUsers;
  }

  async updateUserLastNotified(userId: string): Promise<void> {
    // Update the lastNotifiedAt timestamp
    await db
      .update(users)
      .set({ 
        lastNotifiedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  async createDeliveryPartner(partnerData: {
    userId: string;
    name: string;
    phone: string;
    vehicleType: string | null;
    vehicleNumber: string | null;
    licenseNumber: string | null;
    isActive: boolean;
  }): Promise<any> {
    const [deliveryPartner] = await db
      .insert(deliveryPartners)
      .values({
        userId: partnerData.userId,
        vehicleType: partnerData.vehicleType || "bike",
        vehicleNumber: partnerData.vehicleNumber,
        licenseNumber: partnerData.licenseNumber,
        status: partnerData.isActive ? "active" : "inactive",
      })
      .returning();
    return deliveryPartner;
  }
}

export const storage = new DatabaseStorage();
