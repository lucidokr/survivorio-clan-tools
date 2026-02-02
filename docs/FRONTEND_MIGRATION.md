# Correzione Autenticazione - Prossimi Passi

## ✅ Completato

1. **Dashboard.js** - ✅ Convertito a usare `api.clan.getMyClans()`
2. **ClanRegistration.js** - ✅ Convertito a usare `api.clan.register()`
3. **MemberManagement.js** - ✅ Convertito a usare `api.clan.getMyClans()` e `api.members.getByClan()`

## 📋 Ancora da aggiornare

I seguenti file usano ancora `axios` diretto e devono essere aggiornati per usare il modulo `api`:

### Pagine (pages/)

- `MembersImport.js` - ❌ Usa axios per clan, members-import API
- `MembersManualImport.js` - ❌ Usa axios per clan, members-import API
- `ResultsManualImport.js` - ❌ Usa axios per clan, results API
- `ResultUpload.js` - ❌ Usa axios per clan, members, results API
- `Statistics.js` - ❌ Usa axios per clan, results API

## 🔧 Come aggiornare (Esempio)

### Prima (usando axios):

```javascript
import axios from "axios";

const response = await axios.get("http://localhost:5000/api/clan");
const members = response.data;
```

### Dopo (usando api service):

```javascript
import api from "../services/api";

const members = await api.members.getByClan(selectedClan);
```

## 📚 API Service disponibile

```javascript
// Clan
api.clan.getMyClans();
api.clan.getAll();
api.clan.getById(id);
api.clan.register(formData);

// Members
api.members.getByClan(clanId);
api.members.getById(id);
api.members.create(data);
api.members.update(id, data);
api.members.delete(id);
api.members.bulkUpdate(clanId, members);

// Members Import
api.membersImport.preview(formData);
api.membersImport.import(clanId, members);

// Results
api.results.getAll(params);
api.results.getByClanAndWeek(clanId, week);
api.results.getStatistics(clanId, weeks);
api.results.compare(clanId, week);
api.results.extract(formData);
api.results.bulkSave(data);
api.results.upload(formData);
api.results.addManual(data);
```

## ⚙️ Errore Attuale Risolto

**Errore**: `No token provided. Please include Authorization header with Bearer token.`

**Causa**: I componenti usavano `axios` diretto senza inviare il Bearer token

**Soluzione**: Usare il modulo `api` che aggiunge automaticamente il token a tutte le richieste
