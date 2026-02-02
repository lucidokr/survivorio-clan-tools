# Piano: Sistema di Inviti ai Clan per Email

## Obiettivo

**L'owner del clan invita i membri via EMAIL:**

1. Owner crea clan → diventa automaticamente owner
2. Owner invita membri inserendo email + ruolo
3. Chi accede con quella email vede il clan nella dashboard
4. Dashboard mostra: "I miei clan" (owned) + "Clan dove sono invitato" (invited)

---

## 1. MODIFICHE AL DATABASE (Firestore)

### Collection: `clans` - Già esistente

```javascript
{
  id: String (Firestore doc ID),
  name: String,
  tag: String,
  ownerId: String,         // Firebase UID dell'owner
  ownersEmail: String,     // Email dell'owner (da salvare al create)
  createdAt: Timestamp,
  isActive: Boolean
}
```

### Collection: `members` - Rimane per dati giocatore

```javascript
{
  playerName: String,
  playerId: String,
  clanId: String,
  email: String,           // Email dell'utente (aggiunto per linking)
  phoneNumber: String,
  discordNickname: String,
  role: String,            // 'uploader' | 'viewer' | 'editor' (aggiunto per ruoli)
  joinDate: Timestamp,
  isActive: Boolean
}
```

**⚠️ NOTA:** La risposta GET `/clan/:id` ritorna direttamente i membri con email e ruolo - non serve collection `clan_invitations` separata.

---

## 2. LOGICA DI ACCESSO AL CLAN

**Un utente accede a un clan se:**

```
(userId === clan.ownerId)
  OR
(email dell'utente è presente tra i membri del clan con role assegnato)
```

**GET `/clan/:id` ritorna direttamente la lista di membri con email e ruolo di ogni membro.**

---

## 3. MODIFICHE BACKEND

**Semplificato: I dati dei membri sono incorporati nella risposta del clan**

### A. GET `/clan/:id`

Ritorna il clan con array di membri che include email e ruolo:

```javascript
{
  id: String,
  name: String,
  tag: String,
  ownerId: String,
  ownersEmail: String,
  createdAt: Timestamp,
  isActive: Boolean,
  members: [
    {
      playerName: String,
      playerId: String,
      email: String,          // ← Email del membro
      role: String,           // ← 'uploader' | 'viewer' | 'editor'
      phoneNumber: String,
      discordNickname: String,
      joinDate: Timestamp,
      isActive: Boolean
    }
  ]
}
```

### B. POST `/members/invite` - Aggiunge membro al clan

```javascript
// Input:
{
  clanId: String,
  email: String,
  role: String    // 'uploader' | 'viewer' | 'editor'
}

// Operazione: Aggiunge il membro alla collection members
// Risposta: Il nuovo membro con email e ruolo
```

### C. GET `/my-clans` - Lista clan accessibili

```javascript
router.get("/my-clans", authMiddleware, async (req, res) => {
    // Ritorna clan dove sei owner
    const ownedClans = await ClanService.findByOwner(req.user.uid);

    // Ritorna clan dove hai email nei members
    const memberClans = await ClanService.findByMemberEmail(req.user.email);

    // Combina e ritorna
    const allClans = [...ownedClans, ...memberClans];
    res.json(allClans);
});
```

### D. GET `/by-clan/:clanId` - Membri del clan

```javascript
router.get("/by-clan/:clanId", authMiddleware, async (req, res) => {
    const clan = await ClanService.findById(req.params.clanId);

    // Verifica accesso: sei owner O hai email nei members
    const isOwner = clan.ownerId === req.user.uid;
    const isMember = clan.members?.some((m) => m.email === req.user.email);

    if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Not authorized" });
    }

    res.json(clan.members);
});
```

### E. Verifica accesso semplificata

```javascript
const verifyUserAccess = async (clanId, userId, userEmail) => {
    const clan = await ClanService.findById(clanId);
    if (!clan) return { canAccess: false };

    // Owner
    if (clan.ownerId === userId) {
        return { canAccess: true, role: "owner" };
    }

    // Membro invitato
    const member = clan.members?.find((m) => m.email === userEmail);
    if (member) {
        return { canAccess: true, role: member.role };
    }

    return { canAccess: false };
};
```

---

## 4. MODIFICHE FRONTEND

### A. Dashboard.js - Mostra entrambi i clan

✅ Già fetch `/api/clan/my-clans` che ritornerà:

- "I miei clan" (owned)
- "Clan dove sono invitato" (invited)

### B. MemberManagement.js - Solo owner può invitare

**Aggiungere sezione "Invita membro":**

```javascript
// Solo se clan.ownerId === current_user.uid
{
    isOwner && (
        <Dialog open={openInvite} onClose={() => setOpenInvite(false)}>
            <TextField
                label="Email membro"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
            >
                <MenuItem value="uploader">Uploader</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
            </Select>
            <Button onClick={handleInvite}>Invita</Button>
        </Dialog>
    );
}
```

**Funzione:**

```javascript
const handleInvite = async () => {
    try {
        await api.members.post("/invite", {
            clanId,
            email: inviteEmail,
            role: inviteRole,
        });
        toast.success("Invito inviato!");
        setOpenInvite(false);
    } catch (error) {
        toast.error(error.response?.data?.error || "Errore");
    }
};
```

### C. API Service - Aggiungi metodo

```javascript
export const membersAPI = {
    post: (url, data) => apiCall("post", `/members${url}`, data, true),
    // ...
};
```

---

## 5. FLUSSO UTENTE

### Scenario 1: Marco (crea il clan "Italia")

1. ✅ Marco fa login con Google (marco@gmail.com)
2. ✅ Clicca "Crea clan"
3. ✅ Inserisce nome "Italia", tag "ITA"
4. ✅ Clan creato con marco come owner
5. ✅ Marco va in Gestione Membri
6. ✅ Marco clicca "Invita membro"
7. ✅ Inserisce "giuseppe@gmail.com" ruolo "uploader"
8. ✅ Invitation creata con status "pending"

### Scenario 2: Giuseppe (accetta invito)

1. ✅ Giuseppe riceve email di invito (futura feature)
2. ✅ Giuseppe fa login con Google (giuseppe@gmail.com)
3. ✅ Sistema vede invitation pending e la cambia a "accepted"
4. ✅ Dashboard di Giuseppe mostra clan "Italia"
5. ✅ Giuseppe può caricare risultati
6. ❌ Giuseppe NON può gestire clan (solo uploader)

### Scenario 3: Luca (no access)

1. ✅ Luca fa login
2. ❌ Dashboard vuota
3. ❌ Se prova URL clan: errore 403

---

## 6. PERMESSI RISULTANTI

| Utente   | Ruolo    | Vede clan? | Carica? | Gestisce? |
| -------- | -------- | ---------- | ------- | --------- |
| Marco    | owner    | ✅         | ✅      | ✅        |
| Giuseppe | uploader | ✅         | ✅      | ❌        |
| Pietro   | viewer   | ✅         | ❌      | ❌        |
| Luca     | none     | ❌         | ❌      | ❌        |

---

## 7. RUOLI PROPOSTI

- **owner**: Crea clan, invita, gestisce tutto
- **uploader**: Carica risultati
- **viewer**: Solo legge dati
- **editor**: Carica + modifica risultati

---

## 8. STEP IMPLEMENTATIVI

1. ✅ Collection `members` estesa con email e role
2. ✅ ClanService: findAccessibleClans, verifyUserAccess semplificati
3. ✅ POST `/members/invite` - aggiunge membro
4. ✅ GET `/my-clans` - ritorna clan owned + member clans
5. ✅ GET `/by-clan/:id` - ritorna membri con email e ruolo
6. ✅ GET `/clan/:id` - ritorna clan con members array
7. ✅ Frontend: MemberManagement UI per inviti
8. 🧪 Test completo

---

## ✅ ARCHITETTURA FINALE (Semplificata)

**NO collection `clan_invitations` separata**

```
clans
├── id
├── name
├── tag
├── ownerId
├── ownersEmail
├── createdAt
└── isActive

members
├── playerName
├── playerId
├── clanId
├── email          ← Collega membro all'utente
├── role           ← 'owner' | 'uploader' | 'viewer' | 'editor'
├── phoneNumber
├── discordNickname
├── joinDate
└── isActive
```

**Accesso = owner OPPURE email è in members lista**
