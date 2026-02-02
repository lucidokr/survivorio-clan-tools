/**
 * Migration Script: MongoDB to Firebase Firestore
 * Migrates clans, members, and results data
 */

const { MongoClient } = require('mongodb');

// Reuse the existing Firebase service (already configured and working)
const { db, admin } = require('./services/firebaseService');

// MongoDB URI
const MONGODB_URI = 'mongodb+srv://kristian:U1sHfpHl1YmY8PLO@cluster0.7kkomsl.mongodb.net/clan-stats?retryWrites=true&w=majority';

// Collections
const COLLECTIONS = {
    CLANS: 'clans',
    MEMBERS: 'members',
    RESULTS: 'results'
};

// Map to store old MongoDB _id to new Firestore id
const idMappings = {
    clans: {},    // oldMongoId -> newFirestoreId
    members: {}   // oldMongoId -> newFirestoreId
};

async function migrateClans(mongoDb) {
    console.log('\n📦 Migrating Clans...');

    const clans = await mongoDb.collection('clans').find({}).toArray();
    console.log(`   Found ${clans.length} clans in MongoDB`);

    let migrated = 0;

    for (const clan of clans) {
        try {
            const clanData = {
                name: clan.name,
                clanId: clan.clanId,
                tag: clan.tag,
                description: clan.description || '',
                screenshot: clan.screenshot || '',
                isActive: clan.isActive !== undefined ? clan.isActive : true,
                createdAt: clan.createdAt ? admin.firestore.Timestamp.fromDate(new Date(clan.createdAt)) : admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection(COLLECTIONS.CLANS).add(clanData);

            // Store mapping
            idMappings.clans[clan._id.toString()] = docRef.id;

            migrated++;
            console.log(`   ✅ Clan "${clan.name}" migrated (${clan._id} -> ${docRef.id})`);
        } catch (error) {
            console.error(`   ❌ Error migrating clan "${clan.name}":`, error.message);
        }
    }

    console.log(`   Migrated ${migrated}/${clans.length} clans`);
    return migrated;
}

async function migrateMembers(mongoDb) {
    console.log('\n👥 Migrating Members...');

    const members = await mongoDb.collection('members').find({}).toArray();
    console.log(`   Found ${members.length} members in MongoDB`);

    let migrated = 0;
    let skipped = 0;

    for (const member of members) {
        try {
            // Get the new clan ID from mapping
            const oldClanId = member.clan ? member.clan.toString() : null;
            const newClanId = oldClanId ? idMappings.clans[oldClanId] : null;

            if (!newClanId) {
                console.log(`   ⚠️ Skipping member "${member.playerName}" - clan not found`);
                skipped++;
                continue;
            }

            const memberData = {
                playerName: member.playerName,
                playerId: member.playerId,
                phoneNumber: member.phoneNumber || '',
                discordNickname: member.discordNickname || '',
                clanId: newClanId,  // Use new Firestore clan ID
                isActive: member.isActive !== undefined ? member.isActive : true,
                joinDate: member.joinDate ? admin.firestore.Timestamp.fromDate(new Date(member.joinDate)) : admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection(COLLECTIONS.MEMBERS).add(memberData);

            // Store mapping
            idMappings.members[member._id.toString()] = docRef.id;

            migrated++;
        } catch (error) {
            console.error(`   ❌ Error migrating member "${member.playerName}":`, error.message);
        }
    }

    console.log(`   Migrated ${migrated}/${members.length} members (${skipped} skipped)`);
    return migrated;
}

async function migrateResults(mongoDb) {
    console.log('\n📊 Migrating Results...');

    const results = await mongoDb.collection('results').find({}).toArray();
    console.log(`   Found ${results.length} results in MongoDB`);

    let migrated = 0;
    let skipped = 0;

    // Process in batches for better performance
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const result of results) {
        try {
            // Get the new IDs from mappings
            const oldMemberId = result.member ? result.member.toString() : null;
            const oldClanId = result.clan ? result.clan.toString() : null;

            const newMemberId = oldMemberId ? idMappings.members[oldMemberId] : null;
            const newClanId = oldClanId ? idMappings.clans[oldClanId] : null;

            if (!newMemberId || !newClanId) {
                skipped++;
                continue;
            }

            const resultData = {
                memberId: newMemberId,  // Use new Firestore member ID
                clanId: newClanId,      // Use new Firestore clan ID
                score: result.score || 0,
                week: result.week,
                bossLevel: result.bossLevel || null,
                missedBossDay1: result.missedBossDay1 || false,
                missedBossDay2: result.missedBossDay2 || false,
                missedBossDay3: result.missedBossDay3 || false,
                screenshot: result.screenshot || '',
                isManualEntry: result.isManualEntry || false,
                createdAt: result.createdAt ? admin.firestore.Timestamp.fromDate(new Date(result.createdAt)) : admin.firestore.FieldValue.serverTimestamp()
            };

            const docRef = db.collection(COLLECTIONS.RESULTS).doc();
            batch.set(docRef, resultData);
            batchCount++;
            migrated++;

            // Commit batch when it reaches the limit
            if (batchCount >= batchSize) {
                await batch.commit();
                console.log(`   ... committed batch of ${batchCount} results`);
                batch = db.batch();
                batchCount = 0;
            }
        } catch (error) {
            console.error(`   ❌ Error migrating result:`, error.message);
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
        console.log(`   ... committed final batch of ${batchCount} results`);
    }

    console.log(`   Migrated ${migrated}/${results.length} results (${skipped} skipped)`);
    return migrated;
}

async function runMigration() {
    console.log('🚀 Starting MongoDB to Firebase Firestore Migration');
    console.log('='.repeat(50));

    let mongoClient;

    try {
        // Connect to MongoDB
        console.log('\n📡 Connecting to MongoDB...');
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const mongoDb = mongoClient.db('clan-stats');
        console.log('   Connected to MongoDB successfully!');

        // Migrate in order (clans first, then members, then results)
        const clansCount = await migrateClans(mongoDb);
        const membersCount = await migrateMembers(mongoDb);
        const resultsCount = await migrateResults(mongoDb);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Migration Complete!');
        console.log(`   - Clans: ${clansCount}`);
        console.log(`   - Members: ${membersCount}`);
        console.log(`   - Results: ${resultsCount}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        if (mongoClient) {
            await mongoClient.close();
            console.log('\n📡 MongoDB connection closed');
        }
        process.exit(0);
    }
}

// Run the migration
runMigration();
