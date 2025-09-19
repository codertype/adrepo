// Migration script to convert existing text-based order numbers to alphanumeric format
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

async function migrateOrderNumbers() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });

  try {
    // Get all orders with text-based order numbers (containing spaces)
    const result = await pool.query(
      "SELECT id, order_number FROM orders WHERE order_number LIKE '% %'"
    );

    console.log(`Found ${result.rows.length} orders to migrate`);

    // Convert each text-based order number to alphanumeric format
    for (const order of result.rows) {
      const { id, order_number } = order;
      
      // Extract the numeric part from text like "mk eight five seven nine"
      const textParts = order_number.toLowerCase().split(' ');
      
      if (textParts[0] === 'mk') {
        const numberWords = {
          'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
          'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
        };
        
        let numericPart = '';
        for (let i = 1; i < textParts.length; i++) {
          const digit = numberWords[textParts[i]];
          if (digit !== undefined) {
            numericPart += digit;
          }
        }
        
        // Create new alphanumeric format
        const newOrderNumber = `MK${numericPart}`;
        
        // Update the order
        await pool.query(
          "UPDATE orders SET order_number = $1 WHERE id = $2",
          [newOrderNumber, id]
        );
        
        console.log(`Updated order ${id}: ${order_number} → ${newOrderNumber}`);
      }
    }

    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateOrderNumbers();
}

export { migrateOrderNumbers };