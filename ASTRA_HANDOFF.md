# Independent Astra audit handoff — 2026-10-09

## Branch
The main branch is the user's previous local-only dummy preview, not secure.
Only audit development/security-engine, Draft PR #1. Do not merge or distribute.
Latest CI has application tests, Noise E2EE dummy tests, relay tests,
native Mac helper compilation and intentional no-sensitive-release gate.
Historic GitHub crosses persist even after fixes.

## User's latest roles
One app with TWO protected end-user account roles:
- Host: called partner in older code/enrolment. No mandatory camera, mic or USB.
  Only Host may Delete Chat. Capture blocking not mandatory on this role.
- Protected: called portable in older code/enrolment. Requires local camera,
  microphone, Mac encrypted USB volume and screenshot policy checks.
- Builder/developer has no access to their private conversations.

## Changes to TESTABLE COMPONENTS only (not integrated GUI)
- Two independent passwords protect separate Ed25519 per-device identity
  profiles using scrypt + AES-GCM. Account role is authenticated as AAD and
  encrypted in profile version 2. Password alone cannot authorize unknown
  devices; the server authenticates each enrolled Noise public key.
- One active authorized device per account role: 3-second server lease,
  recent device superseded, old relay connections closed best-effort,
  old TURN/relay admissions denied and client watchdog expires stale renewal.
  Offline old endpoint may still briefly run until its local fail-closed
  deadline. An ordinary USB/private identity is cloneable.
- Account relay protocol is Noise-authenticated and tests real client/server
  issuance, renew/revoke. The final app has NOT been wired to it.
- Host/protected role-specific guards in core/role-requirements.cjs.
- No-private-content unless authenticated peer freshness; challenge about
  every 500ms, 3s cover and 5s expiry. Local definitive event must stop now.
- Seen ack authenticated from receiving device; 2s expiration after Seen;
  20s unseen fallback. Display receipt never proves a human actually read.

## Already implemented security building blocks
- libp2p maintained Noise E2EE transport; tested with two dummy peers and
  relay, but not a WhatsApp/Signal Double Ratchet app or completed client.
- WebRTC DTLS-SRTP TURN-only source and controlled Noise-signalled SDP;
  real two-device live video/audio is STILL NOT integrated or tested.
- Mac Disk Arbitration USB watcher COMPILES, but is NOT yet bundled,
  launched, hardware-tested or fail-closed under actual USB removal.
- Cloudflare temporary TURN server and restricted relay mock-tested;
  no user-approved Render/Cloudflare service has been deployed.

## Absolute unresolved blocking requirement
User requires zero possible screenshots/recordings on ANY unrooted laptop and
notification to peer on every capture attempt. This is NOT achieved, and an
ordinary desktop app cannot guarantee it. Windows WDA_EXCLUDEFROMCAPTURE is
best effort for supported capture. Newer macOS ScreenCaptureKit can bypass
Electron NSWindowSharingNone. macOS managed allowScreenShot=false is a
potential consented, DEVICE-WIDE stronger policy; verify whether available
on exact hardware and restrictions before treating it as adequate. Apple's
Automatic Assessment Configuration is entitlement-restricted for exam apps;
do not falsify eligibility. Tails/Linux boot is not a universal recording
blocker. OS-level attempted screenshot events are not reliably exposed.
Compromised admin/root may forge local trust checks. An off-device camera
cannot be prevented by OS settings.

## Ask Astra to audit:
- Bugs / incomplete account takeover (including cloned profile), authority
  link between relay and client session, wrong peer acceptance, and replay.
- Protocol framing, WebRTC media identity, ICE candidate ordering, TURN
  issuance, native USB guard and 500ms watchdog races.
- Realistic Mac device management restrictions, independent anti-capture
  assessment, Tails/Wayland managed-kiosk possibilities and hard limits.
- Ensure signed package, root/tamper peer notifications, 2s Seen expiry,
  host-only Delete, developer exclusion, new device revocation, and no logs.
- Distinguish code TESTED as isolated modules from actual GUI and Mac USB.
- Output concise precise bug report + ordered next fixes + paste-back message.
Do not merge PR #1 or claim app complete until all release gates are met.
