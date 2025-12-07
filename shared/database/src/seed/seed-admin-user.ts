import { hash } from 'bcrypt';
import { db } from '../index';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Seeds the admin user from environment variables.
 * This follows Drizzle ORM patterns for manual seeding of specific data.
 * 
 * Note: drizzle-seed is designed for generating fake/test data.
 * For seeding specific admin users, manual seeding is the appropriate approach.
 */
export async function seedAdmin(): Promise<void> {
  console.log('👥 Seeding admin user...');
  
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_USERNAME;

  if (!adminEmail || !adminPassword || !adminName) {
    throw new Error('Missing required environment variables for admin user seeding. Required: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME');
  }

  // Hash the admin password
  const hashedPassword = await hash(adminPassword, 10);

  try {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });

    if (existingUser) {
      // Update existing user
      await db
        .update(users)
        .set({
          name: adminName,
          password: hashedPassword,
          isAdmin: true,
          updatedAt: new Date(),
        })
        .where(eq(users.email, adminEmail));
      
      console.log(`  🔄 Updated admin user: ${adminEmail}`);
    } else {
      // Create new user
      await db.insert(users).values({
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`  ✨ Created admin user: ${adminEmail}`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to seed admin user ${adminEmail}:`, error);
    throw error;
  }
  
  console.log('✅ Admin user seeding completed');
} 