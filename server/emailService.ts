import nodemailer from 'nodemailer';

// Gmail configuration using environment variables
// SECURITY: Never hardcode credentials - always use environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Check if email service is available
const isEmailServiceAvailable = () => {
  const hasCredentials = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
  if (!hasCredentials && process.env.NODE_ENV === 'development') {
    console.log('⚠️  Email service disabled in development (missing GMAIL_USER or GMAIL_APP_PASSWORD)');
  }
  return hasCredentials;
};

interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface OrderDetails {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  deliveryAddress: string;
  paymentStatus?: string;
  paymentMethod?: string;
  cancellationDate?: string;
  cancellationTime?: string;
}

export async function sendOrderConfirmationEmails(orderDetails: OrderDetails): Promise<boolean> {
  // Check if email service is available in development
  if (!isEmailServiceAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEVELOPMENT] Email service disabled - would send order confirmation to:', orderDetails.customerEmail);
      console.log('📧 [DEVELOPMENT] Order ID:', orderDetails.orderId);
      return true; // Return success in development to not break the flow
    } else {
      console.error('❌ Email service not configured in production');
      return false;
    }
  }

  try {
    // Customer confirmation email
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Amrit Dairy</h1>
          <h2 style="color: #16a34a; margin: 0;">Order Confirmation</h2>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #1f2937;">Hello ${orderDetails.customerName}!</h3>
          <p style="color: #4b5563; margin-bottom: 10px;">Thank you for your order. We've received your order and are preparing it for delivery.</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Payment Status:</strong> <span style="color: ${orderDetails.paymentStatus === 'paid' ? '#16a34a' : '#f59e0b'}; font-weight: bold;">${orderDetails.paymentStatus?.toUpperCase() || 'PENDING'}</span></p>
          <p style="color: #4b5563; margin: 0;"><strong>Payment Method:</strong> ${orderDetails.paymentMethod?.toUpperCase() || 'CASH ON DELIVERY'}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #d1d5db;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #d1d5db;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderDetails.items.map(item => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.price}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.subtotal}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Delivery Fee:</strong></td>
              <td style="text-align: right; padding: 5px 0;">${orderDetails.deliveryFee === 0 ? 'FREE' : '₹' + orderDetails.deliveryFee}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Tax:</strong></td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.tax}</td>
            </tr>
            <tr style="border-top: 2px solid #d1d5db;">
              <td style="padding: 10px 0 5px 0;"><strong style="font-size: 18px;">Total:</strong></td>
              <td style="text-align: right; padding: 10px 0 5px 0;"><strong style="font-size: 18px; color: #16a34a;">₹${orderDetails.total}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #1e40af;">Delivery Information</h4>
          <p style="margin: 10px 0; color: #1f2937;"><strong>Address:</strong><br>${orderDetails.deliveryAddress}</p>
          <p style="margin: 10px 0; color: #4b5563;">Your order will be delivered within 2-4 hours. Our delivery partner will contact you before delivery.</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0;">Thank you for choosing Amrit Dairy!</p>
          <p style="color: #6b7280; margin: 5px 0 0 0;">For any questions, contact us at amritanshdairy@gmail.com</p>
        </div>
      </div>
    `;

    // Store notification email
    const storeEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Amrit Dairy</h1>
          <h2 style="color: #dc2626; margin: 0;">New Order Received</h2>
        </div>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #1f2937;">New Order Alert!</h3>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Customer:</strong> ${orderDetails.customerName}</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Customer Email:</strong> ${orderDetails.customerEmail}</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Payment Status:</strong> <span style="color: ${orderDetails.paymentStatus === 'paid' ? '#16a34a' : '#f59e0b'}; font-weight: bold;">${orderDetails.paymentStatus?.toUpperCase() || 'PENDING'}</span></p>
          <p style="color: #4b5563; margin: 0;"><strong>Payment Method:</strong> ${orderDetails.paymentMethod?.toUpperCase() || 'CASH ON DELIVERY'}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #d1d5db;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #d1d5db;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderDetails.items.map(item => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.price}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #1f2937;">Order Summary</h4>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.subtotal}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Delivery Fee:</strong></td>
              <td style="text-align: right; padding: 5px 0;">${orderDetails.deliveryFee === 0 ? 'FREE' : '₹' + orderDetails.deliveryFee}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Tax:</strong></td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.tax}</td>
            </tr>
            <tr style="border-top: 2px solid #d1d5db;">
              <td style="padding: 10px 0 5px 0;"><strong style="font-size: 18px;">Total:</strong></td>
              <td style="text-align: right; padding: 10px 0 5px 0;"><strong style="font-size: 18px; color: #16a34a;">₹${orderDetails.total}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #1e40af;">Delivery Address</h4>
          <p style="margin: 0; color: #1f2937;">${orderDetails.deliveryAddress}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #dc2626; margin: 0; font-weight: bold;">Action Required: Process this order immediately</p>
        </div>
      </div>
    `;

    console.log(`📧 Attempting to send emails for order: ${orderDetails.orderId}`);
    console.log(`📧 Customer email: ${orderDetails.customerEmail}`);
    console.log(`📧 Store email: amritanshdairy@gmail.com`);
    
    // Send customer confirmation email
    const customerResult = await transporter.sendMail({
      from: 'Amrit Dairy <amritanshdairy@gmail.com>',
      to: orderDetails.customerEmail,
      subject: `Order Confirmation - ${orderDetails.orderId} | Amrit Dairy`,
      html: customerEmailHtml
    });
    console.log(`📧 Customer confirmation email sent to ${orderDetails.customerEmail}:`, customerResult.messageId);

    // Send store notification email
    const storeResult = await transporter.sendMail({
      from: 'Amrit Dairy <amritanshdairy@gmail.com>',
      to: 'amritanshdairy@gmail.com', // Main store email
      subject: `🔔 New Order Received - ${orderDetails.orderId}`,
      html: storeEmailHtml
    });
    console.log(`📧 Store notification email sent to amritanshdairy@gmail.com:`, storeResult.messageId);

    console.log(`✅ Both emails sent successfully for order: ${orderDetails.orderId}`);
    console.log(`   → Customer: ${orderDetails.customerEmail}`);
    console.log(`   → Store: amritanshdairy@gmail.com`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send order confirmation emails:', error);
    if (error instanceof Error) {
      console.error('❌ Error details:', error.message);
    }
    return false;
  }
}

export async function sendOrderCancellationEmail(orderDetails: OrderDetails): Promise<boolean> {
  // Check if email service is available in development
  if (!isEmailServiceAvailable()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 [DEVELOPMENT] Email service disabled - would send cancellation email to:', orderDetails.customerEmail);
      console.log('📧 [DEVELOPMENT] Cancelled Order ID:', orderDetails.orderId);
      return true; // Return success in development to not break the flow
    } else {
      console.error('❌ Email service not configured in production');
      return false;
    }
  }

  try {
    // Customer cancellation email
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Amrit Dairy</h1>
          <h2 style="color: #dc2626; margin: 0;">Order Cancelled</h2>
        </div>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #1f2937;">Hello ${orderDetails.customerName}!</h3>
          <p style="color: #4b5563; margin-bottom: 10px;">Your order has been successfully cancelled as requested.</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p style="color: #4b5563; margin-bottom: 10px;"><strong>Cancelled on:</strong> ${orderDetails.cancellationDate} at ${orderDetails.cancellationTime}</p>
          <p style="color: #4b5563; margin: 0;"><strong>Refund Status:</strong> <span style="color: #16a34a; font-weight: bold;">Processing (if applicable)</span></p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Cancelled Order Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #d1d5db;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #d1d5db;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #d1d5db;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderDetails.items.map(item => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.price}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">₹${item.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0;">Subtotal:</td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.subtotal}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;">Delivery Fee:</td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.deliveryFee}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;">Tax:</td>
              <td style="text-align: right; padding: 5px 0;">₹${orderDetails.tax}</td>
            </tr>
            <tr style="border-top: 2px solid #d1d5db;">
              <td style="padding: 10px 0 5px 0;"><strong style="font-size: 18px;">Cancelled Amount:</strong></td>
              <td style="text-align: right; padding: 10px 0 5px 0;"><strong style="font-size: 18px; color: #dc2626;">₹${orderDetails.total}</strong></td>
            </tr>
          </table>
        </div>

        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #1e40af;">Delivery Address (Cancelled)</h4>
          <p style="margin: 0; color: #1f2937;">${orderDetails.deliveryAddress}</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #4b5563; margin-bottom: 10px;">If you have any questions about this cancellation, please contact us.</p>
          <p style="color: #16a34a; margin: 0; font-weight: bold;">Thank you for choosing Amrit Dairy!</p>
        </div>
      </div>
    `;

    console.log(`📧 Attempting to send cancellation email for order: ${orderDetails.orderId}`);
    console.log(`📧 Customer email: ${orderDetails.customerEmail}`);
    
    // Send customer cancellation email
    const customerResult = await transporter.sendMail({
      from: 'Amrit Dairy <amritanshdairy@gmail.com>',
      to: orderDetails.customerEmail,
      subject: `Order Cancelled - ${orderDetails.orderId} | Amrit Dairy`,
      html: customerEmailHtml
    });
    console.log(`📧 Cancellation email sent to ${orderDetails.customerEmail}:`, customerResult.messageId);

    console.log(`✅ Cancellation email sent successfully for order: ${orderDetails.orderId}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send order cancellation email:', error);
    if (error instanceof Error) {
      console.error('❌ Error details:', error.message);
    }
    return false;
  }
}