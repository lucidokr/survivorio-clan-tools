const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let serviceAccount;
if (process.env.FIREBASE_CREDS) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);
    } catch (err) {
        console.error('Failed to parse FIREBASE_CREDS env var, falling back to local file:', err);
        try {
            serviceAccount = require('../firebase-credentials.json');
        } catch (e) {
            console.warn('No local firebase-credentials.json found. Relying on Application Default Credentials.');
            serviceAccount = null;
        }
    }
} else {
    try {
        serviceAccount = require('../firebase-credentials.json');
    } catch (err) {
        console.warn('No local firebase-credentials.json found and FIREBASE_CREDS not set. Relying on Application Default Credentials.');
        serviceAccount = null;
    }
}

const app = admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault()
});

// Use the specific database "clans-tools" with getFirestore
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore(app, 'clans-tools');

// Collections
const COLLECTIONS = {
    CLANS: 'clans',
    MEMBERS: 'members',
    RESULTS: 'results',
    USERS: 'users',
    COMMUNITIES: 'communities'
};

// Helper to convert Firestore doc to object with id
const docToObject = (doc) => {
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
};

// Helper to convert query snapshot to array
const queryToArray = (snapshot) => {
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Helper to remove undefined properties before writing to Firestore
const sanitizeForFirestore = (obj = {}) => {
    const out = {};
    for (const k of Object.keys(obj)) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
};

// ============== CLAN OPERATIONS ==============

const ClanService = {
    async create(clanData, ownerId) {
        const payload = sanitizeForFirestore({
            ...clanData,
            ownerId: ownerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        const docRef = await db.collection(COLLECTIONS.CLANS).add(payload);
        const doc = await docRef.get();
        return docToObject(doc);
    },

    async findById(id) {
        const doc = await db.collection(COLLECTIONS.CLANS).doc(id).get();
        return docToObject(doc);
    },

    async findByClanIdOrName(clanId, name) {
        // Check by clanId
        let snapshot = await db.collection(COLLECTIONS.CLANS)
            .where('clanId', '==', clanId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return docToObject(snapshot.docs[0]);
        }

        // Check by name
        snapshot = await db.collection(COLLECTIONS.CLANS)
            .where('name', '==', name)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return docToObject(snapshot.docs[0]);
        }

        return null;
    },

    async findByTag(tag) {
        if (!tag) return null;
        const snapshot = await db.collection(COLLECTIONS.CLANS)
            .where('tag', '==', tag)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async findByOwner(ownerId) {
        const snapshot = await db.collection(COLLECTIONS.CLANS)
            .where('ownerId', '==', ownerId)
            .where('isActive', '==', true)
            .get();
        return queryToArray(snapshot).sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
            return dateB - dateA;
        });
    },

    async findAll(activeOnly = true) {
        try {
            let query = db.collection(COLLECTIONS.CLANS);
            if (activeOnly) {
                query = query.where('isActive', '==', true);
            }
            const snapshot = await query.get();
            // Sort in memory to avoid needing composite index
            const results = queryToArray(snapshot);
            return results.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('Firestore findAll error:', error);
            // Return empty array if collection doesn't exist yet
            if (error.code === 5) {
                return [];
            }
            throw error;
        }
    },

    async update(id, data) {
        await db.collection(COLLECTIONS.CLANS).doc(id).update(sanitizeForFirestore(data));
        return this.findById(id);
    },

    async findAccessibleClans(userId, userEmail) {
        // Clan dove sono owner
        const ownedClans = await this.findByOwner(userId);

        // Clan dove sono membro con email associata
        const memberClanObjects = [];
        if (userEmail) {
            // Find members with this email
            const snapshot = await db.collection(COLLECTIONS.MEMBERS)
                .where('email', '==', userEmail.toLowerCase())
                .where('isActive', '==', true)
                .get();

            for (const doc of snapshot.docs) {
                const member = docToObject(doc);
                if (member.clanId && member.role) {
                    const clan = await this.findById(member.clanId);
                    if (clan && clan.isActive) {
                        // Add role info
                        memberClanObjects.push({
                            ...clan,
                            myRole: member.role,
                            memberId: member.id
                        });
                    }
                }
            }
        }

        // Combine and remove duplicates (owner takes precedence)
        const allClans = [...ownedClans, ...memberClanObjects];
        const uniqueMap = new Map(allClans.map(c => [c.id, c]));
        return Array.from(uniqueMap.values());
    },

    async verifyUserAccess(clanId, userId, userEmail) {
        const clan = await this.findById(clanId);
        if (!clan) return { canAccess: false };

        // Owner
        if (clan.ownerId === userId) {
            return { canAccess: true, role: 'owner' };
        }

        // Member with linked email
        if (userEmail) {
            const snapshot = await db.collection(COLLECTIONS.MEMBERS)
                .where('clanId', '==', clanId)
                .where('email', '==', userEmail.toLowerCase())
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const member = docToObject(snapshot.docs[0]);
                if (member.role) {
                    return { canAccess: true, role: member.role };
                }
            }
        }

        return { canAccess: false };
    }
};

// Cascade delete helper for clans
ClanService.deleteClanCascade = async function (clanId) {
    if (!clanId) throw new Error('clanId required');

    // Delete members in batches
    const deleteDocsInBatches = async (collectionName, query) => {
        const snapshot = await query.get();
        if (snapshot.empty) return;
        const docs = snapshot.docs;
        const chunkSize = 500;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    };

    // members
    await deleteDocsInBatches(COLLECTIONS.MEMBERS, db.collection(COLLECTIONS.MEMBERS).where('clanId', '==', clanId));

    // results
    await deleteDocsInBatches(COLLECTIONS.RESULTS, db.collection(COLLECTIONS.RESULTS).where('clanId', '==', clanId));

    // remove clanId from any communities
    const commSnapshot = await db.collection(COLLECTIONS.COMMUNITIES).where('clanIds', 'array-contains', clanId).get();
    for (const doc of commSnapshot.docs) {
        await db.collection(COLLECTIONS.COMMUNITIES).doc(doc.id).update({ clanIds: admin.firestore.FieldValue.arrayRemove(clanId) });
    }

    // finally delete the clan document itself
    await db.collection(COLLECTIONS.CLANS).doc(clanId).delete();

    return true;
};

// ============== COMMUNITY OPERATIONS ==============

const CommunityService = {
    async create(data, ownerId) {
        const payload = sanitizeForFirestore({
            ...data,
            ownerId,
            clanIds: data.clanIds || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        const docRef = await db.collection(COLLECTIONS.COMMUNITIES).add(payload);
        return docToObject(await docRef.get());
    },

    async findById(id) {
        const doc = await db.collection(COLLECTIONS.COMMUNITIES).doc(id).get();
        return docToObject(doc);
    },

    async findAll(activeOnly = true) {
        let query = db.collection(COLLECTIONS.COMMUNITIES);
        if (activeOnly) query = query.where('isActive', '==', true);
        const snapshot = await query.get();
        return queryToArray(snapshot).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    },

    async update(id, data) {
        await db.collection(COLLECTIONS.COMMUNITIES).doc(id).update(sanitizeForFirestore(data));
        return this.findById(id);
    },

    async softDelete(id) {
        await db.collection(COLLECTIONS.COMMUNITIES).doc(id).update({ isActive: false, deletedAt: admin.firestore.FieldValue.serverTimestamp() });
        return true;
    },

    async addClan(communityId, clanId) {
        const ref = db.collection(COLLECTIONS.COMMUNITIES).doc(communityId);
        await ref.update({ clanIds: admin.firestore.FieldValue.arrayUnion(clanId) });
        return this.findById(communityId);
    },

    async removeClan(communityId, clanId) {
        const ref = db.collection(COLLECTIONS.COMMUNITIES).doc(communityId);
        await ref.update({ clanIds: admin.firestore.FieldValue.arrayRemove(clanId) });
        return this.findById(communityId);
    }
};

// ============== CLAN INVITATION OPERATIONS ==============

const ClanInvitationService = {
    async create(clanId, memberId, email, role, invitedByEmail) {
        const docRef = await db.collection('clan_invitations').add({
            clanId,
            memberId,
            email: email.toLowerCase(),
            role,
            invitedByEmail,
            invitedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });
        return docToObject(await docRef.get());
    },

    async findByEmailAndClan(email, clanId) {
        const snapshot = await db.collection('clan_invitations')
            .where('email', '==', email.toLowerCase())
            .where('clanId', '==', clanId)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async findByEmail(email) {
        const snapshot = await db.collection('clan_invitations')
            .where('email', '==', email.toLowerCase())
            .get();
        return queryToArray(snapshot);
    },

    async accept(invitationId) {
        await db.collection('clan_invitations').doc(invitationId).update({
            status: 'accepted',
            acceptedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return this.findById(invitationId);
    },

    async findById(id) {
        const doc = await db.collection('clan_invitations').doc(id).get();
        return docToObject(doc);
    },

    async findByClan(clanId) {
        const snapshot = await db.collection('clan_invitations')
            .where('clanId', '==', clanId)
            .get();
        return queryToArray(snapshot);
    },

    async delete(id) {
        await db.collection('clan_invitations').doc(id).delete();
        return { success: true };
    }
};

// ============== MEMBER OPERATIONS ==============

const MemberService = {
    async create(memberData) {
        const payload = sanitizeForFirestore({
            ...memberData,
            joinDate: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        const docRef = await db.collection(COLLECTIONS.MEMBERS).add(payload);
        const doc = await docRef.get();
        return docToObject(doc);
    },

    async findById(id) {
        const doc = await db.collection(COLLECTIONS.MEMBERS).doc(id).get();
        return docToObject(doc);
    },

    async findByIdWithClan(id) {
        const member = await this.findById(id);
        if (member && member.clanId) {
            const clan = await ClanService.findById(member.clanId);
            member.clan = clan ? { name: clan.name, tag: clan.tag } : null;
        }
        return member;
    },

    async findByPlayerId(playerId) {
        const snapshot = await db.collection(COLLECTIONS.MEMBERS)
            .where('playerId', '==', playerId)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async findByPlayerIdOrNameInClan(playerId, playerName, clanId) {
        // Check by playerId
        let snapshot = await db.collection(COLLECTIONS.MEMBERS)
            .where('playerId', '==', playerId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return docToObject(snapshot.docs[0]);
        }

        // Check by playerName and clan
        snapshot = await db.collection(COLLECTIONS.MEMBERS)
            .where('playerName', '==', playerName)
            .where('clanId', '==', clanId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return docToObject(snapshot.docs[0]);
        }

        return null;
    },

    async findByNameInClan(playerName, clanId) {
        const snapshot = await db.collection(COLLECTIONS.MEMBERS)
            .where('playerName', '==', playerName)
            .where('clanId', '==', clanId)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async findByClan(clanId, activeOnly = true) {
        let query = db.collection(COLLECTIONS.MEMBERS).where('clanId', '==', clanId);
        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }
        const snapshot = await query.get();
        return queryToArray(snapshot).sort((a, b) =>
            (a.playerName || '').localeCompare(b.playerName || '')
        );
    },

    async update(id, data) {
        await db.collection(COLLECTIONS.MEMBERS).doc(id).update(data);
        return this.findById(id);
    },

    async softDelete(id) {
        await db.collection(COLLECTIONS.MEMBERS).doc(id).update({
            isActive: false,
            deletedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    },

    async bulkCreate(members) {
        const batch = db.batch();
        const refs = [];

        for (const memberData of members) {
            const ref = db.collection(COLLECTIONS.MEMBERS).doc();
            batch.set(ref, sanitizeForFirestore({
                ...memberData,
                joinDate: admin.firestore.FieldValue.serverTimestamp(),
                isActive: true
            }));
            refs.push(ref);
        }

        await batch.commit();

        // Fetch created documents
        const results = [];
        for (const ref of refs) {
            const doc = await ref.get();
            results.push(docToObject(doc));
        }
        return results;
    },

    async linkToUser(memberId, userId) {
        // Link a member to a Firebase user
        await db.collection(COLLECTIONS.MEMBERS).doc(memberId).update({ userId });
        return this.findById(memberId);
    },

    async findByUserIdAndClan(userId, clanId) {
        // Find if user is linked to any member in this clan
        const snapshot = await db.collection(COLLECTIONS.MEMBERS)
            .where('userId', '==', userId)
            .where('clanId', '==', clanId)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async isMemberOfClan(userId, clanId) {
        // Check if user is a member of the clan
        const member = await this.findByUserIdAndClan(userId, clanId);
        return member !== null;
    }
};

// ============== RESULT OPERATIONS ==============

const ResultService = {
    async create(resultData) {
        const payload = sanitizeForFirestore({
            ...resultData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const docRef = await db.collection(COLLECTIONS.RESULTS).add(payload);
        const doc = await docRef.get();
        return docToObject(doc);
    },

    async findById(id) {
        const doc = await db.collection(COLLECTIONS.RESULTS).doc(id).get();
        return docToObject(doc);
    },

    async findByMemberClanWeek(memberId, clanId, week) {
        const snapshot = await db.collection(COLLECTIONS.RESULTS)
            .where('memberId', '==', memberId)
            .where('clanId', '==', clanId)
            .where('week', '==', week)
            .limit(1)
            .get();
        return snapshot.empty ? null : docToObject(snapshot.docs[0]);
    },

    async upsertByMemberClanWeek(memberId, clanId, week, data) {
        const existing = await this.findByMemberClanWeek(memberId, clanId, week);

        if (existing) {
            await db.collection(COLLECTIONS.RESULTS).doc(existing.id).update({
                ...data,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            return this.findById(existing.id);
        } else {
            return this.create({
                memberId,
                clanId,
                week,
                ...data
            });
        }
    },

    async findByClanAndWeek(clanId, week) {
        const snapshot = await db.collection(COLLECTIONS.RESULTS)
            .where('clanId', '==', clanId)
            .where('week', '==', week)
            .get();
        return queryToArray(snapshot);
    },

    async findByClanAndWeeks(clanId, weeks) {
        // Firestore 'in' query supports max 30 values
        const results = [];
        const chunkSize = 30;

        for (let i = 0; i < weeks.length; i += chunkSize) {
            const chunk = weeks.slice(i, i + chunkSize);
            const snapshot = await db.collection(COLLECTIONS.RESULTS)
                .where('clanId', '==', clanId)
                .where('week', 'in', chunk)
                .get();
            results.push(...queryToArray(snapshot));
        }

        return results;
    },

    async findByClan(clanId) {
        const snapshot = await db.collection(COLLECTIONS.RESULTS)
            .where('clanId', '==', clanId)
            .get();
        return queryToArray(snapshot);
    },

    async findWithFilters(filters) {
        let query = db.collection(COLLECTIONS.RESULTS);

        if (filters.clanId) {
            query = query.where('clanId', '==', filters.clanId);
        }
        if (filters.week) {
            query = query.where('week', '==', filters.week);
        }

        const snapshot = await query.get();
        return queryToArray(snapshot);
    },

    // Populate member data for results
    async populateMembers(results) {
        const memberIds = [...new Set(results.map(r => r.memberId))];
        const members = {};

        for (const memberId of memberIds) {
            const member = await MemberService.findById(memberId);
            if (member) {
                members[memberId] = member;
            }
        }

        return results.map(r => ({
            ...r,
            member: members[r.memberId] || null
        }));
    }
};

// ============== USER OPERATIONS ==============

const UserService = {
    async findOrCreate(userData) {
        const { uid, email, name, picture } = userData;
        const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
        const doc = await userRef.get();

        if (doc.exists) {
            // Update last login and any changed info
            await userRef.update({
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                email: email,
                name: name,
                picture: picture
            });
            const updated = await userRef.get();
            return docToObject(updated);
        }

        // Create new user
        await userRef.set({
            uid,
            email,
            name,
            picture,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });
        const newDoc = await userRef.get();
        return docToObject(newDoc);
    },

    async findById(uid) {
        const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
        return docToObject(doc);
    },

    async update(uid, data) {
        await db.collection(COLLECTIONS.USERS).doc(uid).update(data);
        return this.findById(uid);
    }
};

module.exports = {
    db,
    admin,
    ClanService,
    CommunityService,
    ClanInvitationService,
    MemberService,
    ResultService,
    UserService,
    COLLECTIONS
};
