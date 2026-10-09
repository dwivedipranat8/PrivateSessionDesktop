# Private Session Desktop — v0.1 dummy preview

**NOT A SECURE MESSENGER. No real E2EE, remote video/audio, peer pairing, real USB identity verification, or authenticated heartbeat. USE DUMMY DATA ONLY.**

This starter allows locally testing a session Start/End flow, 30-second dummy messages, local camera/mic preview, network-interface loss, a simulated failure, and basic test-folder disappearance. It includes GitHub cloud builds, so the developer's Windows PC does NOT need Node.js installed.

## Obtain the Windows dummy preview
1. Open Actions in this private repository.
2. Open the latest successful run of Build dummy preview.
3. Under Artifacts download Windows-Dummy-Preview, extract the ZIP, and open its EXE.
4. Windows may warn because this test EXE is unsigned. Do not disable Windows security globally. Do not share test builds as secure tools.

Optional USB experiment: before Start, choose an empty folder on a spare USB; then Start and remove/eject the drive. This is a basic access test, not a dependable physical-removal or key-wipe guarantee. It writes no data to the drive.

Roles for eventual design: developer/tester (not an automatic participant); Friend 2 (possibly several explicitly enrolled devices); Friend 3 (MacBook app from removable media). Their real chat will need separately authenticated E2EE and a reviewed session lifecycle. Nothing here can communicate between people yet.

**Limitations:** no screenshot blocking; no secure USB monitor; no remote chat or media; no independent audit. OS/kernel freeze can defeat shutdown timers. Windows 10 22H2 may be outside normal security support; do not deploy the eventual sensitive-use app there without supported security updates.

The separate PDF development guide is a specification, not proof of security. Begin with dummy experiments only.
