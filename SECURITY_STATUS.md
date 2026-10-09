# Development security status — 2026-10-09

**PRIVATE/PROTOTYPE — DUMMY DATA ONLY. No release for confidential messages.**

Main branch: last earlier tested local preview. Development PR #1: latest updates below.
A green unit test is NOT evidence of a production secure app.

| Requirement | Reality |
| --- | --- |
| Two user-created protected account passwords | Per-device AES-GCM/scrypt Ed25519 profile module tested; actual app setup/login UI NOT WIRED and NO user profiles/passwords generated |
| One active authorized device per account | Leased authorizations, host/protected roles, renewal watchdog and pinned Noise server protocol cloud-tested; application not wired |
| Encrypted peer-to-peer messaging | libp2p Noise encrypted dummy peer stream cloud-tested; user app GUI not wired |
| Encrypted live camera and mic | TURN-only WebRTC DTLS-SRTP engine and signalling rules unit-tested; real remote call not connected |
| Camera/mic Host optional; Protected mandatory | Role policy and local preview now reflect this; actual Mac runtime integration pending |
| First authenticated Seen -> erase after 120 seconds | Unit tests; local dummy preview simulation; real peer Seen not wired |
| Unseen -> erase after 120 seconds | Unit tests and dummy preview timer; no long-term store intended |
| Either participant may Clear & End | Authenticated protocol and local fail-closed/peer ACK code unit-tested; real remote delivery not wired |
| 0.5-second heartbeat, 3/5-second protection/expiry | Policy code tested; not fully wired into user app |
| Mac USB removal | Disk Arbitration helper compiles; still NOT bundled, supervised or hardware-tested |
| Windows capture exclusion | Electron calls setContentProtection before load, effective only for supported capture APIs, not an anti-recording guarantee |
| Mac capture blocking | UNSOLVED: Electron can be bypassed by ScreenCaptureKit; removable device-wide test profile prepared but not installed or hardware-verified |
| Root/admin compromise | Local trust hints; no authoritative proof of no compromise on arbitrary devices |
| Passwords | NONE exist for the user. They must be created on the endpoints after safe login/profile UI integration. NEVER send real passwords in chat. |

## Explicit safety gates
Do not use dummy snapshot to talk about anything sensitive or grant access to a private peer.
Never claim remote content was wiped without authenticated peer ACK. OS memory,
screen recordings by other tools, administrator compromise and offline peer
copies remain outside what current code can guarantee. No reliable universal
screenshot-attempt notification is available on desktop operating systems.

## What can be opened now
A Windows local-only preview can be downloaded from a green PR GitHub Actions
run, artifact named `Windows-Updated-Dummy-Preview-NOT-SECURE`.
It is unsigned, has no private network communication and uses simulated Seen.
Downloaded unsigned programs may trigger Windows security warnings; only use
on a device you trust after reviewing the source. Do NOT turn off antivirus,
Windows security controls or Mac Gatekeeper/SIP to run it.

## Remaining before an actual secure prototype
1. Wire local passphrase enrollment, protected USB profile and Noise pinned
   peer authentication into Electron main in a limited authenticated IPC surface.
2. Deploy the restricted relay and TURN service using user-owned provider
   credentials; do not store credentials in GitHub.
3. Connect single-device lease, secure frame router, receipt and Clear & End
   coordinator to real Noise channels, with no session restoration.
4. Connect real WebRTC DTLS-SRTP media via those authenticated offers/answers.
5. Bundle and supervise native Mac USB helper and test physically on that Mac.
6. With owner consent, test macOS device-wide screenshot restriction against
   built-in and ScreenCaptureKit tools, including recorders already running.
7. Hardware regression and independent adversarial review. Current
   zero-recording requirement is a HARD RELEASE BLOCKER.
