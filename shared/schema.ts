import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// OTP storage table for persistent verification codes
export const otps = pgTable("otps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contact: varchar("contact").notNull(), // email or phone
  otp: varchar("otp").notNull(), // the 4-digit code
  purpose: varchar("purpose").notNull(), // login, registration, password_reset, etc.
  contactType: varchar("contact_type").notNull(), // email or phone
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
},
(table) => [
  index("IDX_otp_contact").on(table.contact),
  index("IDX_otp_expires").on(table.expiresAt),
]);

// OTP rate limiting table for persistent security controls
export const otpRateLimits = pgTable("otp_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contact: varchar("contact").notNull(), // email or phone number
  contactType: varchar("contact_type").notNull(), // email or phone
  ipAddress: varchar("ip_address"), // IP address for additional protection
  userAgent: varchar("user_agent"), // User agent for device tracking
  requestCount: integer("request_count").notNull().default(1),
  windowStart: timestamp("window_start").notNull(), // Start of current rate limit window
  lastRequestAt: timestamp("last_request_at").notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until"), // When the contact is blocked until (for progressive penalties)
  purpose: varchar("purpose").notNull(), // login, registration, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
},
(table) => [
  index("IDX_otp_rate_limit_contact").on(table.contact),
  index("IDX_otp_rate_limit_ip").on(table.ipAddress),
  index("IDX_otp_rate_limit_window").on(table.windowStart),
  index("IDX_otp_rate_limit_blocked").on(table.blockedUntil),
]);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  phone: varchar("phone").unique(),
  password: varchar("password"), // Hashed password for login
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  profilePictureUrl: varchar("profile_picture_url"), // For uploaded profile pictures
  role: varchar("role").notNull().default("customer"), // customer, vendor, admin, delivery, pos
  isEmailVerified: boolean("is_email_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),  
  isActive: boolean("is_active").default(true),
  pushSubscription: text("push_subscription"), // JSON string of push subscription data
  lastNotifiedAt: timestamp("last_notified_at"), // Track when user was last sent a notification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendor profiles
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  businessName: varchar("business_name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // dairy, grocery, bakery, etc.
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  pincode: varchar("pincode").notNull(),
  gstNumber: varchar("gst_number"),
  license: varchar("license"),
  status: varchar("status").default("pending"), // pending, approved, rejected, suspended
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalOrders: integer("total_orders").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  isActive: boolean("is_active").default(true),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18.00"), // GST percentage (0-100)
  gstType: varchar("gst_type").default("taxable"), // "exempt", "zero_rated", "taxable"
  createdAt: timestamp("created_at").defaultNow(),
});

// Advertisements
export const advertisements = pgTable("advertisements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url").notNull(),
  linkUrl: varchar("link_url"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image database - tracks all images used in the system
export const images = pgTable("images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: varchar("url").notNull().unique(),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name"),
  mimeType: varchar("mime_type"),
  size: integer("size"), // file size in bytes
  width: integer("width"),
  height: integer("height"),
  altText: varchar("alt_text"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0), // how many entities use this image
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image usage tracking - tracks which entities use which images
export const imageUsage = pgTable("image_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageId: varchar("image_id").references(() => images.id).notNull(),
  entityType: varchar("entity_type").notNull(), // product, category, advertisement, user_profile
  entityId: varchar("entity_id").notNull(),
  usageType: varchar("usage_type").notNull(), // primary, gallery, thumbnail, banner
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Image cleanup tracking for orphaned images
export const imageCleanup = pgTable("image_cleanup", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageId: varchar("image_id").references(() => images.id).notNull(),
  reason: varchar("reason").notNull(), // orphaned, replaced, deleted_entity, expired
  scheduledDeletion: timestamp("scheduled_deletion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// OTP verification table
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone").notNull(),
  otp: varchar("otp").notNull(),
  purpose: varchar("purpose").notNull(), // signup, login, password_reset
  isUsed: boolean("is_used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Types for OTP rate limiting
export type OtpRateLimit = typeof otpRateLimits.$inferSelect;
export type InsertOtpRateLimit = typeof otpRateLimits.$inferInsert;

// Insert schemas for OTP rate limiting
export const insertOtpRateLimitSchema = createInsertSchema(otpRateLimits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOtpRateLimitType = z.infer<typeof insertOtpRateLimitSchema>;

// Admin settings table
export const adminSettings = pgTable("admin_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment QR codes
export const paymentQRCodes = pgTable("payment_qr_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  qrCodeUrl: varchar("qr_code_url").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  upiId: varchar("upi_id").notNull(),
  status: varchar("status").default("pending"), // pending, paid, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer reviews - Overall order experience
export const orderReviews = pgTable("order_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  customerName: varchar("customer_name").notNull(),
  overallRating: integer("overall_rating").notNull(), // 1-5 stars for overall experience
  overallReviewText: text("overall_review_text").notNull(),
  deliveryRating: integer("delivery_rating").notNull(), // 1-5 stars for delivery service
  deliveryReviewText: text("delivery_review_text"),
  orderValue: decimal("order_value", { precision: 10, scale: 2 }),
  isShortlisted: boolean("is_shortlisted").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product reviews - Individual product ratings
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  orderItemId: varchar("order_item_id").references(() => orderItems.id), // Allow null for specialInstructions items
  productId: varchar("product_id").references(() => products.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  customerName: varchar("customer_name").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars for this specific product
  reviewText: text("review_text"),
  isShortlisted: boolean("is_shortlisted").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Keep the old table for backward compatibility, but rename for clarity
export const customerReviews = orderReviews;

// Website statistics for trust indicators
export const websiteStats = pgTable("website_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statType: varchar("stat_type").notNull().unique(), // happy_customers, local_vendors, ontime_delivery, average_rating
  value: varchar("value").notNull(), // 10,000+, 50+, 99.9%, 5 Star
  label: varchar("label").notNull(), // Happy Customers, Local Vendors, etc.
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Products
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").references(() => vendors.id).notNull(),
  categoryId: varchar("category_id").references(() => categories.id).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit").notNull(), // kg, liter, piece, bundle
  imageUrl: varchar("image_url"),
  stock: integer("stock").default(0),
  minOrderQty: integer("min_order_qty").default(1),
  maxOrderQty: integer("max_order_qty"),
  isActive: boolean("is_active").default(true),
  isSubscriptionAvailable: boolean("is_subscription_available").default(false),
  // GST Configuration
  inheritCategoryGst: boolean("inherit_category_gst").default(true), // Use category GST or custom
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }), // Custom GST rate (overrides category if inheritCategoryGst is false)
  gstType: varchar("gst_type"), // Custom GST type (overrides category if inheritCategoryGst is false)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer addresses
export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // home, office, other
  address: text("address").notNull(),
  landmark: varchar("landmark"),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  pincode: varchar("pincode").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(),
  userId: varchar("user_id").references(() => users.id), // Allow null for guest orders
  vendorId: varchar("vendor_id").references(() => vendors.id),
  deliveryAddressId: varchar("delivery_address_id").references(() => addresses.id), // Allow null for guest orders
  deliveryPartnerId: varchar("delivery_partner_id").references(() => deliveryPartners.id),
  deliverySequence: integer("delivery_sequence"), // Sequence number for delivery partner's route
  assignedAt: timestamp("assigned_at"), // When delivery partner was assigned
  deliveredAt: timestamp("delivered_at"), // When order was actually delivered
  status: varchar("status").default("pending"), // pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, failed, refunded
  paymentMethod: varchar("payment_method"), // cash, card, upi, wallet, razorpay
  // Razorpay integration fields
  razorpayOrderId: varchar("razorpay_order_id"), // Razorpay order ID
  razorpayPaymentId: varchar("razorpay_payment_id"), // Razorpay payment ID after successful payment
  razorpaySignature: varchar("razorpay_signature"), // Razorpay signature for verification
  deliveryDate: timestamp("delivery_date"),
  deliveryTimeSlot: varchar("delivery_time_slot"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

// Delivery partners
export const deliveryPartners = pgTable("delivery_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  vehicleType: varchar("vehicle_type").notNull(), // bike, scooter, bicycle, car
  vehicleNumber: varchar("vehicle_number"),
  licenseNumber: varchar("license_number"),
  aadharNumber: varchar("aadhar_number"),
  panNumber: varchar("pan_number"),
  bankAccount: varchar("bank_account"),
  ifscCode: varchar("ifsc_code"),
  isOnline: boolean("is_online").default(false),
  currentLocation: text("current_location"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  lastLocationUpdate: timestamp("last_location_update").defaultNow(),
  status: varchar("status").default("active"), // active, inactive, suspended
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalDeliveries: integer("total_deliveries").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  vendorId: varchar("vendor_id").references(() => vendors.id).notNull(),
  name: varchar("name").notNull(),
  frequency: varchar("frequency").notNull(), // daily, weekly, monthly
  status: varchar("status").default("active"), // active, paused, cancelled
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  nextDeliveryDate: timestamp("next_delivery_date"),
  deliveryTimeSlot: varchar("delivery_time_slot"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription items
export const subscriptionItems = pgTable("subscription_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

// Delivery assignments
export const deliveries = pgTable("deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  deliveryPartnerId: varchar("delivery_partner_id").references(() => users.id),
  status: varchar("status").default("assigned"), // assigned, picked_up, in_transit, delivered, failed
  pickupTime: timestamp("pickup_time"),
  deliveryTime: timestamp("delivery_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  productId: varchar("product_id").references(() => products.id),
  orderId: varchar("order_id").references(() => orders.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// POS profiles
export const posProfiles = pgTable("pos_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  shopName: varchar("shop_name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  pincode: varchar("pincode").notNull(),
  contactNumber: varchar("contact_number"),
  gstNumber: varchar("gst_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// POS sales transactions
export const posSales = pgTable("pos_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleNumber: varchar("sale_number").notNull().unique(),
  posProfileId: varchar("pos_profile_id").references(() => posProfiles.id).notNull(),
  customerName: varchar("customer_name"),
  customerPhone: varchar("customer_phone"),
  customerAddress: text("customer_address"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method").notNull(), // cash, card, upi, other
  paymentStatus: varchar("payment_status").default("paid"), // paid, pending, partial
  soldBy: varchar("sold_by"), // device/computer name that made the sale
  soldByUser: varchar("sold_by_user"), // user name/email who made the sale
  notes: text("notes"),
  // Delivery assignment fields
  deliveryPartnerId: varchar("delivery_partner_id").references(() => deliveryPartners.id),
  deliverySequence: integer("delivery_sequence"),
  assignedAt: timestamp("assigned_at"),
  deliveryDate: timestamp("delivery_date"),
  deliveryTimeSlot: varchar("delivery_time_slot"),
  deliveryStatus: varchar("delivery_status").default("pending"), // pending, assigned, out_for_delivery, delivered
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// POS sale items
export const posSaleItems = pgTable("pos_sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posSaleId: varchar("pos_sale_id").references(() => posSales.id).notNull(),
  productId: varchar("product_id").references(() => products.id),
  productName: varchar("product_name").notNull(), // Store name in case product is deleted
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit"), // kg, liter, piece, bundle
});

// Notifications table for real notification system
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title").notNull(),
  body: text("body").notNull(),
  type: varchar("type").notNull(), // admin_broadcast, system, order_update, etc
  status: varchar("status").default("delivered"), // delivered, read, failed
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  vendor: one(vendors, { fields: [users.id], references: [vendors.userId] }),
  posProfile: one(posProfiles, { fields: [users.id], references: [posProfiles.userId] }),
  addresses: many(addresses),
  orders: many(orders),
  subscriptions: many(subscriptions),
  reviews: many(reviews),
  orderReviews: many(orderReviews),
  productReviews: many(productReviews),
  customerReviews: many(customerReviews), // backward compatibility
  notifications: many(notifications),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, { fields: [vendors.userId], references: [users.id] }),
  products: many(products),
  orders: many(orders),
  subscriptions: many(subscriptions),
  reviews: many(reviews),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  vendor: one(vendors, { fields: [products.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
  subscriptionItems: many(subscriptionItems),
  reviews: many(reviews),
  productReviews: many(productReviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [orders.vendorId], references: [vendors.id] }),
  deliveryAddress: one(addresses, { fields: [orders.deliveryAddressId], references: [addresses.id] }),
  orderItems: many(orderItems),
  delivery: one(deliveries),
  reviews: many(reviews),
  orderReviews: many(orderReviews),
  productReviews: many(productReviews),
  customerReviews: many(customerReviews), // backward compatibility
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [subscriptions.vendorId], references: [vendors.id] }),
  subscriptionItems: many(subscriptionItems),
}));

export const imagesRelations = relations(images, ({ one, many }) => ({
  uploadedByUser: one(users, { fields: [images.uploadedBy], references: [users.id] }),
  usage: many(imageUsage),
}));

export const imageUsageRelations = relations(imageUsage, ({ one }) => ({
  image: one(images, { fields: [imageUsage.imageId], references: [images.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const advertisementsRelations = relations(advertisements, ({ one }) => ({
  // No direct relations needed for now
}));

export const orderReviewsRelations = relations(orderReviews, ({ one }) => ({
  order: one(orders, { fields: [orderReviews.orderId], references: [orders.id] }),
  user: one(users, { fields: [orderReviews.userId], references: [users.id] }),
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  order: one(orders, { fields: [productReviews.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [productReviews.orderItemId], references: [orderItems.id] }),
  product: one(products, { fields: [productReviews.productId], references: [products.id] }),
  user: one(users, { fields: [productReviews.userId], references: [users.id] }),
}));

// Keep backward compatibility
export const customerReviewsRelations = orderReviewsRelations;

export const posProfilesRelations = relations(posProfiles, ({ one, many }) => ({
  user: one(users, { fields: [posProfiles.userId], references: [users.id] }),
  sales: many(posSales),
  rawMaterials: many(rawMaterials),
  stockEntries: many(stockEntries),
}));

export const posSalesRelations = relations(posSales, ({ one, many }) => ({
  posProfile: one(posProfiles, { fields: [posSales.posProfileId], references: [posProfiles.id] }),
  saleItems: many(posSaleItems),
}));

export const posSaleItemsRelations = relations(posSaleItems, ({ one }) => ({
  sale: one(posSales, { fields: [posSaleItems.posSaleId], references: [posSales.id] }),
  product: one(products, { fields: [posSaleItems.productId], references: [products.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  nextDeliveryDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  totalAmount: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

export const insertPosProfileSchema = createInsertSchema(posProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPosSaleSchema = createInsertSchema(posSales).omit({
  id: true,
  saleNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPosSaleItemSchema = createInsertSchema(posSaleItems).omit({
  id: true,
});

// Raw materials table for inventory management
export const rawMaterials = pgTable("raw_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posProfileId: varchar("pos_profile_id").references(() => posProfiles.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  unit: varchar("unit").notNull().default("kg"),
  currentStock: decimal("current_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  minimumStock: decimal("minimum_stock", { precision: 10, scale: 3 }).notNull().default("0"),
  buyingPrice: decimal("buying_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  supplier: varchar("supplier"),
  supplierContact: varchar("supplier_contact"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Raw material purchases/stock entries
export const stockEntries = pgTable("stock_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rawMaterialId: varchar("raw_material_id").references(() => rawMaterials.id, { onDelete: "cascade" }),
  posProfileId: varchar("pos_profile_id").references(() => posProfiles.id, { onDelete: "cascade" }),
  entryType: varchar("entry_type").notNull(), // "purchase", "adjustment", "usage"
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  invoiceNumber: varchar("invoice_number"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});

// Product recipes - link products to raw materials
export const productRecipes = pgTable("product_recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
  rawMaterialId: varchar("raw_material_id").references(() => rawMaterials.id, { onDelete: "cascade" }),
  quantityRequired: decimal("quantity_required", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertRawMaterialSchema = createInsertSchema(rawMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockEntrySchema = createInsertSchema(stockEntries).omit({
  id: true,
  createdAt: true,
});

export const insertProductRecipeSchema = createInsertSchema(productRecipes).omit({
  id: true,
  createdAt: true,
});

// Relations for new tables (defined after all table declarations)
export const rawMaterialsRelations = relations(rawMaterials, ({ one, many }) => ({
  posProfile: one(posProfiles, { fields: [rawMaterials.posProfileId], references: [posProfiles.id] }),
  stockEntries: many(stockEntries),
  productRecipes: many(productRecipes),
}));

export const stockEntriesRelations = relations(stockEntries, ({ one }) => ({
  rawMaterial: one(rawMaterials, { fields: [stockEntries.rawMaterialId], references: [rawMaterials.id] }),
  posProfile: one(posProfiles, { fields: [stockEntries.posProfileId], references: [posProfiles.id] }),
  createdBy: one(users, { fields: [stockEntries.createdBy], references: [users.id] }),
}));

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  product: one(products, { fields: [productRecipes.productId], references: [products.id] }),
  rawMaterial: one(rawMaterials, { fields: [productRecipes.rawMaterialId], references: [rawMaterials.id] }),
}));





// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Advertisement = typeof advertisements.$inferSelect;
export type OrderReview = typeof orderReviews.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type CustomerReview = OrderReview; // backward compatibility
export type Vendor = typeof vendors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ImageCleanup = typeof imageCleanup.$inferSelect;
export type PosProfile = typeof posProfiles.$inferSelect;
export type PosSale = typeof posSales.$inferSelect;
export type PosSaleItem = typeof posSaleItems.$inferSelect;

// Image insert schemas
export const insertImageSchema = createInsertSchema(images).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImageUsageSchema = createInsertSchema(imageUsage).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebsiteStatsSchema = createInsertSchema(websiteStats).omit({
  id: true,
  updatedAt: true,
});

export const insertOrderReviewSchema = createInsertSchema(orderReviews).omit({
  id: true,
  createdAt: true,
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerReviewSchema = insertOrderReviewSchema; // backward compatibility

// Wallet system
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),
  clearanceThreshold: decimal("clearance_threshold", { precision: 10, scale: 2 }).default("100.00"), // Individual threshold
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet transactions - all credit/debit activities
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // credit, debit, clearance, adjustment
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  reference: varchar("reference"), // order ID, POS sale ID, etc.
  referenceType: varchar("reference_type"), // order, pos_sale, manual_adjustment, clearance
  processedBy: varchar("processed_by").references(() => users.id), // admin who processed
  createdAt: timestamp("created_at").defaultNow(),
});

// Wallet settings - global configuration
export const walletSettings = pgTable("wallet_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  defaultClearanceThreshold: decimal("default_clearance_threshold", { precision: 10, scale: 2 }).default("100.00"),
  allowNegativeBalance: boolean("allow_negative_balance").default(true),
  autoClearanceEnabled: boolean("auto_clearance_enabled").default(true),
  maxNegativeLimit: decimal("max_negative_limit", { precision: 10, scale: 2 }), // Optional limit for negative balance
  notificationEnabled: boolean("notification_enabled").default(true),
  lowBalanceThreshold: decimal("low_balance_threshold", { precision: 10, scale: 2 }).default("10.00"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

// Relations for wallet system
export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [walletTransactions.processedBy],
    references: [users.id],
  }),
}));



// Insert schemas for wallet system
export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertWalletSettingsSchema = createInsertSchema(walletSettings).omit({
  id: true,
  updatedAt: true,
});



// Promo Code System
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  name: varchar("name").notNull(),
  description: text("description"),
  discountType: varchar("discount_type").notNull(), // "percentage", "fixed_amount", "free_delivery", "free_product"
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(), // percentage or rupee amount
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }).default("0"),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }), // cap for percentage discounts
  freeProductId: varchar("free_product_id").references(() => products.id), // for free product offers
  freeProductQuantity: integer("free_product_quantity").default(1),
  usageType: varchar("usage_type").notNull().default("once"), // "once", "multiple"
  maxUses: integer("max_uses"), // null for unlimited, number for limited uses
  currentUses: integer("current_uses").default(0),
  maxUsesPerUser: integer("max_uses_per_user").default(1), // how many times a user can use this code
  isActive: boolean("is_active").default(true),
  posOnly: boolean("pos_only").default(false), // true for POS-only promo codes
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  applicableCategories: text("applicable_categories").array(), // category IDs that this promo applies to
  applicableProducts: text("applicable_products").array(), // product IDs that this promo applies to
  excludedProducts: text("excluded_products").array(), // product IDs to exclude
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promo code usage tracking
export const promoCodeUsages = pgTable("promo_code_usages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").references(() => promoCodes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  posSaleId: varchar("pos_sale_id").references(() => posSales.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  usageSource: varchar("usage_source").notNull(), // "web", "pos"
  createdAt: timestamp("created_at").defaultNow(),
});

// Types
export type Wallet = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type WalletSettings = typeof walletSettings.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type InsertWalletSettings = z.infer<typeof insertWalletSettingsSchema>;

export type Image = typeof images.$inferSelect;
export type WebsiteStats = typeof websiteStats.$inferSelect;
export type ImageUsage = typeof imageUsage.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type InsertImageUsage = z.infer<typeof insertImageUsageSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertPosProfile = z.infer<typeof insertPosProfileSchema>;
export type InsertPosSale = z.infer<typeof insertPosSaleSchema>;
export type InsertPosSaleItem = z.infer<typeof insertPosSaleItemSchema>;
export type RawMaterial = typeof rawMaterials.$inferSelect;
export type StockEntry = typeof stockEntries.$inferSelect;
export type ProductRecipe = typeof productRecipes.$inferSelect;
export type InsertRawMaterial = z.infer<typeof insertRawMaterialSchema>;
export type InsertStockEntry = z.infer<typeof insertStockEntrySchema>;
export type InsertProductRecipe = z.infer<typeof insertProductRecipeSchema>;
export type InsertWebsiteStats = z.infer<typeof insertWebsiteStatsSchema>;
export type InsertCustomerReview = z.infer<typeof insertCustomerReviewSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type InsertPromoCodeUsage = z.infer<typeof insertPromoCodeUsageSchema>;

// Agreements Management System
export const agreementTypes = pgEnum("agreement_type", [
  "terms_conditions",
  "privacy_policy", 
  "shipping_policy",
  "cancellation_refunds",
  "contact_us"
]);

// Agreement templates - base templates with variables
export const agreementTemplates = pgTable("agreement_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: agreementTypes("type").notNull().unique(),
  name: varchar("name").notNull(),
  description: text("description"),
  content: text("content").notNull(), // Template content with {{variables}}
  variables: jsonb("variables").default('{}'), // {"companyName": "AMRIT DAIRY", "freeShippingAmount": "500"}
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agreement variables - configurable values
export const agreementVariables = pgTable("agreement_variables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // "companyName", "freeShippingAmount", "serviceAreas"
  label: varchar("label").notNull(), // "Company Name", "Free Shipping Amount", "Service Areas"
  value: text("value").notNull(), // actual value
  type: varchar("type").notNull().default("text"), // text, number, array, html
  description: text("description"),
  category: varchar("category").default("general"), // general, shipping, contact, policies
  isRequired: boolean("is_required").default(true),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agreement history - track changes
export const agreementHistory = pgTable("agreement_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => agreementTemplates.id, { onDelete: "cascade" }),
  type: agreementTypes("type").notNull(),
  content: text("content").notNull(),
  variables: jsonb("variables").notNull(),
  version: integer("version").notNull(),
  changeReason: text("change_reason"),
  changedBy: varchar("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for agreements
export const agreementTemplatesRelations = relations(agreementTemplates, ({ one, many }) => ({
  createdBy: one(users, { fields: [agreementTemplates.createdBy], references: [users.id] }),
  history: many(agreementHistory),
}));

export const agreementVariablesRelations = relations(agreementVariables, ({ one }) => ({
  updatedBy: one(users, { fields: [agreementVariables.updatedBy], references: [users.id] }),
}));

export const agreementHistoryRelations = relations(agreementHistory, ({ one }) => ({
  template: one(agreementTemplates, { fields: [agreementHistory.templateId], references: [agreementTemplates.id] }),
  changedBy: one(users, { fields: [agreementHistory.changedBy], references: [users.id] }),
}));

// Insert schemas
export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgreementVariableSchema = createInsertSchema(agreementVariables).omit({
  id: true,
  updatedAt: true,
});

export const insertAgreementHistorySchema = createInsertSchema(agreementHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;
export type AgreementVariable = typeof agreementVariables.$inferSelect;
export type AgreementHistory = typeof agreementHistory.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type InsertAgreementVariable = z.infer<typeof insertAgreementVariableSchema>;
export type InsertAgreementHistory = z.infer<typeof insertAgreementHistorySchema>;

// Promo code relations (defined after all table declarations)
export const promoCodesRelations = relations(promoCodes, ({ one, many }) => ({
  freeProduct: one(products, { fields: [promoCodes.freeProductId], references: [products.id] }),
  createdBy: one(users, { fields: [promoCodes.createdBy], references: [users.id] }),
  usages: many(promoCodeUsages),
}));

export const promoCodeUsagesRelations = relations(promoCodeUsages, ({ one }) => ({
  promoCode: one(promoCodes, { fields: [promoCodeUsages.promoCodeId], references: [promoCodes.id] }),
  user: one(users, { fields: [promoCodeUsages.userId], references: [users.id] }),
  order: one(orders, { fields: [promoCodeUsages.orderId], references: [orders.id] }),
  posSale: one(posSales, { fields: [promoCodeUsages.posSaleId], references: [posSales.id] }),
}));

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  currentUses: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPromoCodeUsageSchema = createInsertSchema(promoCodeUsages).omit({
  id: true,
  createdAt: true,
});
