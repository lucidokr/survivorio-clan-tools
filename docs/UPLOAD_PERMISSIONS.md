# Soluzioni per permettere ad altri membri di caricare risultati

## Implementazione attuale

✅ **Già implementato**: Tutti gli utenti autenticati possono caricare risultati per qualsiasi clan (dopo login)

## Tre opzioni di implementazione:

### Opzione 1: Semplice - Chiunque sia membro del clan

**Pro:**

- Rapido da implementare
- Intuitivo per gli utenti
- Niente modifiche al DB

**Contro:**

- Permette a chiunque di caricare per qualsiasi clan (se conosce l'ID)

**Implementazione:**

```javascript
// Nel Member model, aggiungere:
userId: String; // Firebase UID dell'utente

// Nel verifyClanAccess:
const memberOfClan = await MemberService.findByClan(clanId);
const userIsMember = memberOfClan.some((m) => m.userId === userId);

if (clan.ownerId === userId || userIsMember) {
    return { clan };
}
return { error: "Not authorized", status: 403 };
```

---

### Opzione 2: Con Ruoli

**Pro:**

- Controllo granulare dei permessi
- Scalabile per il futuro

**Contro:**

- Richiede modifiche al DB
- UI più complessa per gestire ruoli

**Ruoli proposti:**

- `owner` - Crea clan, gestisce membri, carica risultati
- `uploader` - Può caricare risultati
- `viewer` - Solo visualizza (default)

**Implementazione:**

```javascript
// Nel Member model:
{
  playerName: String,
  clanId: String,
  userId: String,
  role: 'owner' | 'uploader' | 'viewer',  // NEW
  joinDate: Date,
  isActive: Boolean
}

// Nel verifyClanAccess:
if (clan.ownerId === userId) return { clan };

const member = memberOfClan.find(m => m.userId === userId);
if (member?.role === 'uploader' || member?.role === 'owner') {
  return { clan };
}
return { error: 'Not authorized to upload', status: 403 };
```

---

### Opzione 3: Collegamento Utente-Membro

**Pro:**

- Soluzione più sicura
- Previene upload non autorizzati

**Contro:**

- Richiede collegamento al signup/join clan

**Implementazione:**

```javascript
// Quando un utente si registra al clan:
1. Creare/aggiornare record Member con userId
2. Verificare che l'utente sia il creator del Member
3. Solo quel membro può caricare

// Nel route POST /results/extract:
const member = await MemberService.findByClan(clanId);
const userMember = member.find(m => m.userId === userId);

if (!userMember && clan.ownerId !== userId) {
  return { error: 'Not a member of this clan', status: 403 };
}
```

---

## Consiglio

**Opzione 1 + Opzione 3 insieme** = Soluzione ideale

- Semplice da implementare
- Sicura (verifica vera membership)
- Non richiede ruoli complessi

### Step implementativi:

1. Aggiungere campo `userId` al model Member
2. Quando membro si registra, salvare il suo Firebase UID
3. Nel upload, verificare che esista un Member con (clanId, userId)

---

## Frontend - MemberManagement.js

Aggiungere sezione per collegare utenti ai membri:

```javascript
// Nuovo button in member row:
"Collegami a questo profilo";
// Al click, salva il Firebase UID nel Member
```

Quale opzione preferisci?
