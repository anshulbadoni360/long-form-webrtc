# Monet Conferencing - API & Socket Events Reference

This document serves as a complete reference for all REST API endpoints, WebSocket events, and core processing services parsed directly from the legacy implementation codebase. Use this catalog to guide your TypeScript refactoring.

---
Total completed: 9/43
Total deprecated: 34/43
total events completed: 37/43
total deprecated events 2/43

## 1. REST API Endpoints

The backend routes are registered in Express within `server.js` under the main router.

### Authentication & User Management

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/register-user` | Registers a new user. (deprecated) |
| **POST** | `/register-invited-user` | Registers an invited participant. (deprecated) |
| **POST** | `/login` | Authenticates users and returns JWT tokens. (deprecated) |
| **PUT** | `/updateUser` | Updates general user profile information. (deprecated) |
| **PUT** | `/forget-password` | Requests password reset email link. (deprecated) |
| **PUT** | `/reset-password/:token` | Resets password with valid verification token. (deprecated) |
| **PUT** | `/updateRole` | Modifies role-based access permissions. (completed) |
| **POST** | `/auth/google` | Performs Google OAuth login. (deprecated) |
| **POST** | `/auth/microsoft` | Performs Microsoft OAuth login. (deprecated) |

### Room & Call Management

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/createCall` | Hooks up Janus and spawns a live `MonetRoom` configuration. (completed) |
| **GET** | `/forceCreateRoom` | Manually triggers Janus room instantiation. (completed) |
| **DELETE** | `/room/:id` | Destroys/removes a specific room. (completed) |
| **POST** | `/inviteRoom` | Persists room observers and sends email invites. (completed) |
| **GET** | `/getInviteRoom` | Fetches details/permissions for invited rooms. (completed) |
| **POST** | `/getAllInviteRooms` | Lists all active invitation rooms. (completed) |
| **GET** | `/verifyObserver` | Verifies invite link validity for silent observers. (completed) |
| **GET** | `/getRoomIp` | Retrieves active server/host instance IP details for a room. | (deprecated)
| **PUT** | `/storeRoomIp` | Maps backend instances and IP groups to rooms. | (deprecated)
| **POST** | `/muteRoom` | Mutes or unmutes all audio streams in a room (except host). | (deprecated)
| **GET** | `/mute` | Utility toggle for user stream mute state. | (deprecated)

### Participant Telemetry & State

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/roomParticipants` | Returns a list of active participants connected to Janus. | (deprecated)
| **GET** | `/roomAudioParticipants` | Returns list of audio-only connections. | (deprecated)
| **GET** | `/user/:id` | Returns the current state dictionary for an active user. | (deprecated)
| **GET** | `/user_list` | Lists students/users active in an exam session. | (deprecated)
| **GET** | `/my_pub_id` | Gets the Janus webcam publisher stream ID. | (deprecated)

### Assignments & Classrooms

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/createAssignment` | Creates a new classroom assignment. | (deprecated)

### File Management

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/downFile/:file` | Downloads shared files from the session. | (deprecated)
| **POST** | `/upFile` | Uploads files to the session storage. | (deprecated)

### Analytics & Reports

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/server_state` | Returns a diagnostic snapshot of all active rooms, users, and closed sessions. | (deprecated)
| **GET** | `/healthcheck` | Returns the service status and health/metrics stats. (completed) |
| **GET** | `/report` | Generates a specific user profile report. | (deprecated)
| **GET** | `/pie_data` | Generates emotional sentiment analytics (pie charts). | (deprecated)
| **GET** | `/overall_session_engagement` | Fetches session average metrics. | (deprecated)
| **GET** | `/getReportData` | Returns raw statistics for report compilation. | (deprecated)
| **POST** | `/generateReport` | Generates a new meeting session report. | (deprecated)
| **POST** | `/addFinalReport` | Commits finalized report records to the database. | (deprecated)

### Recording & Post-Processing

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/mjr-webm` | Triggers MJR recording translation to WebM format. | (deprecated)
| **POST** | `/getRecordings` | Gets absolute path list of admin recordings. | (deprecated)
| **GET** | `/MonetConference` | Serves the client-side `MonetConference.js` SDK code. | (deprecated)

### Notifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/sendEmail` | Sends general notification emails. | (deprecated)
| **POST** | `/sendEmails` | Sends batch notification emails. | (deprecated)
| **POST** | `/sendAdminMosaic` | Compiles and emails admin mosaics/proctored lists. | (deprecated)
| **POST** | `/sendAdminEmail` | Sends email targeted at admin users. | (deprecated)

---

## 2. WebSocket Events (`Socket.io`)

The application implements bi-directional real-time communication via the `MonetIO` class in `monet_modules/monet-io.js`.

### 2.1 Inbound Events (Client → Server)

These events are registered as listeners on incoming client connections.

#### Session Lifecycle & Admin Events

| Event Name | Purpose |
| :--- | :--- |
| `connection` | Handshake parameters: `{ ID, Name, roomid }`. Registers connection. (completed) |
| `disconnect` | Cleaning sequence removing inactive sockets and releasing Janus locks. (completed) |
| `create-user` | `{ user }` - Creates active session object and joins attendee mapping. (completed) |
| `re-map` | `{ ID }` - Re-maps active socket instance to existing attendee profile. (completed) |
| `add-manager` | `{ roomid, userId, name }` - Binds administrator observer panels to live rooms. (completed) |
| `manager-metric` | `{ roomid }` - Joins host telemetry reporting channels. | (deprecated)
| `join-request` | `{ data }` - Requests entry to a knock-locked room lobby. (completed) |
| `join-response` | `{ data }` - Approves or denies lobby entrance. (completed) |
| `admin-action` | `{ data }` - Performs administrative interventions (e.g., mute, kick). (completed) |
| `move-to-room` | `{ data }` - Reroutes participants to sub-channels. (completed) |
| `destroy-group` | `{ data }` - Closes down breakout panels. (completed) |
| `endRoom` | `{ data }` - Performs room tear-down routines. (completed) |
| `start-recording` | `{ data }` - Dispatches server-side video recording hooks. (completed) |
| `room-created` | `{ roomid, data }` - Signals backend that call space has successfully launched. (completed) |
| `enter-call` | `{ roomid, data }` - Signals join stage for streams. (completed) |
| `question-response` | `{ roomid, data }` - Evaluates instant feedback surveys. (completed) |
| `create-mosaic` | `{ roomid, uuid }` - Spawns layout canvas generation. | (deprecated)
 
#### Business & Collaboration Events

| Event Name | Purpose |
| :--- | :--- |
| `raise-hand` | `{ data }` - Alerts hosts that attendee raised their hand. (completed) |
| `speaking` | `{ data }` - Notifies room when participant starts/stops speaking. (completed) |
| `room-chat` | `{ data }` - Delivers chat messages to general text streams. (completed) |
| `toggle-audio` | `{ data }` - Handles microphone state changes. (completed) |
| `toggle-name` | `{ data }` - Renames participant dynamically. (completed) |
| `private-message` | `{ uuid, msg }` - Relays direct messages to targeted peers. (completed) |
| `dialerData` | `{ roomid, data }` - Sends user interaction tracking dials. (completed) |
| `publish-assignment` | `{ id, roomId }` - Delivers assignments to classrooms. (completed) |
| `throw-chalk` | `{ data }` - Instructs user to pay attention. (completed) |
| `reactionData` | `{ roomid, data }` - Emits user sentiment emojis. (completed) |
| `submit-answer` | `{ uuid, id, assignment }` - Grades student responses. |
| `assignment` | `{ data }` - Sends active assignment configurations. (completed) |
| `broadcast-message` | `{ data }` - Relays broadcast chat lines. | (deprecated)
| `avg-engagement-req` | `{ data }` - Requests average engagement score calculations. |
| `end-discussion` | `{ data }` - Triggers breakout room finalization. (completed) |
| `toggle-video` | `{ data }` - Handles webcam state changes. (completed) |
| `downFile-group` | `{ files }` - Broadcasts downloaded/uploaded group file lists. | (deprecated)
| `downFile-user` | `{ files, receiver_uuid }` - Delivers private file shares directly. | (deprecated)

#### WebRTC & Media Events (Janus)

| Event Name | Purpose |
| :--- | :--- |
| `publish` | `{ data }` - Receives client WebRTC SDP publishers/offers. (completed) |
| `re-negotiate` | `{ data }` - Refreshes SDP descriptions for stream updates. (completed) |
| `trickle` | `{ data }` - Performs trickle ICE candidate distribution. (completed) |
| `video-started` | `{ data }` - Signals stream rendering has started. (completed) |
| `screen-share-stopped` | `{ data }` - Notifies that client stopped sharing screen. (completed) |
| `stopScreen` | `{ data }` - Forces local shares to cease. (completed) |
| `ice-request` | Request STUN/TURN server details. (completed) |

---

### 2.2 Outbound Events (Server → Client)

These events are emitted (`socket.emit` or `io.to().emit`) from the server.

| Event Name | Payload / Description |
| :--- | :--- |
| `connected` | `{ iceServers: [...] }` - Returns ICE server settings. (completed) |
| `error` | `{ msg, ...details }` - Standard error reporting. (completed) |
| `success` | `{ msg }` - Task confirmation messaging. (completed) |
| `face-data` | Relays live student focus metrics (e.g. face detection details) to observers. (completed) |
| `dialerData` | Relays dial tracking feedback. (completed) |
| `reactionData` | Relays live emojis and reactions. (completed) |
| `enter-call` | Broadcasts entry status markers. (completed) |
| `room-created` | Alerts administrators that a call is now available. (completed) |
| `question-response` | Relays user questionnaire selections. (completed) |
| `leave` | `{ userObj }` - Broadcasts that a user has departed. |
| `meeting-initiated` | Fired when a call turns active. (completed) |
| `assignment` | Delivers real-time assignments to students. (completed) |
| `assignment-broadcast` | Broadcasts new assignment payloads. (completed) |
| `room-list` | Emits active room state lists. (completed) |
| `observer-list` | Emits active silent observer/moderator lists. (completed) |
| `private-send-message` | `{ name, msg }` - Relays private chats. (completed) |
| `avg-engagement-res` | Sends compiled average metric sheets. |
| `send-message` | Broadcasts room chat line. |
| `throw-chalk` | `{ msg, sender }` - Visual nudge prompts. (completed) |
| `room-audio` | `{ mute, from, roomid, event, type }` - Syncs client mute indicators. (completed) |

---

## 3. Core Processing Services & Utilities

These are the internal processors, engines, and background modules responsible for media streaming, proctoring metrics, and reports.

### 3.1 Media & GStreamer Processing (completed)

*   **`monet-gstreamer.js` (`MonetGstreamer`)**: Spawns local GStreamer processing pipelines. It captures incoming Janus RTP streams (forwarded video frames) for each user and writes jpeg snapshots to disk for image analysis.
*   **`monet-janus.js` (`MonetJanus`)**: WebSockets communication client managing API commands to the Janus WebRTC Gateway (spawning sessions, creating handles, publishing streams, muting audio bridges).

### 3.2 Proctoring & Face Detection Analytics (completed)

*   **`monet-FD.js` (`MonetFD`)**: Runs the face-detection loop. It retrieves captured snapshots, calls local face-analytics models to evaluate presence, head coordinates, eye tracking, and attention levels, and saves stats to Redis/MongoDB.
*   **`FaceMetrics.js` (`FaceMetrics`)**: Maps facial structural points and parses analytics vectors.

### 3.3 Sentiment & Reporting Engines (deprecated)

*   **`dashReport.js`**: Orchestrates overall sentiment metrics (happy, neutral, sad, etc.) from reaction clicks, formats data for analytics pie charts, and generates final dashboard engagement lists.
*   **`report.js` & `ureport.js`**: Aggregates meeting logs to compute average user scores, speaker durations, hand-raise counts, and session tracking logs.
*   **`genReport.js`**: Generates a JSON analytics bundle compiled directly from MongoDB session activities.
*   **`genPdf.js`**: Compiles JSON metrics and renders them into structured PDF reports.
*   **`postProcessing.js`**: Handles background transcoding, MJR video translation, overlaying screens, and stitching proctored classroom mosaics.
  