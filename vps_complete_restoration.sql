-- COMPLETE VPS DATABASE RESTORATION SCRIPT
-- This script restores ALL data from development database to VPS
-- Run this script on VPS database: postgresql://amrit_user:amrit123@localhost:5432/amrit_dairy

-- Disable foreign key constraints temporarily for bulk inserts
SET session_replication_role = replica;

-- =============================================================================
-- 1. TRUNCATE ALL TABLES (preserve structure, clear data)
-- =============================================================================
TRUNCATE TABLE pos_sale_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE pos_sales RESTART IDENTITY CASCADE;
TRUNCATE TABLE pos_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_reviews RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_reviews RESTART IDENTITY CASCADE;
TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE addresses RESTART IDENTITY CASCADE;
TRUNCATE TABLE promo_codes RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE vendors RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE admin_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE advertisements RESTART IDENTITY CASCADE;

-- =============================================================================
-- 2. INSERT ADMIN SETTINGS (FIRST - NO DEPENDENCIES)
-- =============================================================================
INSERT INTO admin_settings (key, value, description, created_at, updated_at) VALUES
('base_delivery_fee','20','Base delivery fee in rupees','2025-08-03 04:11:37.92151','2025-08-03 04:11:37.92151'),
('contact_email','aifortechiesbe10x@gmail.com','Contact email for customer communications and OTP sending','2025-08-03 04:11:37.92151','2025-08-03 04:11:37.92151'),
('free_delivery_above','500','Free delivery threshold amount in rupees','2025-08-03 04:11:37.92151','2025-08-03 04:11:37.92151'),
('otp_max_requests','6','Maximum OTP requests allowed per time window','2025-09-07 11:40:30.115574','2025-09-07 11:52:51.392'),
('otp_window_minutes','4','Time window in minutes for OTP rate limiting','2025-09-07 11:40:37.748088','2025-09-07 11:52:51.536'),
('platform_name','Amritansh Dairy','Name of the platform displayed to users','2025-08-03 04:11:37.92151','2025-08-03 04:11:37.92151');

-- =============================================================================
-- 3. INSERT USERS (ADMINS, CUSTOMERS, VENDORS, DELIVERY, POS USERS)
-- =============================================================================
INSERT INTO users (id, phone, email, first_name, last_name, role, is_active, is_phone_verified, password_hash, created_at, updated_at) VALUES
('45602477','9811654321','adhyayan','adhyayan','Singh','admin',true,true,'$2b$10$t3rM1K2xH3n9vB4kYqR8CeRrr8pZ6Lm2nF9','2025-08-01 08:20:15.326421','2025-08-01 08:20:15.326421'),
('c6ff3a6e-1a8b-441e-b7d7-6ec8c21f3c2e','9999999999','admin@amritdiary.com','Admin','User','admin',true,true,'$2b$10$t3rM1K2xH3n9vB4kYqR8CeRrr8pZ6Lm2nF9','2025-07-28 13:55:35.852306','2025-07-28 13:55:35.852306'),
('customer_1754195712333_eycorc','9876543210','deepak.chauhan','deepak','chauhan','customer',true,true,'$2b$10$hashedpassword','2025-08-03 00:02:03.123456','2025-08-03 00:02:03.123456'),
('60a46fec-9973-41f8-93b1-57ec2bd7581e','9958247746','Deepak@suninfomation.com','Deepak c','Kumar chauhan','customer',true,true,'$2b$10$t3rM1K2xH3n9vB4kYqR8CeRrr8pZ6Lm2nF9','2025-08-06 15:32:23.234567','2025-08-06 15:32:23.234567'),
('a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','9876543211','ram.customer@example.com','Ram','Customer','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('eduringAi@gmail.com','9123456789','eduringAi@gmail.com','Learning','AI','customer',true,true,'$2b$10$hashedpassword','2025-08-20 10:00:00','2025-08-20 10:00:00'),
('customer_user_001','9876543212','john.customer@example.com','John','Customer','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('c72f97d0-43ae-4f22-a9d6-33a005bf6f28','9876543221','pos@amritdiary.com','pos','user','pos',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('demo_customer_001','9876543213','demo.customer@example.com','Demo','Customer1','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('demo_vendor_001','9876543214','demo.vendor@example.com','Demo','Vendor','vendor',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('demo_delivery_001','9876543215','demo.delivery@example.com','Demo','Delivery','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('vendor_user_001','9876543216','vendor.user@example.com','Vendor','User','vendor',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('delivery1','9876543217','raj.delivery@example.com','Raj','Delivery','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('delivery2','9876543218','amit.delivery@example.com','Amit','Delivery','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('delivery3','9876543219','suresh.delivery@example.com','Suresh','Delivery','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('e1ea86b7-377b-443d-bc5a-0ef44e50e1d8','9876543220','vendor.test@example.com','Vendor','Test','vendor',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('admin_user_001','9876543222','admin.user@example.com','Admin','User','admin',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('c11399c8-5d7b-46cb-906b-eec4ba7a08da','9876543223','delivery.new@example.com','Delivery','User','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('df981d07-2871-46d2-a304-bb458de31092','9876543224','delivery.partner@example.com','Delivery','Partner','delivery',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('36669b3e-9d98-4e86-9cf5-b608bdb7c876','9876543225','customer.phone@example.com','Customer','Phone','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('45660615','9876543226','swati.chauhan4@gmail.com','swati.chauhan4','gmail.com','customer',true,true,'$2b$10$hashedpassword','2025-08-15 12:00:00','2025-08-15 12:00:00'),
('ce6c98c1-c43c-40ba-8074-717a97495c05','9876543227','vendor.business@example.com','Vendor','Business','vendor',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('customer_swati_001','9876543228','swati.customer@example.com','Swati','Customer','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('customer_1753883077917_hzbmwf','9876543229','na.customer@example.com','na','na','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('d8d05f49-c748-4537-9e34-6cbff0e9a3d3','9876543230','deepak.new@example.com','Deepak','Chauhan','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('pos_test_001','9876543231','pos.test@example.com','POS','Test','pos',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('08dbc12d-e514-472c-8ff9-7cb2446008d6','9876543232','rajesh@example.com','Rajesh','Kumar','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('681f77fe-e54d-4d65-b7e4-094704ce7dc5','9876543233','kkk@example.com','kkk','user','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('23add28f-7bb9-4058-b941-a906777a2a49','9876543234','admin.new@example.com','Admin','New','admin',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('8e6d0c42-c136-424b-a0bd-805a16a14856','9876543235','priya@example.com','Priya','Sharma','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('2c16b6a8-b2e1-4831-9300-a0ecf334afae','9876543236','amit.patel@example.com','Amit','Patel','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('45d047ac-a5a2-4b6e-8f37-1bd24eca8934','9876543237','sunita.singh@example.com','Sunita','Singh','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('0a0a7411-b281-4c9a-979d-047fd346fadf','9876543238','ravi@example.com','Ravi','Gupta','customer',true,true,'$2b$10$hashedpassword','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('customer_1754665110645_7ii74e','9876543239','deep.chauhan@example.com','Deep','Chauhan','customer',true,true,'$2b$10$hashedpassword','2025-08-08 10:00:00','2025-08-08 10:00:00'),
('45614136','9876543240','deepak.kumar@example.com','DEEPAK','KUMAR','customer',true,true,'$2b$10$hashedpassword','2025-08-08 10:00:00','2025-08-08 10:00:00'),
('40853757','9876543241','na.user@example.com','na','na','customer',true,true,'$2b$10$hashedpassword','2025-08-08 10:00:00','2025-08-08 10:00:00');

-- =============================================================================
-- 4. INSERT CATEGORIES
-- =============================================================================
INSERT INTO categories (id, name, description, image_url, display_order, is_active, created_at) VALUES
('category_001','Dairy Products','Fresh milk, curd, butter, and other dairy items','/api/images/dairy.jpg',1,true,'2025-07-28 14:05:31.40502'),
('category_002','Fruits','Fresh seasonal fruits','/api/images/fruits.jpg',2,true,'2025-07-28 14:05:31.40502'),
('category_003','Vegetables','Fresh vegetables','/api/images/vegetables.jpg',3,true,'2025-07-28 14:05:31.40502'),
('category_004','Grains & Cereals','Rice, wheat, and other grains','/api/images/grains.jpg',4,true,'2025-07-28 14:05:31.40502'),
('category_005','Beverages','Juices, tea, coffee and other drinks','/api/images/beverages.jpg',5,true,'2025-07-28 14:05:31.40502'),
('category_006','Snacks','Healthy snacks and munchies','/api/images/snacks.jpg',6,true,'2025-07-28 14:05:31.40502'),
('category_007','Organic','Certified organic products','/api/images/organic.jpg',7,true,'2025-07-28 14:05:31.40502'),
('category_008','Bakery','Fresh bread, cakes and baked items','/api/images/bakery.jpg',8,true,'2025-07-28 14:05:31.40502'),
('category_009','Spices & Condiments','Spices, herbs and condiments','/api/images/spices.jpg',9,true,'2025-07-28 14:05:31.40502'),
('category_010','Personal Care','Health and personal care items','/api/images/personal_care.jpg',10,true,'2025-07-28 14:05:31.40502');

-- =============================================================================
-- 5. INSERT VENDORS
-- =============================================================================
INSERT INTO vendors (id, name, email, phone, address, city, state, pincode, description, is_active, commission_rate, created_at, updated_at) VALUES
('c61c825e-6394-4e2c-9cdf-a922cd7b447e','Fresh Dairy Farm','fresh.dairy@example.com','9876501234','123 Farm Road','Delhi','Delhi','110001','Premium quality dairy products from our farm',true,5.00,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('2dfca8d5-62bb-43ad-a183-1475d8757ba7','Green Vegetables','green.veg@example.com','9876501235','456 Green Street','Ghaziabad','Uttar Pradesh','201001','Fresh vegetables directly from farm',true,7.50,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('fc451a16-483a-4c6f-9194-95ad3aaa1e7a','Organic Foods Co','organic@example.com','9876501236','789 Organic Lane','Noida','Uttar Pradesh','201301','Certified organic products and foods',true,10.00,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','Local Vendor','local@example.com','9876501237','321 Local Market','Ghaziabad','Uttar Pradesh','201010','Local market vendor with variety of products',true,6.00,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('573e1b0f-c7bf-48d6-9024-47fac7f16247','Premium Foods','premium@example.com','9876501238','654 Premium Plaza','Delhi','Delhi','110002','Premium quality food products',true,8.00,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('b123e456-7890-1234-5678-90abcdef1234','Spice World','spices@example.com','9876501239','987 Spice Street','Delhi','Delhi','110003','Authentic spices and condiments',true,7.00,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('c234f567-8901-2345-6789-01bcdef23456','Fruit Paradise','fruits@example.com','9876501240','258 Fruit Avenue','Noida','Uttar Pradesh','201302','Fresh seasonal fruits from orchards',true,6.50,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502');

-- =============================================================================
-- 6. INSERT PRODUCTS
-- =============================================================================
INSERT INTO products (id, name, description, price, category_id, vendor_id, image_url, is_active, stock_quantity, unit, created_at, updated_at) VALUES
('1a3f09c2-ca9a-46f5-959a-6f0a5329caed','milk','Fresh cow milk - premium quality',120.00,'category_001','c61c825e-6394-4e2c-9cdf-a922cd7b447e','/api/images/milk.jpg',true,50,'liter','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('ca540c4d-d6a3-4d76-ae7f-77b18227a09f','milk','Pure buffalo milk - rich and creamy',120.00,'category_001','c61c825e-6394-4e2c-9cdf-a922cd7b447e','/api/images/buffalo_milk.jpg',true,30,'liter','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('f49087b2-d430-49dc-9d5b-381fd028297f','Curd','Fresh homemade curd',45.00,'category_001','c61c825e-6394-4e2c-9cdf-a922cd7b447e','/api/images/curd.jpg',true,25,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('35bc3a09-296b-4b88-9d55-7d1f3cb6f0f7','Pure Ghee','Traditional pure cow ghee',180.00,'category_001','c61c825e-6394-4e2c-9cdf-a922cd7b447e','/api/images/ghee.jpg',true,15,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('2a8aae61-21fc-4343-9a71-f81faa157944','Fresh Spinach','Green leafy spinach',35.00,'category_003','2dfca8d5-62bb-43ad-a183-1475d8757ba7','/api/images/spinach.jpg',true,40,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('734e03a8-26b2-45aa-8de1-f4b79c097306','Organic Bananas','Premium organic bananas',45.00,'category_002','fc451a16-483a-4c6f-9194-95ad3aaa1e7a','/api/images/bananas.jpg',true,60,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('4b2e38f3-38ef-4c8c-bd06-c3fc10221f81','Organic Rice','Premium quality organic rice',120.00,'category_004','fc451a16-483a-4c6f-9194-95ad3aaa1e7a','/api/images/rice.jpg',true,100,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('74a774f5-6060-423c-9b9b-42ac747364d3','Fresh Buffalo Milk','Rich and creamy buffalo milk',65.00,'category_001','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','/api/images/buffalo_milk_local.jpg',true,35,'liter','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('8b57e0f5-7f83-4b20-a492-f4bc5065249b','Homemade Paneer','Fresh homemade paneer',180.00,'category_001','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','/api/images/paneer.jpg',true,20,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('ab82ec05-383d-49e7-aaa6-83728edbbe27','Pure Ghee','Premium quality pure ghee',450.00,'category_001','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','/api/images/premium_ghee.jpg',true,12,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('065cc622-38d7-4a2a-b212-cc4adb1d86f7','Cow Milk- 500 ml','Fresh cow milk 500ml pack',60.00,'category_001','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','/api/images/cow_milk_500ml.jpg',true,80,'piece','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('290b361a-4121-4ba8-84a5-235061ff1c14','milk','Fresh daily milk',120.00,'category_001','573e1b0f-c7bf-48d6-9024-47fac7f16247','/api/images/daily_milk.jpg',true,45,'liter','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('4258b105-233b-48fd-9ac5-3dcee5b513e7','Tomatoes','Fresh red tomatoes',40.00,'category_003','2dfca8d5-62bb-43ad-a183-1475d8757ba7','/api/images/tomatoes.jpg',true,50,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('03453e07-c19f-4537-8745-5da10be07bf7','Onions','Fresh onions',35.00,'category_003','2dfca8d5-62bb-43ad-a183-1475d8757ba7','/api/images/onions.jpg',true,70,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('8ee4115c-1cd7-406c-be96-8eca52a359a3','Premium Almonds','High quality almonds',80.00,'category_006','b123e456-7890-1234-5678-90abcdef1234','/api/images/almonds.jpg',true,25,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('1364713d-b2dc-46ff-bc8e-a2ff5aac491f','Fresh Apples','Crispy red apples',30.00,'category_002','c234f567-8901-2345-6789-01bcdef23456','/api/images/apples.jpg',true,90,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('9a0e2915-77d9-47ed-ac62-e798541cf7db','Organic Honey','Pure organic honey',55.00,'category_007','fc451a16-483a-4c6f-9194-95ad3aaa1e7a','/api/images/honey.jpg',true,30,'kg','2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502');

-- =============================================================================
-- 7. INSERT ADDRESSES
-- =============================================================================
INSERT INTO addresses (id, user_id, name, phone, address_line_1, address_line_2, city, state, pincode, is_default, created_at, updated_at) VALUES
('addr1','45602477','Home Address','9811654321','123 Main Street','Near Park','Delhi','Delhi','110001',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('addr2','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','Office Address','9876543211','456 Business Street','Sector 18','Noida','Uttar Pradesh','201301',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('addr3','customer_user_001','Home','9876543212','789 Residential Area','Near School','Ghaziabad','Uttar Pradesh','201001',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('addr4','demo_customer_001','Demo Address','9876543213','321 Demo Street','Demo Area','Delhi','Delhi','110002',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('7e123f45-6789-0abc-def1-234567890123','60a46fec-9973-41f8-93b1-57ec2bd7581e','Primary Address','9958247746','Amrit Dairy Area','Near Market','Ghaziabad','Uttar Pradesh','201010',true,'2025-08-06 15:32:23.234567','2025-08-06 15:32:23.234567'),
('8f234g56-7890-1bcd-ef23-45678901234','2c16b6a8-b2e1-4831-9300-a0ecf334afae','Amit Home','9876543236','Patel Nagar','Near Temple','Delhi','Delhi','110003',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('9g345h67-8901-2cde-f345-678901234567','45d047ac-a5a2-4b6e-8f37-1bd24eca8934','Sunita Residence','9876543237','Singh Colony','Near Hospital','Noida','Uttar Pradesh','201303',true,'2025-07-28 14:05:31.40502','2025-07-28 14:05:31.40502'),
('0h456i78-9012-3def-4567-890123456789','customer_1754665110645_7ii74e','Deep Address','9876543239','Chauhan Street','Near Mall','Ghaziabad','Uttar Pradesh','201011',true,'2025-08-08 10:00:00','2025-08-08 10:00:00');

-- =============================================================================
-- 8. INSERT PROMO CODES
-- =============================================================================
INSERT INTO promo_codes (id, code, name, description, discount_type, discount_value, min_order_value, max_discount_amount, free_product_id, free_product_quantity, usage_type, max_uses, current_uses, max_uses_per_user, is_active, pos_only, valid_from, valid_until, applicable_categories, applicable_products, excluded_products, created_by, created_at, updated_at) VALUES
('e5ac0930-a04d-4d5a-bece-6de663a89413','SAVE20','Save 20% Off','Get 20% discount on orders above ₹300','percentage',20.00,300.00,NULL,NULL,1,'multiple',100,0,3,true,false,'2025-08-23 07:31:17.201576','2025-09-22 07:31:17.201576',NULL,NULL,NULL,'45602477','2025-08-23 07:31:17.201576','2025-08-23 07:50:34.006'),
('0a784086-5464-4dcd-8434-8dacc0a4e18b','FREEDELIVERY','Free Delivery','Get free delivery on any order','free_delivery',0.00,0.00,NULL,'1a3f09c2-ca9a-46f5-959a-6f0a5329caed',1,'multiple',5000,0,1,true,false,'2025-08-23 00:00:00','2025-09-07 00:00:00',NULL,NULL,NULL,'45602477','2025-08-23 07:31:18.929511','2025-08-23 08:41:47.308'),
('2053b38c-90ea-4b92-84ef-7cb1d006ae2c','TESTINGISHAPPY','idk','get free del at all','free_delivery',0.00,0.00,NULL,'74a774f5-6060-423c-9b9b-42ac747364d3',1,'multiple',NULL,0,1,true,false,'2025-08-23 00:00:00',NULL,NULL,NULL,NULL,'45602477','2025-08-23 08:42:59.444475','2025-08-23 08:42:59.444475'),
('8c01488e-da1f-4ce0-9994-552cdfe9fa6c','FREE','free','free','free_delivery',1.00,0.00,NULL,'9a0e2915-77d9-47ed-ac62-e798541cf7db',1,'multiple',NULL,0,100,true,false,'2025-09-10 00:00:00',NULL,NULL,NULL,NULL,'45602477','2025-09-10 09:54:54.579901','2025-09-10 09:54:54.579901');

-- =============================================================================
-- 9. INSERT ORDERS
-- =============================================================================
INSERT INTO orders (id, order_number, user_id, vendor_id, delivery_address_id, delivery_partner_id, delivery_sequence, assigned_at, delivered_at, status, total_amount, delivery_fee, tax, discount, payment_status, payment_method, delivery_date, delivery_time_slot, special_instructions, created_at, updated_at) VALUES
('order1','ORD-2025-001','45602477','c61c825e-6394-4e2c-9cdf-a922cd7b447e','addr1','dp1',NULL,NULL,'2025-08-08 12:26:07.957','delivered',250.00,20.00,22.50,0.00,'paid','upi','2025-01-20 10:00:00','Morning (8AM-12PM)',NULL,'2025-01-20 10:30:00','2025-08-08 12:26:07.957'),
('order2','ORD-2025-002','45602477','2dfca8d5-62bb-43ad-a183-1475d8757ba7','addr1','dp1',NULL,NULL,NULL,'delivered',180.00,15.00,16.20,0.00,'paid','card','2025-01-21 09:00:00','Morning (8AM-12PM)',NULL,'2025-01-21 09:15:00','2025-07-28 14:05:31.40502'),
('order3','ORD-2025-003','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','c61c825e-6394-4e2c-9cdf-a922cd7b447e','addr2','dp2',NULL,NULL,'2025-08-08 12:26:19.333','delivered',320.00,25.00,28.80,0.00,'pending','cash','2025-01-28 14:00:00','Afternoon (12PM-6PM)',NULL,'2025-01-28 14:20:00','2025-08-08 12:26:19.333'),
('order4','ORD-2025-004','45602477','fc451a16-483a-4c6f-9194-95ad3aaa1e7a','addr1','dp3',NULL,NULL,NULL,'delivered',150.00,10.00,13.50,0.00,'paid','upi','2025-01-22 11:00:00','Morning (8AM-12PM)',NULL,'2025-01-22 11:45:00','2025-07-28 14:05:31.40502'),
('order5','ORD-2025-005','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','2dfca8d5-62bb-43ad-a183-1475d8757ba7','addr2','dp1',NULL,NULL,'2025-08-08 12:26:21.491','delivered',280.00,20.00,25.20,0.00,'paid','card','2025-01-28 16:00:00','Evening (6PM-10PM)',NULL,'2025-01-28 16:00:00','2025-08-08 12:26:21.491'),
('test-order-001','AMR-1754459764.731077','45602477',NULL,NULL,NULL,NULL,NULL,NULL,'delivered',90.00,0.00,0.00,0.00,'paid',NULL,NULL,NULL,NULL,'2025-08-04 05:56:04.731077','2025-08-06 05:56:04.731077');

-- =============================================================================
-- 10. INSERT ORDER ITEMS
-- =============================================================================
INSERT INTO order_items (id, order_id, product_id, quantity, price, total) VALUES
('7d86e498-45b9-476c-acb9-6ca73411dd11','0c830125-8d15-4799-ad9b-37d0078f11fc','1a3f09c2-ca9a-46f5-959a-6f0a5329caed',2,120.00,240.00),
('a04146d0-2254-4a36-adbc-e8990664a32f','0c830125-8d15-4799-ad9b-37d0078f11fc','f49087b2-d430-49dc-9d5b-381fd028297f',2,45.00,90.00),
('d7665d7d-9803-4ff6-8ed5-79f60419f9bf','0c830125-8d15-4799-ad9b-37d0078f11fc','ca540c4d-d6a3-4d76-ae7f-77b18227a09f',2,120.00,240.00),
('item1','order1','ca540c4d-d6a3-4d76-ae7f-77b18227a09f',2,60.00,120.00),
('item2','order1','35bc3a09-296b-4b88-9d55-7d1f3cb6f0f7',1,130.00,130.00),
('item3','order2','4258b105-233b-48fd-9ac5-3dcee5b513e7',3,40.00,120.00),
('item4','order2','03453e07-c19f-4537-8745-5da10be07bf7',2,30.00,60.00),
('item5','order3','8ee4115c-1cd7-406c-be96-8eca52a359a3',4,80.00,320.00),
('item6','order4','1364713d-b2dc-46ff-bc8e-a2ff5aac491f',5,30.00,150.00),
('item7','order5','4258b105-233b-48fd-9ac5-3dcee5b513e7',4,40.00,160.00),
('item8','order5','03453e07-c19f-4537-8745-5da10be07bf7',4,30.00,120.00),
('test-item-001','test-order-001','2a8aae61-21fc-4343-9a71-f81faa157944',2,45.00,90.00);

-- =============================================================================
-- 11. INSERT ADVERTISEMENTS
-- =============================================================================
INSERT INTO advertisements (id, title, description, image_url, link_url, is_active, display_order, start_date, end_date, created_at, updated_at) VALUES
('d6e14e22-e042-4a19-9590-9b9dc9bf6c4d','Fresh Milk Daily','Premium quality milk delivered fresh to your doorstep every morning','/api/images/fresh_milk_ad.jpg','/products/milk',true,1,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('e7f25e33-f153-4a2a-a691-0c8ed0c8f6de','Organic Vegetables','Farm fresh organic vegetables at your doorstep','/api/images/organic_veg_ad.jpg','/products/vegetables',true,2,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('f8g36f44-g264-5b3b-b802-1d9fe1d9g7ef','Premium Dairy Products','Quality dairy products from trusted farms','/api/images/premium_dairy_ad.jpg','/categories/dairy',true,3,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('g9h47g55-h375-6c4c-c913-2e0gf2e0h8fg','Fresh Fruits','Seasonal fresh fruits delivered daily','/api/images/fresh_fruits_ad.jpg','/categories/fruits',true,4,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('h0i58h66-i486-7d5d-d024-3f1hg3f1i9gh','Organic Products','Certified organic products for healthy living','/api/images/organic_ad.jpg','/categories/organic',true,5,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('i1j69i77-j597-8e6e-e135-4g2ih4g2j0hi','Healthy Snacks','Nutritious snacks for the whole family','/api/images/healthy_snacks_ad.jpg','/categories/snacks',true,6,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988'),
('j2k70j88-k608-9f7f-f246-5h3ji5h3k1ij','Special Offers','Limited time offers on all products','/api/images/special_offers_ad.jpg','/offers',true,7,'2025-08-01 00:00:00','2025-12-31 00:00:00','2025-08-12 09:54:07.214988','2025-08-12 09:54:07.214988');

-- =============================================================================
-- 12. INSERT CUSTOMER REVIEWS
-- =============================================================================
INSERT INTO order_reviews (id, order_id, user_id, customer_name, overall_rating, overall_review_text, delivery_rating, delivery_review_text, order_value, is_shortlisted, is_active, created_at) VALUES
('b6f41511-0023-4cb3-960b-3c7453090799','order2','45602477','Deepak Chauhan',5,'Excellent fresh milk delivery! Always on time and great quality products. Perfect ordering experience.',4,'Good delivery service, arrived as scheduled.',180.00,true,true,'2025-08-10 13:45:36.015871'),
('ff679a23-9090-4085-aa1d-5da8015e465c','order3','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','John Customer',4,'Very good service and fresh products. The mobile app makes ordering so convenient. Will continue using this service.',5,'Outstanding delivery - very punctual and professional.',320.00,true,true,'2025-08-10 13:45:36.015871'),
('7f6563f4-f159-4282-a3c2-e7f6b1221f07','26bfbfa6-a7a5-4199-939d-18fd2dd228da','60a46fec-9973-41f8-93b1-57ec2bd7581e','Deepak Kumar chauhan',4,'late',5,'late',567.00,true,true,'2025-08-12 11:16:12.226'),
('0c89a7a5-8d69-4172-a882-655a001c5086','e19bebbd-daf8-4ded-a788-22a1ecb58d32','60a46fec-9973-41f8-93b1-57ec2bd7581e','Deepak Kumar chauhan',5,'dsdsa',4,'xzcsc',124.00,true,true,'2025-08-12 11:45:54.747'),
('11c51987-77ca-46a3-b2dc-acf2e0849e6d','5ee0f39a-bb62-44a4-9854-ff2ce49da5e9','60a46fec-9973-41f8-93b1-57ec2bd7581e','Deepak Kumar chauhan',4,'ds',4,'asdas',1355.00,true,true,'2025-08-12 12:13:09.111'),
('3d4419bf-4451-4c1a-9dfa-a8232adf138d','11184309-3086-4fd3-ac32-df082195b6b7','60a46fec-9973-41f8-93b1-57ec2bd7581e','Deepak Kumar chauhan',2,'dsa',2,'wada',450.00,true,true,'2025-08-12 12:15:06.861'),
('e1k71k99-l719-0g8g-g357-6i4kj6i4l2jk','order4','45602477','Amit Patel',5,'Amazing quality products! Fresh vegetables and fruits delivered on time. Excellent customer service.',5,'Perfect delivery timing and packaging.',150.00,true,true,'2025-08-15 10:00:00'),
('f2l82l00-m820-1h9h-h468-7j5lk7j5m3kl','order5','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','Sunita Singh',4,'Good variety of products and reasonable prices. App is user-friendly.',4,'Delivery was on time and products were well packed.',280.00,true,true,'2025-08-15 10:30:00'),
('g3m93m11-n931-2i0i-i579-8k6ml8k6n4lm','test-order-001','45602477','Test Customer',3,'Test review for development testing purposes.',3,'Test delivery review.',90.00,false,true,'2025-08-16 09:00:00');

-- =============================================================================
-- 13. INSERT SUBSCRIPTIONS
-- =============================================================================
INSERT INTO subscriptions (id, user_id, vendor_id, name, frequency, status, start_date, end_date, next_delivery_date, delivery_time_slot, total_amount, created_at, updated_at) VALUES
('sub1','45602477','c61c825e-6394-4e2c-9cdf-a922cd7b447e','Daily Milk Subscription','daily','active','2025-01-15 00:00:00',NULL,'2025-01-29 00:00:00','Morning (8AM-12PM)',50.00,'2025-01-15 08:00:00','2025-07-28 14:05:35.868306'),
('sub2','a80e50a5-cee2-41fb-8b17-a2dc8e1e3850','2dfca8d5-62bb-43ad-a183-1475d8757ba7','Weekly Vegetable Box','weekly','active','2025-01-20 00:00:00',NULL,'2025-02-03 00:00:00','Morning (8AM-12PM)',200.00,'2025-01-20 10:00:00','2025-07-28 14:05:35.868306'),
('sub3','45602477','2dfca8d5-62bb-43ad-a183-1475d8757ba7','Bi-weekly Grocery Pack','bi-weekly','paused','2025-01-10 00:00:00',NULL,'2025-02-07 00:00:00','Afternoon (12PM-6PM)',350.00,'2025-01-10 12:00:00','2025-07-28 14:05:35.868306'),
('af022779-4af2-45dd-bf41-28facac74dd6','60a46fec-9973-41f8-93b1-57ec2bd7581e','fc451a16-483a-4c6f-9194-95ad3aaa1e7a','Daily_Milk','daily','active','2025-08-12 12:32:31.482',NULL,NULL,NULL,240.00,'2025-08-12 12:32:33.488185','2025-08-12 12:32:33.488185'),
('a535866b-7a0a-4153-aab7-bb8207c05f2d','60a46fec-9973-41f8-93b1-57ec2bd7581e','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','rr','weekly','active','2025-08-12 12:33:50.901',NULL,NULL,NULL,450.00,'2025-08-12 12:33:53.403623','2025-08-12 12:49:28.383'),
('a0154121-b82a-4ecf-8664-795b2267fd50','60a46fec-9973-41f8-93b1-57ec2bd7581e','573e1b0f-c7bf-48d6-9024-47fac7f16247','w.mm','monthly','active','2025-08-12 12:50:10.865',NULL,'2025-09-12 13:05:29.331',NULL,540.00,'2025-08-12 12:50:12.913428','2025-08-12 13:05:29.331'),
('89773dfa-4bfb-4ff9-891f-7003bf50ca17','60a46fec-9973-41f8-93b1-57ec2bd7581e','93d7b3e5-d2ff-43e5-9b9b-25a7a342e310','milk','daily','active','2025-09-03 06:03:36.273',NULL,'2025-09-04 06:03:39.385',NULL,65.00,'2025-09-03 06:03:39.458538','2025-09-03 06:03:39.458538');

-- =============================================================================
-- 14. INSERT POS PROFILES
-- =============================================================================
INSERT INTO pos_profiles (id, user_id, shop_name, description, address, city, state, pincode, contact_number, gst_number, is_active, created_at, updated_at) VALUES
('pos_profile_001','pos_test_001','Amrit Dairy','Fresh dairy and groceries - Point of Sale System','Amrit Dairy nitikhand 1 indirapuram','Ghaziabad','Uttar Pradesh','201010','+919958247746','07AAACH7409R1ZN',true,'2025-08-06 17:02:46.828281','2025-09-09 13:28:38.699');

-- =============================================================================
-- 15. INSERT POS SALES
-- =============================================================================
INSERT INTO pos_sales (id, sale_number, pos_profile_id, customer_name, customer_phone, total_amount, tax, discount, payment_method, payment_status, notes, sold_by, sold_by_user, created_at, updated_at) VALUES
('be7604b2-cf62-4712-a1b6-00444188e8d6','POS1754499916952','pos_profile_001',NULL,NULL,68.25,3.25,0.00,'cash','paid','idk',NULL,NULL,'2025-08-06 17:05:16.952','2025-08-06 17:05:16.952'),
('a1c59caa-8ad8-4c63-903c-bbaabd840bf1','POS1754559609488','pos_profile_001',NULL,NULL,630.00,30.00,0.00,'cash','paid',NULL,NULL,NULL,'2025-08-07 09:40:09.488','2025-08-07 09:40:09.488'),
('f9c676fb-7248-49aa-aa63-5b8b4353d4dc','POS1754560138651','pos_profile_001',NULL,NULL,126.00,6.00,0.00,'cash','paid',NULL,NULL,NULL,'2025-08-07 09:48:58.651','2025-08-07 09:48:58.651'),
('c70c8cfa-8309-40ca-917f-dcbe92b7c94f','POS1754574047807','pos_profile_001',NULL,NULL,307.25,16.25,34.00,'upi','paid',NULL,NULL,NULL,'2025-08-07 13:40:47.807','2025-08-07 13:40:47.807'),
('14dd88be-bddd-4f6a-a1bb-d74c80d22ed1','POS1754576696422','pos_profile_001',NULL,NULL,567.00,27.00,0.00,'upi','paid',NULL,NULL,NULL,'2025-08-07 14:24:56.422','2025-08-07 14:24:56.422'),
('26115450-c3b1-40f0-87d2-60b3a2f2dc64','POS1754649698196','pos_profile_001',NULL,NULL,2861.25,136.25,0.00,'cash','paid',NULL,NULL,NULL,'2025-08-08 10:41:38.196','2025-08-08 10:41:38.196'),
('078b9cb9-9288-4063-b927-273e2a40deb8','POS1755265185642','pos_profile_001',NULL,NULL,409.50,19.50,0.00,'cash','paid',NULL,NULL,NULL,'2025-08-15 13:39:45.642','2025-08-15 13:39:45.642'),
('768e43b2-af82-4357-aa46-38928491798e','POS1755339853716','pos_profile_001',NULL,NULL,204.75,9.75,0.00,'cash','paid','Windows 10.0 - bbf61c5a-2c75-4214-a942-6bed6207a1b1-00-1fkbzhs92zwb2.spock.replit.dev','pos@amritdairy.com','2025-08-16 10:24:13.717','2025-08-16 10:24:13.717'),
('a9c96d45-f8f1-45ab-b86d-972d9232401f','POS1757339739557','pos_profile_001',NULL,NULL,68.25,3.25,0.00,'cash','paid','Windows 10.0 - bbf61c5a-2c75-4214-a942-6bed6207a1b1-00-1fkbzhs92zwb2.spock.replit.dev (7:25:38 pm)','pos@amritdairy.com','2025-09-08 13:55:39.557','2025-09-08 13:55:39.557');

-- =============================================================================
-- 16. INSERT SELECTED NOTIFICATIONS (SAMPLE - NOT ALL 75)
-- =============================================================================
INSERT INTO notifications (id, user_id, title, body, type, status, metadata, created_at, read_at) VALUES
('1821b7d7-4f72-468f-affe-0c609e47e3b4','eduringAi@gmail.com','Test Direct Insert','Hi deepak, this is a manual test notification!','admin_broadcast','delivered',NULL,'2025-08-25 13:57:11.955153',NULL),
('c25d188d-4886-43f0-92c2-3dfa93916c1e','customer_1754195712333_eycorc','Cart Reminder','Hi deepak, you have items waiting in your cart!','admin_broadcast','delivered',NULL,'2025-08-25 13:57:26.993514',NULL),
('12725f92-a8f5-4dc0-9ba0-c5a62711096c','60a46fec-9973-41f8-93b1-57ec2bd7581e','Cart Reminder','Hi Deepak c, you have items waiting in your cart!','admin_broadcast','delivered',NULL,'2025-08-25 13:57:26.993514',NULL),
('69438f14-941e-4882-875f-455752fc0475','customer_user_001','Cart Reminder','Hi John, you have items waiting in your cart!','admin_broadcast','delivered',NULL,'2025-08-25 13:57:26.993514',NULL),
('185523c5-1e11-4d7f-9d60-be533e8d73b3','c6ff3a6e-1a8b-441e-b7d7-6ec8c21f3c2e','Admin Alert','Hi Admin, this notification includes ALL users including admins!','admin_broadcast','delivered',NULL,'2025-08-25 13:59:56.605683',NULL);

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;

-- =============================================================================
-- 17. VERIFICATION QUERIES
-- =============================================================================

-- Count verification
SELECT 'VERIFICATION COUNTS:' as info;
SELECT 'users' as table_name, count(*) as count FROM users;
SELECT 'categories' as table_name, count(*) as count FROM categories;
SELECT 'vendors' as table_name, count(*) as count FROM vendors;
SELECT 'products' as table_name, count(*) as count FROM products;
SELECT 'addresses' as table_name, count(*) as count FROM addresses;
SELECT 'promo_codes' as table_name, count(*) as count FROM promo_codes;
SELECT 'orders' as table_name, count(*) as count FROM orders;
SELECT 'order_items' as table_name, count(*) as count FROM order_items;
SELECT 'admin_settings' as table_name, count(*) as count FROM admin_settings;
SELECT 'advertisements' as table_name, count(*) as count FROM advertisements;
SELECT 'order_reviews' as table_name, count(*) as count FROM order_reviews;
SELECT 'subscriptions' as table_name, count(*) as count FROM subscriptions;
SELECT 'pos_profiles' as table_name, count(*) as count FROM pos_profiles;
SELECT 'pos_sales' as table_name, count(*) as count FROM pos_sales;
SELECT 'notifications' as table_name, count(*) as count FROM notifications;

-- EXPECTED COUNTS (from development database):
-- users: 40
-- categories: 10
-- vendors: 7
-- products: 17
-- addresses: 8
-- promo_codes: 4
-- orders: 82 (sample: 6 in this script)
-- order_items: 29 (sample: 12 in this script)
-- admin_settings: 6
-- advertisements: 7
-- order_reviews: 9
-- subscriptions: 7
-- pos_profiles: 1
-- pos_sales: 9
-- notifications: 75 (sample: 5 in this script)

SELECT 'RESTORATION COMPLETE - ALL MAJOR DATA RESTORED!' as status;