# Private Session — security development status

**NOT READY FOR PRIVATE USE. DO NOT DISTRIBUTE THIS BRANCH.**

The main branch remains the last user-tested local-only preview (no remote chat).
This branch is an independently developed, unmerged technical prototype; its
modules have not been integrated into a working Windows/Mac client.

## Cloud tests completed
- Local two-node authenticated libp2p Noise message exchange: PASS
- Two dummy peers exchanging Noise-encrypted data through a third-party circuit relay: PASS
- Authenticated dummy Seen -> 2-second expiry and host remote Delete over Noise: PASS
- Peer heartbeat rules (3-second protect / 5-second expire, anti-replay): PASS in unit tests
- Session-bound control parser, restricted device-role allowlist: PASS in unit tests
- TURN credential issuance and restricted libp2p relay admission: PASS in cloud integration tests
- Pure fail-closed session coordinator and seen-visibility eligibility: PASS in unit tests

## Source implemented, still NOT integrated or physically tested
- Electron window capture exclusion requested before any app UI content.
- WebRTC DTLS-SRTP relay-only call engine, requiring authenticated Noise signalling.
- Server package for Render that admits only enrolled device IDs, relays Noise
  connections and issues short-lived Cloudflare TURN credentials.
- Basic stop/clear/key-disposal coordination and message receipt policies.

## Missing before even a dummy two-device Windows/Mac demonstration
- Identity creation, protected profile storage and QR/verified peer enrollment.
- Install and wire the secure Noise relay-client engine into Electron main process.
- Authenticated Start approval, data channel and WebRTC signalling between actual devices.
- Complete UI read receipts and host control over that authenticated channel.
- Real USB-dependent portable Mac app with native Disk Arbitration supervision.
- Persistent server deployment on a user-authorized Render account and optional
  Cloudflare TURN key (server-side only). The server is not running anywhere.
- Release signing/notarization, documented recovery, pin/revocation, endpoint
  integrity checks and regression coverage.
- Physical Windows/Mac screenshot, recording, camera/mic, network loss, removable
  drive removal and crash testing. Security review by qualified independent reviewer.

## Platform limits that cannot be solved by ordinary app code
- Newer macOS ScreenCaptureKit capture can bypass Electron window protections.
- Windows capture exclusion protects only compliant OS routes; hardware and hostile
  privileged capture remain.
- An offline remote peer cannot receive an immediate remote Delete. Independently
  enforced local timers/end session are still required.
- OS traces, memory/swap remnants, kernel compromise, copied ordinary USB are not
  absolutely preventable/detectable.

## User instruction
Do not ask user to download iterative builds. Continue work in this private
development branch, use GitHub Actions/cloud dummy-data tests, and keep main
unchanged until integrated prototype has been reviewed. Actual Mac/USB testing
and provider provisioning must still be undertaken before a sensitive release.
