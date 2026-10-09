# Private Session Desktop — RELEASE BLOCKED

This repository has two distinct states:
- **main**: user's last tested local-only dummy preview; NOT a secure messenger.
- **development/security-engine**: unmerged engineering branch; NOT READY for real conversations.

## Cloud-tested components (dummy data only)

- Local and relayed pinned Noise peer-to-peer encrypted messages.
- Restricted relay admission and Cloudflare temporary TURN credential issuance
  using mocked provider responses; **not deployed** or proved against provider.
- AES-256-GCM/scrypt-encrypted Ed25519 per-device profiles; wrong password,
  altered ciphertext and device fingerprint mismatch tests.
- Session-bound protected text / Seen / host-only Delete / End control policies.
- 2-second-after-authenticated-recipient-ack timer, with 30-second unseen cap;
  actual human reading is not technically provable.
- 1-second challenge / ~3s protect / ~5s expire policy rules and anti-replay.
- Independent fail-closed coordinator tests; app runtime integration pending.
- Evidence-based security-policy refusal; neutral local/peer error, encrypted
  best-effort alert on suspected policy failure. Sender cannot claim peer ACK
  until authenticated ACK is actually received; offline peer may not receive.
- TURN-only WebRTC DTLS-SRTP call engine with authenticated SDP/fingerprint and
  restricted ICE; source + mocked unit tests, not a real two-machine video call.
- Windows Electron best-effort capture exclusion requested before UI load.
- macOS Disk Arbitration guard native source compiled on hosted Mac runner,
  not embedded, supervised, signed, or physically tested on real USB.

## Release blockers that are NOT yet solved

1. **Actual GUI integration:** The Electron app is still a local dummy preview.
   Pinned Noise clients, encrypted profiles, sender/receiver read receipts,
   host remote clear, live media and 1/3/5-second session stop are not wired
   into one working Windows/Mac call. No final build exists.
2. **Actual hosting:** Render relay + Cloudflare TURN credentials still need
   account provisioning, static identity configuration, admission tests and
   billing controls. Secrets must not be committed. Cloud-only mocked tests
   do not substitute for real deployed-host testing.
3. **Approved identities:** In-person public-key comparison and QR enrollment,
   per-device revocation, Friend 2 multidevice approval and exact three-person
   authorization must all be tested end-to-end. Developer must have NO
   automatic access to the two friends' private plaintext.
4. **Mac USB:** Only a compiled observer prototype exists. Must bundle,
   supervise, bind to actually enrolled external volume/profile and run
   emergency removal/eject/hub/corruption/lock/crash tests ON THE ACTUAL MAC.
5. **Screen capture:** Newer macOS ScreenCaptureKit can record Electron window
   despite setContentProtection. Windows uses WDA_EXCLUDEFROMCAPTURE on a
   documented set of normal capture APIs, not all possible software/hardware
   recording. The user's requested UNIVERSAL anti-recording guarantee cannot
   be honestly marked PASS with the planned macOS architecture.
6. **Root/admin control:** Compromised operating-system kernel can falsify local
   policy evidence. Basic SIP/Gatekeeper/Windows Secure Boot checks help reject
   detectable failures; they DO NOT prove absence of malware/root. If signals
   fail, refuse chat and try to send an authenticated peer alert, but an offline
   device cannot receive an instant notice.
7. **Signing / release:** Proper notarization/signing, dependency and package
   audits, supply-chain/version pinning, Mac hardware testing, supported
   security-patched OS and independent review not completed.
8. **Windows 10:** Windows 10 22H2 passed ordinary support end in Oct 2025.
   Release must require verified extended updates or a supported upgrade.
9. **Testing:** More extensive timing, reconnect, dynamic USB removal,
   replay, muting, screen recorder pre/post, prolonged call, TURN UDP/TCP/TLS,
   server outage, app crash, restore/rollback and hostile endpoint tests.
   No guarantee that every bug has been found.

## Safe build workflow

- Do not request user to download every engineering version.
- Keep main unchanged until integration and security-review gates.
- Use isolated dummy-data cloud tests, including Windows and Mac packaging.
- Never claim a green build is a trusted private messenger.
- User's friend should not change Mac startup security, unlock bootloaders,
  disable Gatekeeper/SIP/antivirus, or install unknown root certificates.
- Do not use real personal chat, passwords or camera calls on incomplete builds.
