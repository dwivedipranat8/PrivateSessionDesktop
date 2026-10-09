# Private Session Desktop — security development status, 2026-10-09

**NOT A FINAL OR APPROVED PRIVATE MESSENGER.** Do not use sensitive content.
The stable main branch remains unchanged. Work is on development/security-engine
(PR #1). The absolute zero screenshot/recording requirement remains UNSOLVED
and the final-sensitive-release CI gate intentionally refuses release.

## Newly implemented/tested
- Distinct password-encrypted local Ed25519 device identity vaults, using scrypt
  and AES-256-GCM. The user's passwords are created locally, not hardcoded or
  shared through GitHub or ChatGPT. No real passwords exist yet.
- Electron PREVIEW now has first-use setup and password-first unlock, deriving
  the role automatically from the authenticated encrypted profile instead of
  exposing a role dropdown every time.
- Portable vault file resides alongside Windows executable, or at a mounted
  /Volumes/... root on macOS if launched from that volume. This is NOT proof
  of removable hardware, correct APFS encryption, or absence of OS caches.
- Cloud integration test unlocks two encrypted accounts, converts keys to
  libp2p Noise identities and exchanges authenticated dummy text + Seen + Clear
  over a third-party relay. No server can read these test frames.
- 120s after authenticated first Seen; 120s if unseen. The dummy user-facing
  "Simulate recipient Seen" button is NOT a real remote Seen receipt.
- Both enrolled participants may issue authenticated Clear & End. Remote
  deletion is unconfirmed until a separate authenticated peer ACK arrives.
- Server-side one-active-device-per-role leases, heartbeat and revocation are
  unit/cloud tested but NOT yet wired to the Electron application.
- Protected role requires camera+mic for local preview Start. Self-camera
  preview has been removed, but a clear active-media indicator stays visible.
- In the dummy app, encrypted identity file removal/change, network offline,
  lock or suspend are designed to conceal the window and terminate process.
  USB change is checked by a 500ms poll, not guaranteed hardware removal.

## Incomplete or blocked
- Desktop GUI DOES NOT yet send or receive actual encrypted peer messages,
  authenticate peer identity, or make live encrypted remote video/audio calls.
  WebRTC DTLS-SRTP engine and Noise router exist separately.
- Actual Mac Disk Arbitration USB helper source compiles, but is not bundled,
  supervised or tested on real encrypted APFS removable hardware.
- No user-authorized Render/Cloudflare relay and TURN services deployed.
- Windows screenshot exclusion uses Electron setContentProtection which covers
  supported OS capture APIs, NOT every capture method. A screenshot file may
  exist even when the window content is excluded. Microsoft says it is not
  a strict security or DRM guarantee.
- macOS Electron protection is bypassed by modern ScreenCaptureKit.
  An opt-in device-wide allowScreenShot=false sample profile exists but was
  NOT installed and NOT tested on the user's friend's MacBook.
- Zero risk of recording on arbitrary laptops cannot be guaranteed.
  Screenshot attempt detection cannot be universally guaranteed.
- Root/admin/kernel compromise cannot be reliably ruled out by software-only
  local OS policy checks; peer alerts require a real authenticated connection.
- Proper encrypted USB-only runtime data layout, native hardware checks,
  cloned-identity defense, app signing/notarization, independent security
  review and adversarial physical testing are release blockers.
- Do not merge to main or call a green dummy build a secure messenger.
