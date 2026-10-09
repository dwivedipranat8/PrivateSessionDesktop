# Private Session Desktop — v0.2 local preview

**DUMMY TEST ONLY. NOT AN ENCRYPTED OR NETWORKED MESSENGER.** Do not use actual conversations.

## What changed
- One Start action requests **both camera and microphone**. If either is denied/unavailable, the chat demo never starts. If either live track ends/mutes, the demo ends. The mic activity meter shows whether audio is being detected, without playback or recording.
- Dummy message: press **Simulate Seen** to model a future authenticated peer read receipt. It is removed 2 seconds later, or by the original 30-second fallback, whichever happens first. This is NOT actual read detection; no other endpoint is connected.
- Choose **Host** or **Guest** in the demo menu before Start. Host gets **Delete chat**; Guest has no delete control. Delete only clears **this local dummy UI**. Roles are mock selectors, NOT cryptographic authorization. A real version must enforce host authority via verified identities and authenticate deletion controls, and a remote offline device cannot acknowledge deletion.
- Cleaner interface without numbered friend labels.
- Optional USB-folder disappearance check remains an experiment, not trusted USB hardware presence verification.

## Get the updated Windows preview
GitHub repo > Actions > latest green **Build dummy preview** run > Artifacts > **Windows-Dummy-Preview**. Download ZIP, extract and run EXE. The build is unsigned; do not disable antivirus or use this preview with sensitive information.

No local Node.js installation is required for GitHub-hosted builds.

## Still unimplemented
Peer connections, authenticated E2EE, real read receipts, networked host-only controls, real USB physical presence monitor and secure fail-closed implementation, signed Mac release, multi-device enrollment, secure media transport, and security review. Do not share as secure software.

A developer/testing identity must not have a backdoor into any future conversations. Each authorized device must receive a separate approved identity. Real two-endpoint mandatory camera/mic must require **independent informed consent** on both endpoints.


## Updated prototype reminder
The security-engine development branch contains cloud-tested cryptographic components, but its Electron interface is still a **local-only DUMMY PREVIEW**. Neither of the two user accounts has a real login/password yet; users will create private passwords locally in a future onboarding flow. Current Windows display protection is not a complete anti-recording guarantee; macOS ScreenCaptureKit may bypass Electron. See SECURITY_STATUS.md. The latest demo supports simulated 120-second Seen/unseen deletion and either role's local Clear & End; it cannot clear another computer because no remote peer connection is implemented.
