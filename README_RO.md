# Cerul Lumii pentru Windows

Aici e varianta **de instalat pe calculator** a jocului „Cerul Lumii”. Fiecare prieten își face contul lui,
vă adăugați ca prieteni și jucați împreună pe internet, 2–6 oameni (Cerul primește până la 4 companii).

Ca să meargă, ai nevoie de două lucruri:

1. **Un server gratuit pe internet (Render).** Acolo se păstrează conturile, prietenii, mesele și
   scorurile.
2. **Un installer `.exe` pentru Windows.** GitHub îl construiește singur. Prietenii primesc un link,
   îl descarcă și îl instalează.

---

## Ce e în acest folder

| folder / fișier | ce e |
|---|---|
| `server/` | Serverul (Node.js). Ține conturile, prietenii, scorurile „față în față” și mesele de joc. Merge pe Render. |
| `client/` | Partea desktop a jocului: animația de început, intrarea în cont, lobby-ul (mese, prieteni, statistici), bara mică din joc și „traducătorul” `shim.js`, care pune jocul să vorbească cu serverul tău în loc de claude.ai. |
| `electron/` | Aplicația de Windows. `app/` conține jocul copiat, `main.js` fereastra, iar `package.json` setările installerului (în română). |
| `scripts/sync-game.mjs` | Copiază versiunea cea mai nouă a jocului (doar Cerul) din `/home/claude/salon` în aplicație. |
| `scripts/make-icon.py` | Desenează iconița (glob + avion care decolează). |
| `config.json` | **Adresa serverului** cu care pornește aplicația. |
| `render.yaml` | Rețeta pentru Render (serverul gratuit). |
| `.github/workflows/build-windows.yml` | Rețeta pentru GitHub: construiește installerul și îl pune la „Releases”. |
| `test/` | Testele automate (2 jucători simulați, reconectare). |
| `API_SURFACE.md` | Detalii tehnice, pentru Claude sau un programator. |

---

## Pașii, pe rând

### Pasul 1 — Cont GitHub (gratuit)

1. Intră pe **github.com** → **Sign up**. Pui email, parolă și un nume, de exemplu `damian-jocuri`.
2. Fă un repository nou: butonul **+** sus → **New repository**.
   - Nume: `cerul-lumii`
   - Bifează **Public**. E necesar: dintr-un repository privat prietenii nu pot descărca installerul.
     „Public” înseamnă că oricine poate vedea codul jocului.
   - Apasă **Create repository**.
3. Urcă fișierele din folderul `salon-desktop` în repository.
   - **Cel mai simplu:** spune-mi „urcă tu codul în repo-ul meu” și dă-mi numele repository-ului. Îl urc eu.
   - **Singur:** instalezi **GitHub Desktop** → File → Add local repository → alegi folderul →
     **Publish repository**.

### Pasul 2 — Baza de date gratuită (Neon). Obligatoriu pe Render gratuit

Pe planul gratuit, Render **șterge discul serverului** de fiecare dată când serverul „adoarme” (după
15 minute în care nu e nimeni conectat) și la fiecare actualizare. Fără o bază de date separată, s-ar pierde
toate conturile, prietenii și scorurile.

1. Intră pe **neon.tech** → **Sign up**. Poți intra direct cu contul de GitHub.
2. **Create project.** Nume `cerul`, regiune **AWS Europe Central (Frankfurt)**.
3. La **Connection string**, apasă **Copy**. Arată cam așa:
   `postgresql://neondb_owner:XXXX@ep-ceva-123.eu-central-1.aws.neon.tech/neondb?sslmode=require`
4. Păstrează-l: îți trebuie la pasul 3. **E o parolă, nu-l trimite nimănui.**

Planul gratuit Neon are 0,5 GB, adică mult peste ce folosește jocul. Alternativă: **Supabase** (gratuit),
dar acolo proiectul se pune pe pauză după o săptămână în care nu-l folosește nimeni.

### Pasul 3 — Serverul gratuit (Render)

1. Intră pe **render.com** → **Get Started** → intră cu contul de **GitHub**.
2. Apasă **New +** → **Blueprint** → alegi repository-ul `cerul-lumii`. Render găsește singur `render.yaml`.
3. Când îți cere **DATABASE_URL**, lipește textul copiat de la Neon.
4. Apasă **Deploy Blueprint / Apply** și aștepți 2–5 minute.
5. Serviciul **cerul-lumii-server** primește o adresă de forma `https://cerul-lumii-server.onrender.com`.
   Dacă numele era deja luat, adresa are la final niște litere în plus.
6. Verifică: deschide în browser `https://ADRESA-TA.onrender.com/healthz`. Trebuie să vezi `"ok":true`.

### Pasul 4 — Pune adresa serverului în aplicație

În `config.json` schimbi `defaultServer` cu adresa ta, cu **`wss://`** în față:

```json
{ "defaultServer": "wss://cerul-lumii-server.onrender.com" }
```

Apoi rulezi `node scripts/sync-game.mjs` și urci schimbarea pe GitHub. Sau îmi trimiți adresa și fac eu asta.

### Pasul 5 — Construiește installerul

1. Pe GitHub, în repository → tabul **Actions**. Prima dată apasă „I understand… enable”.
2. Alege **Build Windows installer** → **Run workflow** → scrie versiunea (prima dată `1.0.0`) → **Run**.
3. Durează cam 5–10 minute. Când apare bifa verde, mergi la **Releases** (în dreapta paginii repository-ului).
   Acolo e `Cerul-Lumii-Setup.exe`.

### Pasul 6 — Dă link-ul prietenilor

Link-ul care duce mereu la versiunea cea mai nouă:

```
https://github.com/NUMELE-TAU/cerul-lumii/releases/latest/download/Cerul-Lumii-Setup.exe
```

Înlocuiești `NUMELE-TAU` cu numele tău de pe GitHub.

---

## Ce văd prietenii la instalare (avertismentele Windows)

Installerul nu e „semnat”: un certificat de semnare costă bani. De aceea Windows îi avertizează pe
prieteni. E normal. Asta trebuie să facă:

1. **La descărcare, în browser** (Edge sau Chrome) poate apărea „…nu este descărcat de obicei” sau
   „ar putea fi periculos”. Apasă pe **⋯** → **Păstrează** → **Afișează mai multe** → **Păstrează oricum**.
2. **La pornirea installerului** apare un ecran albastru, **„Windows a protejat PC-ul”**.
   - Apasă pe textul mic **„Mai multe informații”**.
   - Apare butonul **„Rulează oricum”**. Apasă-l.
3. Installerul e în română. Poți alege **folderul** de instalare. La final pune o scurtătură pe **Desktop** și
   una în **meniul Start**, apoi pornește jocul.

---

## Cum se joacă

1. **Pornirea:** jocul se deschide pe tot ecranul, cu animația cu avionul. Treci peste ea cu click sau cu orice
   tastă.
   - **F11**, **Esc** sau butonul **⛶** trec între ecran complet și fereastră.
   - Din lobby poți **închide jocul**.
2. **Contul:** prima dată apeși **„Cont nou”** și alegi nume de utilizator, parolă, numele din joc și,
   dacă vrei, email.
   - Cu **„Ține-mă minte”** bifat, nu mai scrii parola data viitoare. Parola rămâne salvată criptat, în
     contul tău de Windows.
   - **„Ieșire din cont”** e în lobby.
   - Doi oameni de pe același calculator își fac fiecare contul lui.
3. **Profilul:** apeși pe numele tău, sus în dreapta. Acolo alegi numele, **numele companiei aeriene**,
   personajul și culoarea. Când te așezi la o masă, jocul le completează singur.
4. **Prietenii:** în dreapta scrii numele de utilizator al prietenului → **Adaugă**. El primește cererea și
   apasă **Acceptă**.
   - În listă vezi cine e **online** și la ce masă stă.
   - Lângă fiecare prieten apare scorul vostru (victoriile tale–victoriile lui). Click pe prieten ca să vezi
     detaliile: partide jucate, câștigate și pierdute, cea mai valoroasă companie a fiecăruia și ultimele
     partide.
5. **O masă:**
   - **„Creează masă”** îți dă un cod de 5 caractere, de exemplu `K7M2Q`.
   - Prietenii intră cu **„Intră cu cod”**. Sau îi chemi direct: în joc, din bara mică de sus, apeși
     **„Invită”** → **Invită** lângă numele lui.
   - Prietenul vede invitația și apasă **„Intră”**.
   - **„Mese”** te duce înapoi la lobby, unde ai prietenii, profilul și alte mese.
   - Bara mică se poate muta: o tragi de **⋮⋮**.
6. **Scorurile** se salvează singure la sfârșitul fiecărei partide: la tine („Statisticile mele”) și pe
   cartonașul fiecărui prieten cu care ai jucat.

### „Se trezește serverul…”

Pe planul gratuit, serverul de pe Render **adoarme după 15 minute** în care nu e nimeni conectat. Primul care
pornește jocul după o pauză îl trezește. Asta durează **30–60 de secunde**, timp în care jocul scrie
„Se trezește serverul…”. După aceea merge normal. Cât timp joacă cineva, serverul nu adoarme.

Dacă pică internetul în timpul jocului, apare „Conexiune pierdută — reconectez…”. Mutările se trimit singure
când revine internetul.

---

## Când apare o versiune nouă a jocului

1. Îmi spui: „fă o versiune nouă de Cerul pentru Windows”. Eu rulez `node scripts/sync-game.mjs` și urc
   schimbările.
2. Pe GitHub: **Actions → Build Windows installer → Run workflow**, cu o versiune **mai mare** (de exemplu
   `1.0.1`).
3. Prietenii descarcă din nou de la **același link** și instalează peste versiunea veche. Conturile, prietenii
   și scorurile rămân, fiindcă stau pe server.

Actualizarea automată nu există încă: e pe lista de mai jos.

---

## Ce mai e de făcut / limite

- **Resetarea parolei pe email** nu e făcută încă. Emailul se salvează, dar nu se trimit mesaje.
- **Semnarea installerului** (fără avertismentul Windows) cere un certificat plătit, cam 100–300 €/an.
- **Actualizarea automată** nu există încă. Momentan fiecare descarcă din nou de la același link.
- Scorurile se bazează pe încrederea între prieteni: un program modificat ar putea trimite un rezultat fals.
- Aplicația de Windows a fost construită și verificată pe Linux, până la pasul final al installerului. Acela
  merge doar pe Windows, adică la GitHub. Prima instalare reală va fi pe calculatorul tău: spune-mi dacă ceva
  arată ciudat.
- Pentru două copii ale jocului pe același PC (ca să testezi cu două conturi), pornești `Cerul Lumii.exe`
  cu `--multi`.

---

## Pentru Claude / programatori: comenzi

```bash
# copiază jocul (doar Cerul) din /home/claude/salon și refă electron/app/index.html
node scripts/sync-game.mjs [calea/spre/salon]

# serverul local
cd server && npm ci && node server.js               # PORT=8787 implicit, date în server/data/
cd server && npm test                               # test de protocol (43 de verificări, cu restart)

# jocul în browser, contra serverului local (fără Electron)
#   servește electron/app (de ex. python3 -m http.server -d electron/app 8080) și deschide
#   http://localhost:8080/index.html?server=ws://localhost:8787
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/e2e.cjs        # 2 jucători, partidă scurtă, ~2,5 min
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/reconnect.cjs  # repornire server, reconectare

# aplicația Electron (pe Windows): cd electron && npm ci && npm start
#   --server=wss://...   alt server;   --dev   F12 = DevTools;   --multi   două copii deodată
```

Setări pentru server (variabile de mediu): `PORT`, `DATABASE_URL` (Postgres; fără ea datele merg în
fișiere, în `DATA_DIR`), `TABLE_TTL_DAYS` (implicit 60), `MAX_USERS`, `MAX_TABLES`.
