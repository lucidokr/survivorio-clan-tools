# Analisi API Invitations - Nuova Struttura Backend

## Panoramica Generale

Il sistema è stato completamente redesegnato per permettere agli owner dei clan di invitare i membri tramite **email**. La nuova API utilizza una collection separata `clan_invitations` per gestire lo stato dei permessi, mantenendo i dati dei giocatori nella collection `members`.

---

## 1. STRUTTURA DATI

### A. Collection `clan_invitations` (NUOVA)

**Ubicazione:** Database Firestore `clans-tools`

```javascript
{
  id: String,              // Firestore document ID (generato automaticamente)
  clanId: String,          // Riferimento al clan
  memberId: String,        // Riferimento al membro specifico (dal clan)
  email: String,           // Email dell'invitato (sempre lowercase)
  role: String,            // 'uploader' | 'viewer' | 'editor'
  invitedAt: Timestamp,    // Data/ora creazione invito
  status: String,          // 'pending' | 'accepted' | 'rejected'
  acceptedAt: Timestamp,   // Data/ora primo login dell'utente (se accepted)
  invitedByEmail: String   // Email dell'owner che ha inviato l'invito
}
```

**Nota su `memberId`:**

- Il sistema crea una invitation legando un **membro specifico** a un'email
- Ciò consente all'owner di dire: "Invita QUESTO giocatore con QUESTO ruolo a questa email"

### B. Collection `clans` (Modificata)

Nessun cambio strutturale, ma ora usata con:

- `ownerId`: Firebase UID dell'owner
- `ownersEmail`: Email dell'owner (per tracciamento inviti)

### C. Collection `members` (Invariata)

```javascript
{
  id: String,
  playerName: String,
  playerId: String,
  clanId: String,
  phoneNumber: String,
  discordNickname: String,
  joinDate: Timestamp,
  isActive: Boolean
}
```

**Importante:** NON ha `userId` - la relazione con l'utente avviene tramite `clan_invitations.email`

---

## 2. FLUSSO DI ACCESSO AI CLAN

### Logica di Verifica Accesso

Un utente può accedere a un clan se:

```
(userId === clan.ownerId)
  OPPURE
(esiste record in clan_invitations dove:
  - email === user.email
  - clanId === target_clan
  - status === 'accepted')
```

### Per la Visualizzazione nel Dashboard

```javascript
// In ClanService.findAccessibleClans(userId, userEmail)
1. Recupera tutti i clan dove sei owner
2. Recupera tutte le clan_invitations per la tua email
3. Filtra solo quelle con status === 'accepted'
4. Per ogni invitation accepted, recupera il clan corrispondente
5. Aggiungi il campo myRole da invitation.role
6. Ritorna lista combinata (senza duplicati)
```

---

## 3. ENDPOINT API

### NEW: POST `/members/invite`

**Invia un invito per aggiungere un membro al clan**

**Richiedente:** Owner del clan (via auth middleware)

**Body:**

```json
{
    "clanId": "abc123",
    "memberId": "member456",
    "email": "user@example.com",
    "role": "uploader"
}
```

**Validazioni:**

- ✅ `clanId` + `memberId` + `email` + `role` obbligatori
- ✅ User autenticato è owner del `clanId`
- ✅ Il `memberId` esiste e appartiene al clan
- ✅ L'email viene resa lowercase prima di salvare

**Risposta Success (200):**

```json
{
    "message": "Invitation sent",
    "invitation": {
        "id": "inv789",
        "clanId": "abc123",
        "memberId": "member456",
        "email": "user@example.com",
        "role": "uploader",
        "invitedAt": "2025-02-02T10:30:00Z",
        "status": "pending",
        "invitedByEmail": "owner@example.com"
    }
}
```

**Errori Possibili:**

- `400` Missing required fields
- `403` Only clan owner can invite members
- `404` Member not found in this clan
- `500` Failed to send invitation

---

### NEW: DELETE `/members/invite/:invitationId`

**Cancella un invito (revoca accesso)**

**Richiedente:** Owner del clan

**Validazioni:**

- ✅ Invitation esiste
- ✅ User è owner del clan correlato

**Risposta Success (200):**

```json
{
    "message": "Invitation deleted",
    "invitationId": "inv789"
}
```

---

### NEW: GET `/clan/:clanId/invitations`

**Ritorna tutte le invitations per un clan**

**Richiedente:** Owner del clan (protetto da auth + ownership check)

**Risposta Success (200):**

```json
[
    {
        "id": "inv789",
        "clanId": "abc123",
        "memberId": "member456",
        "email": "user@example.com",
        "role": "uploader",
        "status": "pending",
        "invitedAt": "2025-02-02T10:30:00Z",
        "invitedByEmail": "owner@example.com"
    },
    {
        "id": "inv790",
        "clanId": "abc123",
        "memberId": "member457",
        "email": "another@example.com",
        "role": "viewer",
        "status": "accepted",
        "acceptedAt": "2025-02-02T11:45:00Z",
        "invitedByEmail": "owner@example.com"
    }
]
```

---

### MODIFIED: GET `/clan/my-clans`

**Ritorna i clan dove l'utente è owner O invitato**

**Richiedente:** Any authenticated user

**Logica:**

```javascript
1. Cerca clan dove userId === ownerId
2. Cerca clan_invitations per email con status === 'accepted'
3. Recupera i clan associati
4. Aggiungi myRole === 'owner' per i clan posseduti
5. Aggiungi myRole dal record invitation per gli altri
```

**Risposta Success (200):**

```json
[
    {
        "id": "clan1",
        "name": "Dragon Slayers",
        "tag": "DRAG",
        "ownerId": "user123",
        "myRole": "owner",
        "createdAt": "2025-01-15T08:00:00Z"
    },
    {
        "id": "clan2",
        "name": "Sunset Warriors",
        "tag": "SWAR",
        "ownerId": "otheruser456",
        "myRole": "uploader",
        "createdAt": "2025-01-10T09:30:00Z"
    }
]
```

---

### MODIFIED: GET `/members/clan/:clanId`

**Ritorna i membri di un clan**

**Richiedente:**

- Owner del clan OPPURE
- Utente invitato con status === 'accepted'

**Verifica Accesso:**

```javascript
// In ClanService.verifyUserAccess(clanId, userId, userEmail)
if (clan.ownerId === userId) return { canAccess: true, role: "owner" };

const invitation = await ClanInvitationService.findByEmailAndClan(
    userEmail,
    clanId,
);
if (invitation && invitation.status === "accepted") {
    return { canAccess: true, role: invitation.role };
}

return { canAccess: false };
```

**Risposta Success (200):**

```json
[
    {
        "id": "member1",
        "_id": "member1",
        "playerName": "DragonKnight",
        "playerId": "123456",
        "clanId": "clan1",
        "phoneNumber": "+39 320 123 4567",
        "discordNickname": "DragonKnight#1234",
        "joinDate": "2025-01-15T08:00:00Z",
        "isActive": true
    },
    {
        "id": "member2",
        "_id": "member2",
        "playerName": "ShadowAssassin",
        "playerId": "789012",
        "clanId": "clan1",
        "phoneNumber": "+39 320 234 5678",
        "discordNickname": "ShadowAssassin#5678",
        "joinDate": "2025-01-16T10:30:00Z",
        "isActive": true
    }
]
```

---

## 4. SERVIZI FIREBASESERVICE.JS

### ClanInvitationService

```javascript
const ClanInvitationService = {
  // Crea nuova invitation
  async create(clanId, memberId, email, role, invitedByEmail)

  // Trova invitation per email e clan specifico
  async findByEmailAndClan(email, clanId)

  // Trova tutte le invitations per un'email
  async findByEmail(email)

  // Accetta un'invitation
  async accept(invitationId)

  // Trova per ID
  async findById(id)

  // Trova tutte le invitations di un clan
  async findByClan(clanId)

  // Cancella un'invitation
  async delete(id)
}
```

### ClanService.findAccessibleClans()

```javascript
async findAccessibleClans(userId, userEmail) {
  const ownedClans = await this.findByOwner(userId);

  const invitations = await ClanInvitationService.findByEmail(userEmail);
  const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted');

  const memberClanObjects = [];
  for (const invitation of acceptedInvitations) {
    const clan = await this.findById(invitation.clanId);
    if (clan && clan.isActive) {
      memberClanObjects.push({
        ...clan,
        myRole: invitation.role,
        invitationId: invitation.id
      });
    }
  }

  const allClans = [...ownedClans, ...memberClanObjects];
  const uniqueMap = new Map(allClans.map(c => [c.id, c]));
  return Array.from(uniqueMap.values());
}
```

### ClanService.verifyUserAccess()

```javascript
async verifyUserAccess(clanId, userId, userEmail) {
  const clan = await this.findById(clanId);
  if (!clan) return { canAccess: false };

  // Owner
  if (clan.ownerId === userId) {
    return { canAccess: true, role: 'owner' };
  }

  // Membro invitato con accesso accepted
  const invitation = await ClanInvitationService.findByEmailAndClan(userEmail, clanId);
  if (invitation && invitation.status === 'accepted') {
    return { canAccess: true, role: invitation.role };
  }

  return { canAccess: false };
}
```

---

## 5. FLUSSO TIPICO DI UTILIZZO

### Scenario: Owner invita un nuovo membro

```
1. Owner accede al dashboard
   - Vede il clan di sua proprietà
   - myRole = 'owner'

2. Owner va in "Gestione Membri"
   - Clicca "Aggiungi Membro"
   - Inserisce: playerName, playerId, email, ruolo

3. Backend:
   - POST /members/create → crea il record in members collection
   - POST /members/invite → crea il record in clan_invitations
     {
       clanId: "clan1",
       memberId: "newly_created",
       email: "newmember@example.com",
       role: "uploader"
     }

4. Il nuovo membro riceve notifica (TODO: email)
   - Accede all'app
   - Si autentica con email "newmember@example.com"
   - AuthContext recupera le accessible clans
   - GET /clan/my-clans ritorna il clan con myRole: "uploader"

5. Nel dashboard:
   - Vede il clan dove è stato invitato
   - Può visualizzare i risultati (se ha permesso viewer/uploader)
   - Può caricare risultati (se ha permesso uploader)
```

### Scenario: Revoca accesso

```
1. Owner accede al clan
   - GET /clan/:clanId/invitations → vede tutti gli inviti

2. Owner vuole revocare accesso a un membro
   - DELETE /members/invite/:invitationId

3. Backend:
   - Cancella il record from clan_invitations
   - Verifica owner del clan

4. Il membro:
   - Al prossimo login, GET /clan/my-clans
   - NON vede più il clan (invitation rimossa)
   - Accesso negato se prova a GET /members/clan/:clanId
```

---

## 6. RELAZIONI TRA I DATI

```
┌─────────────────────────────────────────┐
│         CLAN (clans collection)         │
│  id, name, tag, ownerId, isActive       │
└────────────┬────────────────────────────┘
             │
             ├─► HAS MANY MEMBERS
             │   (members collection)
             │   via members.clanId
             │
             └─► HAS MANY INVITATIONS
                 (clan_invitations collection)
                 via clan_invitations.clanId

┌──────────────────────────────────────────┐
│    INVITATION (clan_invitations)         │
│  id, clanId, memberId, email, role       │
│  status, invitedAt, acceptedAt           │
└────────────┬─────────────────────────────┘
             │
             ├─► BELONGS_TO CLAN
             │   via clanId → clans.id
             │
             └─► BELONGS_TO MEMBER
                 via memberId → members.id

┌──────────────────────────────────────────┐
│      MEMBER (members collection)         │
│  id, playerName, playerId, clanId        │
│  phoneNumber, discordNickname            │
└──────────────────────────────────────────┘
```

**Flusso di accesso:**

```
USER (email) → clan_invitations (status='accepted') → CLAN
                          ↓
                       MEMBER
                      (ruolo)
```

---

## 7. RUOLI E PERMESSI

| Ruolo        | Descrizione            | Permessi                                                                                              |
| ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| **owner**    | Owner del clan         | • Crea inviti<br>• Revoca inviti<br>• Gestisce membri<br>• Visualizza risultati<br>• Carica risultati |
| **uploader** | Può caricare risultati | • Visualizza risultati<br>• Carica risultati                                                          |
| **editor**   | Può modificare dati    | • Visualizza risultati<br>• Modifica risultati                                                        |
| **viewer**   | Sola lettura           | • Visualizza risultati                                                                                |

**Nota:** Il ruolo è memorizzato in `clan_invitations.role`

---

## 8. IMPLEMENTAZIONE ATTUALE - FILE COINVOLTI

### firebaseService.js

- ✅ `ClanInvitationService` - Completo con tutte le funzioni
- ✅ `ClanService.findAccessibleClans()` - Funzione di discovery
- ✅ `ClanService.verifyUserAccess()` - Controllo accesso

### routes/members.js

- ✅ `POST /invite` - Crea invitation
- ✅ `DELETE /invite/:invitationId` - Revoca invitation
- ✅ `GET /clan/:clanId` - Con verifica accesso migliorata

### routes/clan.js

- ✅ `GET /my-clans` - Endpoint per discovery clan accessibili
- ✅ `GET /:clanId/invitations` - Recupera invitations per clan

---

## 9. TODO IMPLEMENTATI / IN SOSPESO

### ✅ Completati

- [x] Struttura collection `clan_invitations`
- [x] ClanInvitationService con tutte le operazioni CRUD
- [x] Endpoint POST `/members/invite`
- [x] Endpoint DELETE `/members/invite/:invitationId`
- [x] Endpoint GET `/clan/:clanId/invitations`
- [x] Endpoint GET `/clan/my-clans`
- [x] Logica di verifica accesso multilivello
- [x] Integrazione ruoli in responses

### ⏳ In Sospeso

- [ ] Invio email reale per le invitations (TODO nel codice)
- [ ] Frontend: Schermata di gestione inviti
- [ ] Frontend: Dashboard aggiornata con "I miei clan"
- [ ] Frontend: Accettazione/Rifiuto inviti
- [ ] Notification system per accettazione

---

## 10. ESEMPI DI RISPOSTA API

### Scenario: GET /clan/my-clans per utente con owner + invito

**Request:**

```
GET /clan/my-clans
Authorization: Bearer <token>
```

**Risposta (200):**

```json
[
    {
        "id": "clan_abc123",
        "_id": "clan_abc123",
        "name": "Dragon Hunters",
        "tag": "DRAG",
        "ownerId": "user_xyz789",
        "myRole": "owner",
        "createdAt": {
            "seconds": 1735641600,
            "nanoseconds": 0
        }
    },
    {
        "id": "clan_def456",
        "_id": "clan_def456",
        "name": "Shadow League",
        "tag": "SHAD",
        "ownerId": "user_other111",
        "myRole": "uploader",
        "createdAt": {
            "seconds": 1735500000,
            "nanoseconds": 0
        }
    }
]
```

### Scenario: GET /clan/:clanId/invitations

**Request:**

```
GET /clan/clan_abc123/invitations
Authorization: Bearer <owner_token>
```

**Risposta (200):**

```json
[
    {
        "id": "inv_001",
        "clanId": "clan_abc123",
        "memberId": "member_001",
        "email": "player1@example.com",
        "role": "uploader",
        "status": "accepted",
        "invitedAt": {
            "seconds": 1738431000,
            "nanoseconds": 0
        },
        "acceptedAt": {
            "seconds": 1738432500,
            "nanoseconds": 0
        },
        "invitedByEmail": "owner@example.com"
    },
    {
        "id": "inv_002",
        "clanId": "clan_abc123",
        "memberId": "member_002",
        "email": "player2@example.com",
        "role": "viewer",
        "status": "pending",
        "invitedAt": {
            "seconds": 1738440000,
            "nanoseconds": 0
        },
        "invitedByEmail": "owner@example.com"
    }
]
```

### Scenario: POST /members/invite

**Request:**

```
POST /members/invite
Authorization: Bearer <owner_token>

{
  "clanId": "clan_abc123",
  "memberId": "member_newuser",
  "email": "newplayer@example.com",
  "role": "editor"
}
```

**Risposta (200):**

```json
{
    "message": "Invitation sent",
    "invitation": {
        "id": "inv_003",
        "clanId": "clan_abc123",
        "memberId": "member_newuser",
        "email": "newplayer@example.com",
        "role": "editor",
        "status": "pending",
        "invitedAt": {
            "seconds": 1738450000,
            "nanoseconds": 0
        },
        "invitedByEmail": "owner@example.com"
    }
}
```

---

## 11. CONSIDERAZIONI ARCHITETTURALI

### Scelta: Perché `clan_invitations` separato?

**Vantaggi:**

- ✅ Email è il primary key per l'accesso (non Firebase UID)
- ✅ Storico completo delle invitations (pending/accepted/rejected)
- ✅ Ruolo separato dalla collection members
- ✅ Facile revoca accesso (delete documento)
- ✅ Supporta inviti a membro specifico con ruolo specifico

**Svantaggi:**

- ⚠️ Query aggiuntive necessarie per verifica accesso
- ⚠️ Sincronizzazione manuale fra members e invitations

### Scelta: Perché il memberId nell'invitation?

**Reasoning:**

- Consente di tracciare quale SPECIFICO giocatore è stato invitato
- Evita ambiguità se lo stesso email viene invitato per più giocatori
- Permette relazioni chiare fra players e inviti

---

## RIEPILOGO FUNZIONALE

| Aspetto                | Implementazione                    |
| ---------------------- | ---------------------------------- |
| Collection separata    | ✅ `clan_invitations`              |
| Verifica multi-livello | ✅ Owner + Invited (email)         |
| Ruoli supportati       | ✅ owner, uploader, viewer, editor |
| Inviti per email       | ✅ Sì, sempre lowercase            |
| Endpoint discovery     | ✅ GET /clan/my-clans              |
| Gestione inviti        | ✅ POST /invite, DELETE /invite    |
| Controllo accesso      | ✅ verifyUserAccess()              |
| Ruoli in response      | ✅ myRole incluso in risposte clan |
