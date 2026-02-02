# Configurazione Autenticazione Google OAuth

## Passi per abilitare l'autenticazione

### 1. Abilita Google Sign-In nella Console Firebase

1. Vai alla [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto **clan-tools-485613**
3. Nel menu laterale, vai su **Build > Authentication**
4. Clicca su **Get started** se non hai ancora abilitato l'autenticazione
5. Nella tab **Sign-in method**, clicca su **Google**
6. Abilita il provider (switch ON)
7. Inserisci il tuo email come supporto
8. Clicca **Save**

### 2. Aggiungi Web App nella Console Firebase

1. Vai su **Project Settings** (icona ingranaggio)
2. Scorri fino a "Your apps"
3. Clicca su **Add app** e seleziona **Web** (icona `</>`)
4. Nome app: `clan-stats-frontend`
5. ✅ Seleziona "Also set up Firebase Hosting" (opzionale)
6. Clicca **Register app**
7. Copia le configurazioni Firebase

### 3. Configura il Frontend

Crea il file `.env` nella cartella `clan-stats-frontend`:

```env
REACT_APP_API_URL=http://localhost:5000

REACT_APP_FIREBASE_API_KEY=<apiKey dal passaggio 2>
REACT_APP_FIREBASE_AUTH_DOMAIN=clan-tools-485613.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=clan-tools-485613
REACT_APP_FIREBASE_STORAGE_BUCKET=clan-tools-485613.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId dal passaggio 2>
REACT_APP_FIREBASE_APP_ID=<appId dal passaggio 2>
```

### 4. Configura Domini Autorizzati

1. In Firebase Console > Authentication > Settings > Authorized domains
2. Aggiungi `localhost` (dovrebbe già essere presente)
3. In produzione, aggiungi il tuo dominio (es. `tuodominio.com`)

### 5. Assegna i Clan Esistenti a un Utente

Dopo il primo login, esegui questo script per assegnare i clan esistenti al tuo account:

```bash
cd clan-stats-backend

# Trova il tuo UID:
# 1. Fai login nell'app
# 2. Vai su Firebase Console > Authentication > Users
# 3. Copia l'UID del tuo account

node scripts/assign-clan-owner.js <TUO_UID>
```

## Struttura delle API Protette

Tutte le API ora richiedono autenticazione tramite Bearer token:

```http
Authorization: Bearer <firebase_id_token>
```

### Endpoint Pubblici

- `POST /api/auth/sync` - Sincronizza utente dopo login

### Endpoint Protetti

- `GET /api/auth/me` - Info utente corrente
- `GET /api/clan` - Lista clan dell'utente
- `GET /api/clan/my` - Lista clan dell'utente (alias)
- `POST /api/clan/register` - Registra nuovo clan
- `GET /api/members/clan/:clanId` - Membri del clan
- `GET /api/results` - Risultati
- `GET /api/results/statistics/:clanId` - Statistiche

## Regole di Accesso

- **Utenti possono vedere solo i propri clan**
- **Ogni clan ha un ownerId che corrisponde all'UID Firebase dell'utente**
- **Le operazioni su membri e risultati verificano che l'utente sia proprietario del clan**

## Test dell'Autenticazione

```bash
# Avvia il backend
cd clan-stats-backend
npm run dev

# Avvia il frontend
cd clan-stats-frontend
npm start

# Apri http://localhost:3000
# Clicca "Accedi con Google"
# Dovresti essere reindirizzato alla Dashboard
```

## Troubleshooting

### Errore "unauthorized_client"

- Verifica che il dominio sia nei domini autorizzati in Firebase Console

### Errore "Invalid token"

- Il token potrebbe essere scaduto, rifare il login
- Verifica che il project ID nel frontend corrisponda a quello del backend

### Errore "Permission denied"

- Verifica che l'utente sia proprietario del clan
- Esegui lo script `assign-clan-owner.js` per assegnare i clan esistenti
