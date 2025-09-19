import { db } from "../server/db";
import { agreementVariables, agreementTemplates } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seedAgreements() {
  console.log("🌱 Seeding agreement variables and templates...");

  // Agreement variables to seed
  const variablesData = [
    // General variables
    {
      key: "company_name",
      label: "Company Name",
      value: "Amrit Dairy",
      type: "text",
      description: "Official company name displayed in legal documents",
      category: "general",
      isRequired: true
    },
    {
      key: "contact_email",
      label: "Contact Email",
      value: "support@amritdairy.com",
      type: "email",
      description: "Primary contact email for customer support",
      category: "contact",
      isRequired: true
    },
    {
      key: "phone_number",
      label: "Phone Number",
      value: "+91 98765 43210",
      type: "tel",
      description: "Primary contact phone number",
      category: "contact",
      isRequired: true
    },
    {
      key: "address",
      label: "Business Address",
      value: "123 Dairy Lane, Fresh Valley, Mumbai, Maharashtra 400001, India",
      type: "text",
      description: "Complete business address for legal documents",
      category: "general",
      isRequired: true
    },
    {
      key: "website_url",
      label: "Website URL",
      value: "https://amritdairy.com",
      type: "url",
      description: "Official website URL",
      category: "general",
      isRequired: false
    },

    // Shipping-related variables
    {
      key: "free_shipping_threshold",
      label: "Free Shipping Threshold",
      value: "₹500",
      type: "text",
      description: "Minimum order amount for free shipping",
      category: "shipping",
      isRequired: true
    },
    {
      key: "delivery_fee",
      label: "Standard Delivery Fee",
      value: "₹30",
      type: "text",
      description: "Standard delivery charge for orders below threshold",
      category: "shipping",
      isRequired: true
    },
    {
      key: "service_areas",
      label: "Service Areas",
      value: "Mumbai, Pune, Nashik, and surrounding areas within 50km radius",
      type: "text",
      description: "Geographic areas where services are available",
      category: "shipping",
      isRequired: true
    },
    {
      key: "delivery_time",
      label: "Standard Delivery Time",
      value: "24-48 hours",
      type: "text",
      description: "Expected delivery timeframe",
      category: "shipping",
      isRequired: true
    },

    // Policy-related variables
    {
      key: "return_period",
      label: "Return Period",
      value: "7 days",
      type: "text",
      description: "Time period for returns and refunds",
      category: "policies",
      isRequired: true
    },
    {
      key: "refund_processing_time",
      label: "Refund Processing Time",
      value: "5-7 business days",
      type: "text",
      description: "Time taken to process refunds",
      category: "policies",
      isRequired: true
    },
    {
      key: "cancellation_deadline",
      label: "Cancellation Deadline",
      value: "2 hours before scheduled delivery",
      type: "text",
      description: "Deadline for order cancellations",
      category: "policies",
      isRequired: true
    }
  ];

  // Insert or update variables
  for (const variable of variablesData) {
    await db
      .insert(agreementVariables)
      .values(variable)
      .onConflictDoUpdate({
        target: agreementVariables.key,
        set: {
          label: variable.label,
          value: variable.value,
          type: variable.type,
          description: variable.description,
          category: variable.category,
          isRequired: variable.isRequired,
          updatedAt: new Date()
        }
      });
  }

  // Agreement templates to seed
  const templatesData = [
    {
      type: "terms_conditions",
      name: "Terms & Conditions",
      description: "Terms and conditions for using the platform",
      content: `# Terms & Conditions

**Last updated:** ${new Date().toLocaleDateString()}

## 1. Introduction

Welcome to {{company_name}}! These terms and conditions outline the rules and regulations for the use of our platform and services.

By accessing this website and our services, we assume you accept these terms and conditions. Do not continue to use {{company_name}} if you do not agree to take all of the terms and conditions stated on this page.

## 2. Definitions

- "Company" (referred to as "we", "us" or "our") refers to {{company_name}}
- "Service" refers to the food and grocery delivery platform operated by {{company_name}}
- "User" refers to anyone who accesses or uses our service

## 3. Use License

Permission is granted to temporarily access our platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
- Modify or copy the materials
- Use the materials for any commercial purpose or for any public display
- Attempt to reverse engineer any software contained on our platform
- Remove any copyright or other proprietary notations from the materials

## 4. Ordering and Payment

### 4.1 Order Placement
- All orders are subject to availability
- We reserve the right to refuse or cancel any order
- Prices are subject to change without notice

### 4.2 Payment Terms
- Payment is required at the time of order placement
- We accept various payment methods including online payments and cash on delivery
- All prices are inclusive of applicable taxes

## 5. Delivery Terms

### 5.1 Delivery Areas
We currently deliver to: {{service_areas}}

### 5.2 Delivery Charges
- Standard delivery fee: {{delivery_fee}}
- Free delivery on orders above: {{free_shipping_threshold}}

### 5.3 Delivery Time
Standard delivery time: {{delivery_time}}

## 6. Cancellation and Refunds

- Orders can be cancelled up to {{cancellation_deadline}}
- Refunds will be processed within {{refund_processing_time}}
- Return period: {{return_period}} for eligible items

## 7. Contact Information

For any questions about these Terms & Conditions, please contact us:

**{{company_name}}**
Email: {{contact_email}}
Phone: {{phone_number}}
Address: {{address}}
Website: {{website_url}}

## 8. Changes to Terms

We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting on our platform.

By continuing to use our service after changes are posted, you agree to be bound by the revised terms.`,
      variables: {},
      isActive: true,
      version: 1
    },
    {
      type: "privacy_policy",
      name: "Privacy Policy",
      description: "Privacy policy detailing data collection and usage",
      content: `# Privacy Policy

**Last updated:** ${new Date().toLocaleDateString()}

## 1. Introduction

{{company_name}} ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform and use our services.

## 2. Information We Collect

### 2.1 Personal Information
We may collect personal information that you voluntarily provide, including:
- Name and contact information (email, phone number)
- Delivery address
- Payment information
- Order history and preferences

### 2.2 Automatically Collected Information
We automatically collect certain information when you visit our platform:
- Device information (IP address, browser type, device type)
- Usage data (pages visited, time spent on platform)
- Location data (for delivery purposes)

## 3. How We Use Your Information

We use the information we collect to:
- Process and fulfill your orders
- Provide customer support
- Send order updates and notifications
- Improve our services and platform
- Comply with legal obligations

## 4. Information Sharing

We do not sell, trade, or rent your personal information to third parties. We may share information with:
- Service providers (payment processors, delivery partners)
- Legal authorities when required by law
- Business partners for order fulfillment

## 5. Data Security

We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.

## 6. Your Rights

You have the right to:
- Access your personal information
- Update or correct your information
- Request deletion of your information
- Opt-out of marketing communications

## 7. Contact Us

For questions about this Privacy Policy, contact us:

**{{company_name}}**
Email: {{contact_email}}
Phone: {{phone_number}}
Address: {{address}}

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on our platform.`,
      variables: {},
      isActive: true,
      version: 1
    },
    {
      type: "shipping_policy",
      name: "Shipping Policy",
      description: "Shipping and delivery policy",
      content: `# Shipping Policy

**Last updated:** ${new Date().toLocaleDateString()}

## 1. Delivery Areas

{{company_name}} currently provides delivery services to: {{service_areas}}

If your location is outside our current service area, please contact us at {{contact_email}} to check if we can arrange special delivery.

## 2. Delivery Charges

- **Standard Delivery:** {{delivery_fee}} per order
- **Free Delivery:** Available on orders above {{free_shipping_threshold}}
- **Express Delivery:** Additional charges may apply for urgent deliveries

## 3. Delivery Time

- **Standard Delivery:** {{delivery_time}}
- **Express Delivery:** Same-day delivery available in selected areas (additional charges apply)
- **Scheduled Delivery:** Choose your preferred delivery time slot during checkout

## 4. Order Processing

- Orders are typically processed within 2-4 hours during business hours
- Orders placed after business hours will be processed the next business day
- You will receive order confirmation and tracking information via SMS/email

## 5. Delivery Process

### 5.1 Delivery Confirmation
- Our delivery partner will contact you before delivery
- Please ensure someone is available to receive the order
- Valid ID may be required for verification

### 5.2 Failed Deliveries
- If delivery fails due to incorrect address or unavailability, additional charges may apply for re-delivery
- Orders may be cancelled if multiple delivery attempts fail

## 6. Product Quality

- We ensure fresh and quality products are delivered
- Perishable items are delivered in insulated bags to maintain freshness
- Temperature-sensitive items are handled with special care

## 7. Special Instructions

You can provide special delivery instructions during checkout, such as:
- Preferred delivery time
- Contact person details
- Specific delivery location within premises

## 8. Contact Information

For delivery-related queries, contact us:

**{{company_name}}**
Email: {{contact_email}}
Phone: {{phone_number}}
Address: {{address}}

## 9. Policy Updates

This shipping policy may be updated periodically to reflect changes in our delivery processes or service areas.`,
      variables: {},
      isActive: true,
      version: 1
    },
    {
      type: "cancellation_refunds",
      name: "Cancellation & Refunds",
      description: "Policy for order cancellations and refunds",
      content: `# Cancellation & Refunds Policy

**Last updated:** ${new Date().toLocaleDateString()}

## 1. Order Cancellation

### 1.1 Cancellation Window
- Orders can be cancelled up to {{cancellation_deadline}}
- Cancellations after this time may not be possible as the order might already be prepared or dispatched

### 1.2 How to Cancel
- Call us at {{phone_number}}
- Email us at {{contact_email}}
- Use the cancellation option in your order history (if available)

### 1.3 Cancellation Charges
- No charges for cancellations within the allowed time frame
- Late cancellation charges may apply if the order is already prepared

## 2. Refund Policy

### 2.1 Refund Eligibility
Refunds are available for:
- Cancelled orders within the allowed time frame
- Damaged or spoiled items upon delivery
- Missing items from your order
- Quality issues with delivered products

### 2.2 Refund Process
- Refunds will be processed within {{refund_processing_time}}
- Refunds will be credited to your original payment method
- For cash on delivery orders, refunds will be processed to your registered bank account or wallet

### 2.3 Non-Refundable Items
- Perishable items that have been delivered and accepted
- Items damaged due to mishandling after delivery
- Custom or special orders (unless defective)

## 3. Return Policy

### 3.1 Return Window
- Items must be returned within {{return_period}} of delivery
- Items must be in original condition and packaging

### 3.2 Return Process
1. Contact our customer service within the return period
2. Schedule a pickup or return the item to our store
3. Provide order details and reason for return
4. Refund will be processed after quality inspection

## 4. Product Quality Issues

If you receive damaged, spoiled, or incorrect items:
1. Report the issue immediately upon delivery
2. Provide photos of the defective items
3. We will arrange for replacement or full refund
4. No return shipping charges for quality issues

## 5. Subscription Cancellations

For recurring subscriptions:
- Cancel anytime before the next scheduled delivery
- No cancellation charges for subscription services
- Outstanding payments for delivered orders will still apply

## 6. Wallet and Credits

- Refunds may be processed as wallet credits for faster processing
- Wallet credits can be used for future orders
- Wallet credits are valid for 12 months from the date of credit

## 7. Contact for Support

For cancellation or refund requests:

**{{company_name}}**
Email: {{contact_email}}
Phone: {{phone_number}}
Address: {{address}}

## 8. Dispute Resolution

If you're not satisfied with our resolution:
- We aim to resolve all disputes within 7 business days
- You may escalate to consumer forums if needed
- We comply with all applicable consumer protection laws

## 9. Policy Updates

This policy may be updated to reflect changes in our processes or legal requirements. Updates will be communicated via our platform.`,
      variables: {},
      isActive: true,
      version: 1
    },
    {
      type: "contact_us",
      name: "Contact Us",
      description: "Contact information and support details",
      content: `# Contact Us

We're here to help! Get in touch with {{company_name}} for any questions, support, or feedback.

## 📞 Customer Support

**Phone:** {{phone_number}}
- Available: Monday to Sunday, 8:00 AM - 10:00 PM
- For urgent delivery issues, call anytime

**Email:** {{contact_email}}
- Response time: Within 24 hours
- For detailed queries and documentation

## 📍 Visit Us

**{{company_name}}**
{{address}}

**Store Hours:**
- Monday to Saturday: 7:00 AM - 9:00 PM
- Sunday: 8:00 AM - 8:00 PM

## 🌐 Online Support

**Website:** {{website_url}}

**Order Tracking:**
Track your orders in real-time through our platform or mobile app.

## 💬 What Can We Help You With?

### Order Support
- Order placement assistance
- Order modifications and cancellations
- Delivery tracking and updates
- Payment and billing queries

### Product Information
- Product availability and descriptions
- Nutritional information
- Special dietary requirements
- Bulk order inquiries

### Account Support
- Account registration and login issues
- Profile and address updates
- Subscription management
- Wallet and payment methods

### Technical Support
- Website and app functionality
- Mobile app installation and updates
- Login and access issues

## 🚚 Delivery Support

For urgent delivery-related queries:
- Call {{phone_number}}
- Our delivery team will assist you promptly

## 📝 Feedback and Suggestions

We value your feedback! Share your experience and suggestions:
- Email: {{contact_email}}
- Phone: {{phone_number}}

## 🏢 Business Inquiries

For partnerships, vendor applications, and business collaborations:
- Email: {{contact_email}}
- Subject line: "Business Inquiry - [Your Request]"

## 📱 Stay Connected

Keep up with our latest updates, offers, and news through our platform and social media channels.

## ⏰ Response Times

- **Phone:** Immediate assistance during business hours
- **Email:** Within 24 hours
- **Emergency delivery issues:** Immediate response

---

**{{company_name}}** - Your trusted partner for fresh dairy and grocery needs!

*For the fastest response to urgent delivery issues, please call {{phone_number}}*`,
      variables: {},
      isActive: true,
      version: 1
    }
  ];

  // Insert or update templates
  for (const template of templatesData) {
    const existingTemplate = await db
      .select()
      .from(agreementTemplates)
      .where(eq(agreementTemplates.type, template.type))
      .limit(1);

    if (existingTemplate.length === 0) {
      await db.insert(agreementTemplates).values(template);
      console.log(`✅ Created template: ${template.name}`);
    } else {
      console.log(`⏭️  Template already exists: ${template.name}`);
    }
  }

  console.log("🎉 Agreement seeding completed!");
}

// Run the seeding function
seedAgreements()
  .then(() => {
    console.log("✨ Seeding finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });

export { seedAgreements };