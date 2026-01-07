import { PrismaClient } from '@prisma/client';
import { initializeFirebase, getFirebaseAuth } from '../src/config/firebase.js';
import { initializeS3Client } from '../src/config/s3.js';
import { s3Service } from '../src/services/s3.service.js';
import { imageService } from '../src/services/image.service.js';
import { config } from '../src/config/index.js';

const prisma = new PrismaClient();

/**
 * Sanitize display name to create username
 */
function sanitizeUsername(displayName: string): string {
  let username = displayName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  username = username.replace(/\s+/g, '_');
  username = username.substring(0, 50);
  if (username.length < 3) {
    username = username + '_user';
  }
  return username;
}

/**
 * Generate unique username from display name
 */
async function generateUniqueUsername(displayName: string): Promise<string> {
  let username = sanitizeUsername(displayName);
  
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });
  
  if (!existingUser) {
    return username;
  }

  // Append random numbers if not available
  let attempts = 0;
  while (attempts < 10) {
    const randomSuffix = Math.floor(Math.random() * 9999);
    username = `${sanitizeUsername(displayName)}_${randomSuffix}`;
    
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      return username;
    }
    attempts++;
  }

  // Last resort: use timestamp
  return `${sanitizeUsername(displayName)}_${Date.now()}`;
}

/**
 * Download and upload profile photo from URL to S3
 */
async function uploadProfilePhotoFromUrl(photoUrl: string, userId: string): Promise<string> {
  try {
    console.log(`   Downloading photo from: ${photoUrl}`);
    
    const response = await fetch(photoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`   Compressing image...`);
    const compressedBuffer = await imageService.compressProfilePhoto(buffer);

    const timestamp = Date.now();
    const key = `users/${userId}/profile/${timestamp}.jpg`;
    
    console.log(`   Uploading to S3: ${key}`);
    const s3Url = await s3Service.uploadFile(
      compressedBuffer,
      key,
      'image/jpeg',
      config.aws.s3.bucketProfile
    );

    console.log(`   ✅ Uploaded successfully: ${s3Url}`);
    return s3Url;
  } catch (error) {
    console.error(`   ❌ Failed to upload photo:`, error);
    return photoUrl; // Return original URL if upload fails
  }
}

/**
 * Backfill Google users with missing username or photoUrl
 */
async function backfillGoogleUsers(): Promise<void> {
  console.log('🔄 Starting Google user backfill...\n');

  try {
    // Initialize Firebase and S3
    console.log('Initializing Firebase...');
    initializeFirebase();
    const auth = getFirebaseAuth();
    
    console.log('Initializing S3...');
    initializeS3Client();
    await s3Service.createBucket(config.aws.s3.bucketProfile);
    
    console.log('✅ Services initialized\n');

    // Find Google users with missing username or photoUrl
    const users = await prisma.user.findMany({
      where: {
        provider: 'google',
        OR: [
          { username: null },
          { photoUrl: null },
        ],
      },
    });

    if (users.length === 0) {
      console.log('✨ No Google users need backfilling!');
      return;
    }

    console.log(`Found ${users.length} Google users to backfill:\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.id}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Firebase UID: ${user.firebaseUid}`);
      console.log(`   Current username: ${user.username || 'MISSING'}`);
      console.log(`   Current photoUrl: ${user.photoUrl ? 'EXISTS' : 'MISSING'}`);

      try {
        // Fetch Firebase user data
        const firebaseUser = await auth.getUser(user.firebaseUid);
        
        const updateData: { username?: string; photoUrl?: string } = {};

        // Backfill username if missing
        if (!user.username && firebaseUser.displayName) {
          console.log(`   Generating username from: ${firebaseUser.displayName}`);
          updateData.username = await generateUniqueUsername(firebaseUser.displayName);
          console.log(`   Generated username: ${updateData.username}`);
        }

        // Backfill photoUrl if missing
        if (!user.photoUrl && firebaseUser.photoURL) {
          console.log(`   Uploading photo to S3...`);
          updateData.photoUrl = await uploadProfilePhotoFromUrl(firebaseUser.photoURL, user.id);
        }

        // Update user if we have changes
        if (Object.keys(updateData).length > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
          
          console.log(`   ✅ Updated successfully!`);
          if (updateData.username) console.log(`      - Username: ${updateData.username}`);
          if (updateData.photoUrl) console.log(`      - Photo: ${updateData.photoUrl}`);
          
          successCount++;
        } else {
          console.log(`   ℹ️  No updates needed`);
        }

      } catch (error) {
        console.error(`   ❌ Error processing user:`, error);
        errorCount++;
      }
    }

    console.log(`\n✨ Backfill complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total processed: ${users.length}`);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
}

// Run the backfill
backfillGoogleUsers()
  .then(() => {
    console.log('\n🎉 Done!');
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
