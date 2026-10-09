# Security status — NOT READY FOR PRIVATE USE

This branch is ongoing implementation work, **not a working encrypted messenger**.

| Requirement | Code status | Real two-device/Mac test |
| --- | --- | --- |
| Electron window exclusion from ordinary screenshots | Added for Windows and best-effort Mac | NOT RUN |
| Root/hostile kernel guaranteed refusal | Impossible to guarantee | LIMIT |
| Two people with approved multi-device identity access policy | Pure policy with tests | NOT CONNECTED |
| In-person QR pairing / pinned Noise identity | Not implemented | NOT RUN |
| Noise E2EE signalling/text | Not implemented | NOT RUN |
| WebRTC endpoint DTLS-SRTP live audio/video | Relay-only call engine written; requires pinned Noise signalling and TURN service | NOT CONNECTED |
| Real authenticated remote seen receipt (2s, 30s fallback) | Pure state/timer rules with tests | NOT CONNECTED |
| Host-only authenticated remote delete | Policy in demo, network control not connected | NOT RUN |
| 1s peer heartbeat / 3s protect / 5s expire | Pure lease logic with tests | NOT CONNECTED |
| Immediate local stop for offline/USB/lock/crash | Some local demo stop paths; robust Mac native removable-media guard not implemented | NOT RUN |
| Physical Mac app on encrypted USB | Not tested | NOT RUN |
| Prevent all Mac screen recording | Not reliably possible with ordinary Electron/macOS APIs | LIMIT |
| Forensic zero traces | Not possible | LIMIT |

## No user downloads during this branch
Keep main at last tested preview. Develop and validate modules in the branch, and do not claim a finished release until actual hardware, pairing, live media, USB and security tests pass. Server provisioning needs a separate external account/setup, and the MacBook itself is a mandatory hardware gate. Do not weaken macOS Gatekeeper/SIP, Windows antivirus or boot security.

**Important:** the pure modules allow the caller to indicate a verified peer. This flag MUST only come from an actual cryptographically authenticated Noise transport—not UI-provided data, a relay claim or a local boolean the remote can set. Never turn on chat with fake authentication or missing peer key verification.
