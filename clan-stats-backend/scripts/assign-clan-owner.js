/**
 * Migration Script: Add ownerId to existing clans
 * Run this once after setting up auth to assign existing clans to a user
 * 
 * Usage: node scripts/assign-clan-owner.js <userUid>
 */

const { ClanService, db, admin } = require('../services/firebaseService');

async function assignClanOwner(userUid) {
    if (!userUid) {
        console.error('Usage: node scripts/assign-clan-owner.js <userUid>');
        console.log('\nTo get your UID:');
        console.log('1. Start the app and login with Google');
        console.log('2. Check the browser console for your UID');
        console.log('3. Or check Firebase Console > Authentication > Users');
        process.exit(1);
    }

    console.log(`Assigning all clans without owner to user: ${userUid}`);

    try {
        // Get all clans
        const snapshot = await db.collection('clans').get();

        let updated = 0;
        let skipped = 0;

        for (const doc of snapshot.docs) {
            const clan = doc.data();

            if (!clan.ownerId) {
                await db.collection('clans').doc(doc.id).update({
                    ownerId: userUid
                });
                console.log(`✓ Assigned clan "${clan.name}" (${doc.id}) to user ${userUid}`);
                updated++;
            } else {
                console.log(`- Skipped clan "${clan.name}" (already has owner: ${clan.ownerId})`);
                skipped++;
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`Updated: ${updated} clans`);
        console.log(`Skipped: ${skipped} clans (already had owner)`);
        console.log(`Total: ${snapshot.size} clans`);

    } catch (error) {
        console.error('Migration failed:', error);
    }

    process.exit(0);
}

const userUid = process.argv[2];
assignClanOwner(userUid);
