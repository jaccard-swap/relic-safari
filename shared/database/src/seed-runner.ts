#!/usr/bin/env tsx

import { seedAdmin } from './seed/seed-admin-user';

async function runSeeds() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Seed admin user
    await seedAdmin();
    
    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Always run the seeding when this file is executed
runSeeds();

export { runSeeds }; 