# Private Session Desktop — Security and release status (2026-10-09)

**NOT READY FOR SENSITIVE USE. The requirement to prevent every screenshot /
recording on arbitrary Windows/Mac laptops has NOT been achieved.**

PR #1 branch: development/security-engine. Stable main remains unchanged.
The correct independent release gate remains deliberately blocked.

## Improved and cloud-tested

- Password-first Electron onboarding using per-device Ed25519 profiles
  encrypted with AES-256-GCM and scrypt. No pre-generated live passwords.
- No role dropdown. Local unlocked identity determines account role.
- Host media optional; Protected media mandatory in the renderer on Start.
  Protected user has no self-preview; a visible microphone/camera active
  indicator and OS-level permission remain mandatory for consent.
- Electron main now has authenticated session IPC for approved pinned relay,
  approved peer identity, one-time session code, live encrypted text, Seen,
  and verified bilateral Clear & End.
- Pinned Noise network client requires an active server-issued single-device
  account lease, renewal, approved peer identity, relay address and heartbeat.
- Versioned encrypted frames, authenticated message ordering, no offline
  message queue, 120-second unseen expiry, 120 seconds after authenticated
  Seen, both participants may Clear & End.
- Remote-only video element plus WebRTC DTLS-SRTP TURN-only engine and
  authenticated Noise SDP/ICE wiring; actual camera-to-Mac calls remain
  unverified on real devices.
- Restricted relay integration cloud test succeeded for server-issued
  account leases, real endpoint-to-endpoint encrypted dummy text, heartbeat,
  authenticated Seen and bilateral Clear.
- Developer/builder identity explicitly cannot pair with either private
  chat participant on the restricted relay.

## Not verified / blocked

- No user-authorized relay or TURN credentials deployed. Experimental UI
  requires manually verified peer public keys, a pinned relay identity,
  copied relay circuit addresses and one-time session codes.
- Windows build is NOT considered releasable; newest packaging failed
  (GitHub job log was unavailable; a one-job rerun was requested).
- Real paired Windows+Mac use, call audio/video, camera unplug, sleep,
  offline recovery, screenshot attempts and replay under network delays
  require hardware and independent adversarial tests.
- Mac Disk Arbitration volume watcher compiles but is not bundled,
  supervised, bound to a verified APFS-encrypted external device or
  physically verified. File-signature polling is a weaker fallback,
  not guaranteed instantaneous real USB detection.
- Windows Electron setContentProtection calls WDA_EXCLUDEFROMCAPTURE,
  which covers supported capture APIs only. Microsoft's own
  SetWindowDisplayAffinity documentation explicitly rejects any
  strict anti-recording guarantee.
- macOS Electron NSWindowSharingNone does NOT block modern
  ScreenCaptureKit capture. Apple allowScreenShot=false managed policy
  may be tested with fully informed Mac owner consent; no real test,
  managed enrollment, nor evidence of universal blocking has occurred.
- No normal application can guarantee detection of every screenshot
  attempt or block cameras pointed at the display, arbitrary
  privileged/kernel capture or a hostile compromised operating system.
- Client root/admin tamper hints are not reliable proof of no compromise;
  an offline peer cannot receive instant notice.
- Cloned cryptographic keys, prolonged TURN credentials, and
  unauthorized screen recording on Host remain material risks.
- No independent formal cryptographic review, Windows/Mac app code
  signing, release verification or tested downgrade/rollback.

## Privacy / quality note

Never install unsigned experimental packages or run confidential chats
assuming security until independent testing verifies exactly the actual
hardware and OS. Even extensive tests cannot establish **zero bugs**.

The development source now has real E2EE components wired to the interface;
passing cloud tests must not be misrepresented as proven confidentiality
against endpoint compromise or all capture utilities.


## October 9 continued audit notes
- Fixed a critical Electron lifecycle bug: the generic stop() path previously
  cleared the profile but did not close the active Noise transport. It now
  detaches/closes that client before clearing secrets. Late callbacks are
  invalidated by an auth epoch.
- Remote authenticated Clear, conceal, and closed status now cause immediate
  main-process window concealment; renderer Clear/conceal stops camera/mic.
- Added a 256-message bound for pending incoming and outgoing receipt state,
  with regression tests. Two targeted, source-loaded checks passed outside CI:
  Seen+120s and capacity, and authenticated Clear with replay rejection.
- After GitHub Actions began failing, all recent jobs report runner_id=0 and
  steps=[], without uploading packages. This resembles a billing/spending or
  runner provisioning restriction; exact cause cannot be established using
  the GitHub integration's available job logs. Check owner billing/usage.
- Reduced Actions load: development branch no longer triggers a duplicate
  push run in addition to PR; Windows and Mac packaging now require a
  user-initiated workflow_dispatch opt-in. No app package can be claimed
  successful until the opt-in job runs and produces a GitHub Artifact.
- The new post-change code is **not fully CI-tested** because runners are
  not starting. Previous passing suites do not certify later commits.
