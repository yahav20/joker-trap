# Joker Trap — ביקורת ארכיטקטונית מקיפה

> **העיקרון המנחה:** משחק ל-4 שחקנים מקסימום, ייתכן עם בוטים, חד-שרתי, Stateless עם Redis כגיבוי.

---

## 1. סקירה כוללת — האם הארכיטקטורה נכונה?

### ✅ WebSocket — בחירה נכונה

למשחק הזה WebSocket הוא בחירה מצוינת ומוצדקת:
- **משחק Real-Time אינטראקטיבי:** כל פעולה (בקשת קלף, הצעת קלף, החלטה) מחייבת הגבה מיידית ל-4 שחקנים. HTTP Request/Response היה יוצר latency מורגש.
- **מספר חיבורים זעיר:** 4 חיבורים בלבד לכל חדר, לרוב חדרים בודדים בו-זמנית. העלות של חיבורים פתוחים כמעט אפסית.
- **Push model חיוני:** הלקוח צריך לקבל עדכונים כשהיריב עושה פעולה — לא כשהוא שולח בקשה.
- **HTTP Polling** היה בזבזני ומסובך להגדיר תזמון נכון.

**מסקנה:** ✅ WebSocket מתאים בדיוק לתרחיש הזה.

---

### ✅✅ Stateless + Redis — עיצוב נכון אך עם בעיות ביצוע

**מה שנכון בעיצוב:**
- כל מצב חדר שמור ב-`localRooms` Map בזיכרון (מהיר מאוד)
- Redis משמש רק כגיבוי לשרידות (Session resumption)
- כתיבה ל-Redis מתבצעת רק בגבולות turn (לא כל פעולה), מה שמצמצם I/O
- TTL של 3600 שניות מונע ממלא cache לנצח

**אבל — ה-"Stateless" הוא מיתוס חלקי:**  
המשחק נשען על `localRooms` Map ועל `botTimeouts` Map שחיים בזיכרון. אם תרים שני instances של השרת (load balancing), כל אחד יראה עולם אחר. זה שרת **Stateful Single-Instance** עם Redis לגיבוי — וזה בסדר לחלוטין למקרה השימוש הזה!

---

## 2. באגים ובעיות קריטיות 🔴

### 🔴 BUG-01: Race Condition בין `handleDisconnect` ל-`handleLeaveRoom`

```
handlers.js — שורות 228–268 + 303–353
```

**הבעיה:** כשמשתמש לוחץ על "כן" ב-Alert של `handleLeaveGame`:
1. `sendAction('leave_room', {})` נשלח לשרת ← `handleLeaveRoom` מבוצע ומאפס `ws.roomId = null`
2. `router.replace('/')` גורם ל-unmount של הקומפוננטה ← הסוקט נסגר ← `ws.on('close')` ← `handleDisconnect` מנסה לרוץ

**בקוד הנוכחי:** `handleDisconnect` מוגן ב-`if (ws.roomId)` — נראה שמוגן, אבל יש חלון זמן קריטי:

```js
// handlers.js line 76-81
ws.on("close", async () => {
    localClients.delete(ws);
    if (ws.roomId) {         // הגנה זו תלויה ב-ws.roomId
        await handleDisconnect(ws);
    }
});
```

בידיעה ש-`handleLeaveRoom` מאפס `ws.roomId = null` בסוף — הסדר הנכון הוא:
- `handleLeaveRoom` → מאפס `ws.roomId = null` → `leave_room` event נשלח
- סוקט נסגר → `handleDisconnect` רואה `ws.roomId === null` → עוצר

זה **עובד** — אבל רק אם הסוקט נסגר **אחרי** שה-leave_room מסיים. אם הסוקט נסגר **לפני** שההאנדלר מסיים לרוץ (רשת מהירה), עלול להיות שה-close handler רץ ורואה עדיין roomId.

**פתרון:** הוסף `ws.leaving = true` flag בתחילת `handleLeaveRoom` ובדוק אותו גם ב-`handleDisconnect`.

---

### 🔴 BUG-02: Memory Leak בבוט שנוצר ב-`replacePlayerWithBot`

```
handlers.js — שורות 271–301
```

```js
const bot = new BotAdapter(playerId, 'hard', 0.25, PLAYER_COUNT, roomId);
bot.avatar = getRandomAvatar();
const savedPlayer = roomState.gameData.players.find(p => p.id === playerId);
if (savedPlayer) bot.hand = savedPlayer.hand;

roomState.botsConfig.push(bot.toJSON());   // ← נשמר ב-JSON
await saveRoomState(roomId, roomState, true);
// bot האובייקט עצמו לא נסגר! הוא נוצר, getBotInstance נוצר,
// אך הוא לא מוחזק ב-BotAdapter.activeBots
```

הבוט נוצר, ה-hand שלו מוגדר, ו-`bot.toJSON()` נשמר — אבל לאחר מכן `executeActionOnRoom` נקרא עם `RESUME_BOT`. בתוך `executeActionOnRoom`, `BotAdapter.fromJSON` יוצר instance **חדש** מהמשחק המשוחזר, ממתין לפעולה. האובייקט `bot` המקורי נשכח ונוצרת instance אורפן זמנית עד ה-GC.

**בעיה יותר קריטית:** `BotAdapter.activeBots` הוא Static Map שחי לנצח. אם יש שגיאה ב-`executeActionOnRoom`, הבוט ה"חדש" עלול לא להימחק ממנה לעולם — ומפת ה-activeBots תגדל ללא גבול.

---

### 🔴 BUG-03: Disconnect בזמן Lock — השרור

```
handlers.js — שורות 231–232
```

```js
const locked = await acquireLock(roomId);
if (!locked) return;   // ← פשוט מוותר! לא מנסה שוב
```

אם שחקן מתנתק בדיוק כשיש נעילה על החדר, כל הלוגיקה של disconnect מדולגת — `clientInfo.connected` לא מתעדכן, ה-bot replacement timeout לא מוגדר. השחקן "נשאר" מחובר לצמיתות מנקודת מבט השרת.

**פתרון:** הוסף retry קצר, או queue את ה-disconnect לביצוע אחרי ה-unlock.

---

### 🔴 BUG-04: handCount של יריבים תמיד = 4 (לא דינמי)

```
useGameSocket.ts — שורות 262–266
```

```ts
// TODO: The server currently does not broadcast opponent hand-sizes.
const activeOpponents = [];
for (let i = 1; i < 4; i++) {
    activeOpponents.push({ id: (payload.playerId + i) % 4, handCount: 4 });
}
```

**הבעיה:** כל משחק מתחיל עם 4 קלפים לשחקן 0 שיש לו 5 קלפים (Deck.js שורה 61). השרת שולח `yourHand` אבל לא שולח את מספר הקלפים של יריבים. המשחק מציג **תמיד** 4 קלפים לכל יריב — גם אחרי העברות.

זה פוגע חמור בגיים-פליי: שחקן לא יכול לדעת כמה קלפים ניצחון-ה-quad כמעט הגיע.

**פתרון:** הוסף `handSizes: { [playerId]: count }` ל-`game_update` ב-`_broadcastGameState`.

---

## 3. בעיות ביטחון ועמידות 🟡

### 🟡 SEC-01: Session Token חלש

```js
const sessionToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
```

`Math.random()` אינו CSPRNG. ב-Node.js זה פסבדו-אקראי — לא מספיק לאסימוני session ביטחוניים. לא קריטי כאן (המשחק הוא לא בנקאי), אבל מישהו יכול לנחש token ולהתחבר כשחקן אחר.

**פתרון:** `crypto.randomBytes(32).toString('hex')`

---

### 🟡 SEC-02: אין אימות שהפעולה הגיעה מהמשתמש הנכון

```js
// handlers.js — handleGameAction
async function handleGameAction(ws, event, payload) {
    if (!ws.roomId) return sendError(ws, "You must create or join a room first.");
    await executeActionOnRoom(ws.roomId, ws.playerId, event, payload);
}
```

`ws.playerId` נלקח מהסוקט עצמו (מוגדר ב-join/create). זה בסדר. אבל בתוך GameState:

```js
// GameState.js — handleRequestCard
if (playerId !== this._receiver().id || ...) {
    return this._errorTo(playerId, "Invalid action for current phase.");
}
```

השרת מאמת phase ותור — זה **נכון**. אבל אין הגבלה על קצב שליחת הודעות:

**בעיה:** שחקן יכול לשלוח אלפי הודעות בשנייה ולגרום ל:
- כל אחת לנסות לרכוש lock → 10 ניסיונות כל אחת × 50ms = עד 500ms חסימת event loop לכל הודעה
- הצפה של `localClients.delete(ws)` loop

**פתרון:** Rate limiting פשוט (N הודעות לשנייה לחיבור).

---

### 🟡 SEC-03: Payload Injection ב-event loop

```js
// socketServer.js — שורה 54
const { event, payload = {} } = data;
```

אם שחקן שולח `event: "__proto__"` או `event: "constructor"`, הוא יגיע ל-`handleGameAction` אבל לא יגרום לנזק בגלל `executeActionOnRoom` שבודק מפורשות. אבל `payload` לא מסונן — שחקן יכול לשלוח payload ענק בגודל MB וזה ייכנס פנימה ללא בדיקה.

**פתרון:** הגבל גודל הודעה (WebSocket server יש `maxPayload` option).

---

## 4. בעיות לוגיקת משחק 🟡

### 🟡 GAME-01: `findQuad` — תנאי hand.length === 4 שביר

```js
// rules.js — שורה 26
function findQuad(hand) {
    if (hand.length !== 4) return null;
    ...
}
```

כאשר שחקן 0 מתחיל עם 5 קלפים (\- ראה `Deck.deal`), ה-quad לא יכול להתגלות עד שהוא מוציא קלף אחד! זה **עיצוב מכוון** (שחקן 0 תמיד sender ראשון), אבל:

**Edge case:** מה אם שחקן 0 מחזיר 4 קלפים מאותו rank מההתחלה (3 + Joker)? לאחר ה-transfer הראשון הוא יכול להגיע ל-4 קלפים, והבדיקה `hand.length !== 4` תחסום את זיהוי ה-quad אם בכלל לא נכנסנו ל-`_resolveTransfer`.

**בעיה נוספת:** `_resolveTransfer` בודק quad **רק לאחר כל transfer**. אם שחקן כבר יש לו quad ב-hand הראשוני (בלתי אפשרי עם 17 קלפים ל-4 שחקנים, אבל בפיתוח עם mocks), המשחק יתחיל ולא יזהה זאת.

**פתרון:** הוסף בדיקת quad גם ב-`start()` ו-שנה ל-`hand.length >= 4`.

---

### 🟡 GAME-02: `_advanceTurn` — מי הוא ה-sender הבא?

```js
// GameState.js — שורות 268–281
_advanceTurn() {
    const ts = this.turnState;
    const oldReceiver = ts.receiverIndex;
    ts.senderIndex = oldReceiver;
    ts.receiverIndex = (oldReceiver + 1) % this.players.length;
```

**הבעיה:** `this.players` הוא Array, ו-`players[receiverIndex]` מוגדר לפי **מיקום במערך**, לא לפי `player.id`. אם player IDs אינם 0,1,2,3 ברצף (למשל אחרי bot replacement שמוחק client ומוסיף bot עם id 2), המדד `receiverIndex` מצביע על מיקום מערך ולא על player.id.

נבדוק ב-`handleOffer`:
```js
if (playerId !== sender.id) { ... }
```
כאן `sender.id` לוקח את ה-id של ה-player באינדקס `senderIndex`. זה תקין כל עוד המערך מסודר לפי id.

**אבל:** ב-`fromJSON`:
```js
state.players = adapterInstances.map(p => {
    const savedPlayer = data.players.find(sp => sp.id === p.id);
    ...
```
כאן ה-`adapterInstances` מגיעים מ-`roomState.gameData.players.map(pData => ({id: pData.id, send: ...}))`. הם נשמרים לפי סדר ה-`data.players`. ה-`senderIndex` מניח שהמערך ממוין לפי id — אם הסדר השתנה (למשל ב-future refactor), זה ישבר.

**פתרון:** הפוך כל התייחסות ב-turnState מ-`index` ל-`id`, ואז `_sender() = this.players.find(p => p.id === ts.senderId)`.

---

### 🟡 GAME-03: Spectators ב-`interaction_update` מקבלים "accepted: true" תמיד

```js
// BotAdapter.js — שורה 228–234
case "interaction_update":
    this.memory.recordOffer(
        this._currentSenderId(),
        this._currentReceiverId(),
        /* accepted */ true    // ← תמיד true!
    );
```

גם כשהמפנה דחה קלף (`reject` decision), הספקטטורים מקבלים `interaction_update` עם accepted=true. זה מקלקל את הזיכרון של הבוטים — הסיכוי לחשוד שמישהו מחזיק Joker מחושב לא נכון.

---

### 🟡 GAME-04: Bot לא מסונכרן אחרי Restart

```js
// gameExecution.js — startGame
const botInstances = [];
const numBots = PLAYER_COUNT - roomState.clientsInfo.length;

for (let b = 0; b < numBots; b++) {
    const botId = roomState.clientsInfo.length + b;  // ← ID מחושב מחדש
```

בתחילת משחק חדש (restart), הבוטים מקבלים ID חדש. אבל `roomState.botsConfig` הישן עדיין קיים מהמשחק הקודם. ב-`handleJoinRoom`:

```js
if (roomState.gameData && !roomState.gameData.over) {
    return sendError(ws, "Game already in progress.");
}
```

בין `over === true` ל-restart, שחקן חדש יכול להצטרף. אחרי restart, ה-IDs יכולים להתבלבל.

**יותר קריטי:** `checkRoomRestart` לא מנקה את `botsConfig`:
```js
async function checkRoomRestart(roomState) { ... await startGame(roomState); }
async function startGame(roomState) {
    ...
    roomState.botsConfig = botInstances.map(b => b.toJSON());  // ← מחליף — אבל מה עם bots שהוכנסו מ-replacePlayerWithBot?
```

אם בזמן המשחק הקודם שחקן התנתק והוחלף בבוט (ב-`botsConfig`), ואז המשחק הסתיים, ה-`clientsInfo` לא מכיל אותו — אבל `botCount` הוגדל. בעת restart:
- `roomState.botCount` = מספר גבוה יותר ממה שציפינו
- `numBots = PLAYER_COUNT - roomState.clientsInfo.length` = ייצור bots רבים מדי

---

## 5. בעיות ביצועים 🟡

### 🟡 PERF-01: BotMemory.eventLog גדל ללא סוף

```js
// BotMemory.js — recordRequest, recordOffer, recordCardReceived
this.eventLog.push({ type: "request", ... });
```

`eventLog` לא מוגבל בגודל. במשחק ארוך עם הרבה turns, הוא גדל ללא גבול. כל פעם ש-`BotAdapter.toJSON()` נקרא (כל action), כל ה-log הזה מתורגם ל-JSON ונשמר.

**השפעה:** משחק עם 100 turns יוצר eventLog של מאות שורות, שמועתק בכל Redis write. בנוסף, `fromJSON` בוחן אותו.

**פתרון:** הגבל eventLog ל-N האחרונים (למשל 50 אירועים):
```js
if (this.eventLog.length > 50) this.eventLog.shift();
```

---

### 🟡 PERF-02: Background Saver לא שורד אם Redis נפל בזמן כתיבה

```js
// roomStore.js — שורות 73–74
const roomsToSave = Array.from(dirtyRooms);
dirtyRooms.clear();  // ← מנקה לפני כתיבה!

for (const roomId of roomsToSave) {
    ...
    try {
        await redisClient.set(...);
    } catch (e) {
        logger.warn(`Background save failed for ${roomId}: ${e.message}`);
        // ← לא מחזיר את roomId ל-dirtyRooms
    }
}
```

אם Redis נפל בזמן ה-background save, האיבוד של `dirtyRooms.clear()` גורם לאבדן עדכונים. הם לא יכתבו ב-cycle הבא.

**פתרון:**
```js
const roomsToSave = Array.from(dirtyRooms);
dirtyRooms.clear();
for (const roomId of roomsToSave) {
    try { await redisClient.set(...); }
    catch (e) { dirtyRooms.add(roomId); /* requeue */ }
}
```

---

### 🟡 PERF-03: localRooms גדל לנצח - גדלו Cache

```js
// roomStore.js — getRoomState
const raw = await redisClient.get(`room_state:${roomId}`);
if (raw) {
    const state = JSON.parse(raw);
    localRooms.set(roomId, state);  // ← נכנס לcache
    return state;
}
```

**הבעיה:** חדרים שנמחקו מ-Redis (כי ה-TTL פג) אינם מוסרים מ-`localRooms`. חדרים "מתים" ב-localRooms יישארו שם עד restart.

**נכון:** `deleteRoomState` מנקה עם `localRooms.delete(roomId)` — אבל רק אם המשחק מסתיים "נורמלית". אם שרת קורס ומאתחל, ה-localRooms ריק ממילא. הבעיה קטנה בפועל.

---

## 6. בעיות Client-Side 🟡

### 🟡 CLIENT-01: `connect` Capture Stale Values

```ts
// useGameSocket.ts — שורה 453
}, []);  // ← useCallback עם deps ריקות!
```

ה-`connect` function מוגדרת עם `useCallback([])` — כלומר נקבעת **פעם אחת** ב-mount עם הערכים הראשוניים של `action`, `botsParam`, `avatarParam`. אם ה-props ישתנו (לא קורה כרגע אבל עשוי לקרות בעתיד), ה-reconnect ישתמש בערכים ישנים.

**נוכחית:** בגלל שהפרמטרים אינם משתנים לאחר ה-mount, זה עובד — אבל הוא מבוסס על הנחה שביר.

---

### 🟡 CLIENT-02: Reconnect Timer לא מנקה WebSocket הישן

```ts
// useGameSocket.ts — שורות 431–437
if (!reconnectTimerRef.current) {
    reconnectTimerRef.current = setInterval(() => {
        if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
            connect(true);
        }
    }, 3000);
}
```

`connect(true)` יוצר WebSocket חדש על `ws.current`. אם WebSocket הישן ב-state `CLOSING` (לא `CLOSED` עדיין), הבדיקה תיכשל — אבל בface render הבא, `ws.current` יצביע על הסוקט החדש בזמן שהישן עדיין קיים.

**פתרון:** הוסף `ws.current?.close()` לפני יצירת חיבור חדש ב-`connect`.

---

### 🟡 CLIENT-03: `game_update` מוחק `requestedRank` מה-turn state

```ts
case 'game_update':
    setCurrentTurn(payload.turn);  // ← מחליף כל תוכן turn!
```

כש-`game_update` מגיע לאחר `card_requested`, הוא מחליף את `currentTurn` — כולל `requestedRank` שנשמר ב-`setCurrentTurn(prev => ({ ...prev, requestedRank: ... }))` קודם.

**בפועל:** השרת כן שולח `requestedRank` ב-`payload.turn` (כשמישהו הוא ה-sender) — אבל לא לכולם. יריבים לא מקבלים `requestedRank` בגלל:
```js
// GameState.js
requestedRank: p.id === ts.senderIndex ? ts.requestedRank : undefined,
```

כך שה-receiver (שצריך לדעת מה ביקש — כדי לבדוק שקר), איבד את המידע.

---

### 🟡 CLIENT-04: Lie Detection — לוגיקה שבורה

```ts
// useGameSocket.ts — שורות 335–338
const got = payload.cardLabel;
const wanted = currentTurnRef.current.requestedRank;
const lied =
    got.toUpperCase() !== wanted &&
    !(got === "Joker" && wanted === "JOKER");
```

**בעיות:**
1. `wanted` מגיע מ-`currentTurnRef` שלא תמיד מסונכרן (useRef vs useState lag)
2. אם `wanted` הוא `undefined` (כי ה-requestedRank לא נשמר נכון), `lied` יהיה `true` תמיד — כל קלף יופיע כ"שקר"
3. `got.toUpperCase() !== wanted` — `wanted` הוא למשל `"K"` אבל `got` הוא `"K_Hearts"`. ההשוואה **לא עובדת**! `"K_HEARTS" !== "K"` → תמיד `lied = true`.

---

## 7. בעיות Edge Cases 🟠

### 🟠 EDGE-01: מה אם lock לא משתחרר לעולם?

```js
// locks.js — acquireLock
for (let i = 0; i < 10; i++) {
    ...
    await new Promise(r => setTimeout(r, 50));
}
return false;  // ← תחזיר false אחרי 500ms
```

אבל ב-`finally`:
```js
finally { await releaseLock(roomId); }
```

כמעט תמיד נקרא — אבל מה אם יש Exception בתוך ה-`finally` עצמו? (קבצים שבורים, stack overflow). Lock נשאר תפוס. **לא קורס** כי ה-timeout של 10×50ms מגן, אבל כל הפעולות על החדר יכשלו.

**פתרון:** Lock עם auto-expiry: שמור timestamp של רכישה, נקה locks ישנים (>5s).

---

### 🟠 EDGE-02: Bot גדל ל-`replacePlayerWithBot` כשהחדר כבר נמחק

```js
// handlers.js — שורות 254–256
const timeout = setTimeout(() => {
    replacePlayerWithBot(roomId, ws.playerId).catch(e => logger.error(e));
}, 30000);
```

אם בין ה-disconnect לבין ה-timeout של 30 שניות:
- כل שאר השחקנים מתנתקים → `deleteRoomState` נקרא
- 30 שניות חולפות → `replacePlayerWithBot` רץ
- `getRoomState` מחזיר `null` → early return ✅

זה מטופל נכון. עם זאת:

```js
if (!roomState) return;  // ← early return, אבל...
```

ה-lock עדיין נרכש ב-`replacePlayerWithBot` לפני הבדיקה. אם החדר נמחק אבל ה-lock עדיין פתוח (מפני שרכשנו אותו כבר), זה בסדר. אבל:

אם הסיבה לחדר-null היא ריצה מקבילית (`deleteRoomState` נקרא מה-handleDisconnect שרץ לאחר מכן על שחקן שני), ה-lock לא הגן על `deleteRoomState` נגד ה-timeout — כי `deleteRoomState` נקרא מתוך locked context, אבל ה-timeout מנסה לרכוש lock נפרד.

---

### 🟠 EDGE-03: Restart במשחק עם bots שהוכנסו מ-replacement

**תרחיש:**
1. משחק מתחיל: 2 humans + 2 bots
2. Human 1 (id=0) מתנתק → 30s pass → bot מחליף אותו (id=0 עכשיו bot, `botCount=3`)
3. משחק נגמר
4. Human 0 חוזר, מנסה `resume_room` → `sessionToken` עדיין בתוקף
5. `handleResumeRoom` מוצא `clientInfo` עם `sessionToken` ✅
6. אבל `clientInfo` marker עוד ב-`roomState.clientsInfo` למרות שהוחלף ב-bot?

בואו נבדוק: `replacePlayerWithBot` (שורה 282):
```js
roomState.clientsInfo = roomState.clientsInfo.filter(c => c.playerId !== playerId);
roomState.botCount++;
```

כן! ה-client מוסר מ-`clientsInfo`. לכן `handleResumeRoom`:
```js
const clientInfo = roomState.clientsInfo.find(c => c.sessionToken === sessionToken);
if (!clientInfo) return sendError(ws, "Invalid session token.");
```

השחקן יקבל שגיאה "Invalid session token" — **לא יכול לחזור**. זה קצת בעייתי UX-list — לא מוסבר מדוע. המשתמש לא יודע שהוחלף בבוט.

---

### 🟠 EDGE-04: שני clients עם אותו sessionToken (race condition)

**תרחיש:**
1. שחקן מתנתק → session token שמור
2. תוך 30 שניות, הוא מנסה להתחבר שוב **מהרגע שהאפליקציה נפתחת** + לא ממתין לסגירת הסוקט הישן
3. שני events של `resume_room` עם אותו token ← שניהם ירכשו lock ← הראשון יעדכן `clientInfo.id = ws.id` ← השני ישכתב את זה

**תוצאה:** רק הסוקט האחרון שהגיע ישמע events. הראשון יאבד את המשחק בשקט.

**פתרון:** בסיום `handleResumeRoom` מוצלח, בטל את כל ה-WS instances הישנים עם אותו playerId.

---

## 8. בעיות Session Resumption 🟠

### 🟠 SESSION-01: אין Heartbeat / Ping-Pong

ה-WebSocket server (`ws` library) לא מגדיר `pingInterval`. בחיבורים סלולריים, middleboxes (NAT, firewalls) יסגרו חיבורים idle תוך 60-90 שניות.

**תרחיש:** שחקן בזמן שהיריב חושב על המהלך (bot חושב 1.5s, אבל אין פעילות לדקה). הchיבור נחתך בשקט על ידי ה-NAT. הסוקט לא מגלה זאת (`readyState` עדיין OPEN). המשחק פשוט תקוע.

**פתרון:**
```js
// socketServer.js
wss = new WebSocket.Server({ 
    port, host: '0.0.0.0',
    clientTracking: true
});

// Ping every 30s
const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.alive === false) { ws.terminate(); return; }
        ws.alive = false;
        ws.ping();
    });
}, 30000);

wss.on('connection', (ws) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
});
```

---

## 9. בעיות עיצוביות שצריך לדעת

### 📐 DESIGN-01: `players` ב-GameState — Index vs ID

כל הלוגיקה מניחה שה-player באינדקס 0 הוא player ID 0, וכו'. זה עובד היום כי אנחנו תמיד מייצרים `[0, 1, 2, 3]`. אבל זה coupling שביר.

**המלצה:** המר turnState להשתמש ב-IDs במקום indices.

---

### 📐 DESIGN-02: AVATAR_KEYS כפול בשני קבצים

```js
// handlers.js — שורות 16–24
const AVATAR_KEYS = ['blackandwhite_joker', ...];

// gameExecution.js — שורות 14–22
const AVATAR_KEYS = ['blackandwhite_joker', ...];
```

זה DRY violation. זה צריך להיות ב-`constants.js`.

---

### 📐 DESIGN-03: localClients Set — O(n) לכל broadcast

```js
// broadcast.js
for (const ws of localClients) {
    if (ws.readyState === WebSocket.OPEN && ws.roomId === roomId) {
```

לכל broadcast, עוברים על **כל** הלקוחות המחוברים לשרת כולו. בהינתן שזה שרת חד-חדרי, זה O(4) בפועל — לא בעיה. אבל אם בעתיד יהיו עשרות חדרים, זה O(N×4) לכל broadcast.

**שיפור קל:** Map מ-`roomId` → `Set<ws>`.

---

## 10. מה עובד טוב — הצלחות הארכיטקטורה ✅

| רכיב | הישגים |
|------|--------|
| **GameState.js** | Pure state machine, אפס I/O, מושלם לטסטים |
| **BotProxy (Proxy pattern)** | בוטים מתממשקים בדיוק כמו אדם, elegant design |
| **modular handlers** | handler, gameExecution, broadcast — הפרדה נקייה |
| **Lock mechanism** | מגן על race conditions בסביבת Node.js single-thread |
| **Background Saver** | Redis כ-best-effort backup, לא חוסם game loop |
| **Session resumption** | timeout של 30s לפני bot replacement — user-friendly |
| **TTL על Redis** | אוטו-ניקוי של חדרים נטושים — לא ימלא ה-cache |
| **BotAdapter.abortAll()** | ניקוי גרייסful בעת shutdown |
| **AdvancedBot pattern** | memory-based heuristics מרשימות |

---

## 11. סדר עדיפויות לתיקון

### 🔴 קריטי (צריך לתקן מיד)
1. **BUG-04** — handSizes של יריבים תמיד 4 (שובר game-play)
2. **CLIENT-04** — Lie detection שבורה לחלוטין
3. **SESSION-01** — אין Heartbeat/Ping → NAT dropouts בלתי נראים
4. **PERF-02** — dirtyRooms.clear() לפני הכתיבה → אבדן data ב-Redis failure

### 🟡 חשוב (תקן בקרוב)
5. **BUG-01** — Race condition בין leave ו-disconnect
6. **BUG-03** — Disconnect מדולג כשיש lock
7. **GAME-03** — spectators מקבלים accepted=true תמיד
8. **CLIENT-02** — Reconnect לא סוגר WebSocket ישן
9. **SEC-01** — החלף Math.random ב-crypto.randomBytes
10. **PERF-01** — הגבל eventLog לN האחרונים

### 🟠 שיפורים (בפנאי)
11. **DESIGN-02** — מזג AVATAR_KEYS ל-constants.js
12. **DESIGN-03** — Map roomId→clients לביצועים טובים יותר
13. **DESIGN-01** — turnState: index→id
14. **SEC-02** — Rate limiting על הודעות WS
15. **GAME-04** — נקה botsConfig ב-restart

---

## 12. סיכום

הפרויקט מציג ארכיטקטורה **מבוגרת ומחושבת** לרמתו. ה-Game loop, ה-Bot AI, וה-session resumption הם highlight ברורים. הבחירות הארכיטקטוניות הגדולות — WebSocket, Stateful single-instance עם Redis backup, locking — **נכונות לחלוטין** למשחק הזה.

הפערים הם ברמת ה-implementation details: bugs ב-lie detection client-side, חוסר heartbeat שישבור כל טלפון נייד, והסנכרון הלא מושלם בין leave/disconnect. אלה ניתנים לתיקון ממוקד.

> **הפרויקט ראוי ואמין — מה שנדרש הוא polish של edge cases, לא רה-ארכיטקטורה.**
