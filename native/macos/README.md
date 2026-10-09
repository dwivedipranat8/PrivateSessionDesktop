# Mac removable-volume guard — prototype, NOT integrated

A small, separate macOS process that watches the *expected mounted volume*
using Disk Arbitration notifications plus an independent periodic statfs
filesystem-ID comparison. On confirmed volume disappearance it signals only
the exact still-running parent process. The parent must itself cover sensitive
UI and terminate capture on the first event, independent of this helper.

**Important:** This is currently a source/compile probe. It is not signed,
not bundled into Electron, not launched or supervised, and not tested on a
real Mac with the actual USB. If the executable is located on the removed USB,
page faults from the unplugged volume may block execution. An OS freeze or
malicious root/kernel attacker can defeat it. Nothing here proves complete
USB-loss protection, zero traces, or screenshot/recording exclusion.

Future release must tie the helper to the enrolled cryptographic volume
profile, volume mount lifetime and signature, supervise unexpected helper
death, confirm physical device identity beyond filesystem IDs where possible,
and test disconnect/eject/reinsert/hub changes/OS sleep under load.
