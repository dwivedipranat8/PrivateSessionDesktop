# Mac screenshot/recording restriction pilot — consent required

**NOT automatically installed. NOT proof of universal screenshot protection.**
The included configuration profile applies one setting:
`com.apple.applicationaccess: allowScreenShot = false`.
No MDM enrollment, certificates, VPN, passcode, login account, camera restriction,
system extensions, or device-wipe permissions are requested.

Apple's official schema supports macOS manual installation of the Restrictions payload.
A profile may be removed by the local Mac owner. It affects **the whole Mac**, not
only the messenger, while installed. Use only with the Mac owner's fully informed
consent and **dummy content**. This unsigned sample should be inspected before
any owner decides to install it. CI checks plist structure, NOT Mac enforcement.

Source:
- https://developer.apple.com/documentation/devicemanagement/restrictions
- https://github.com/apple/device-management/blob/release/mdm/profiles/com.apple.applicationaccess.yaml

## Before any test
1. Record macOS version/build and chip/model; identify any preexisting profiles,
   without sharing serial numbers or other private identifiers.
2. On dummy-only content, verify built-in screenshot, screen recording, and
   ScreenCaptureKit behavior **before** changing device configuration.
3. Explain explicitly to the owner that the restriction is global to their Mac.
   Stop if the Mac is company/school managed or existing restrictions conflict.

## Install ONLY after owner chooses to proceed
1. Review the plain-text `ScreenCaptureRestriction.mobileconfig` and confirm
   that its only restriction is `allowScreenShot=false`.
2. Open the profile locally. Review it under **System Settings > General >
   Device Management** (menu wording depends on macOS version) and install it
   using the owner's own authorization. Never bypass Gatekeeper, SIP or boot
   security to install this test.
3. Use only the local dummy target `dummy-target.html`; test both screenshot
   shortcuts, clipboard screenshots, screenshot toolbar, built-in recorder,
   approved ScreenCaptureKit recorders, screen sharing and recordings launched
   both BEFORE and AFTER profile activation. Note whether recording is refused,
   blank, or still visible. Repeat after reboot.
4. Remove/reject the policy while a dummy session runs to evaluate fail-closed
   behavior once that feature is integrated. Do not use actual private chat.

## Roll back
1. In **System Settings > General > Device Management**, select ONLY
   "Private Session - Capture Restriction PILOT"; choose Remove Profile.
2. Remove test recorder permissions if newly granted during the experiment.
3. Confirm the original screenshot/recording behavior returns; restart the
   Mac if necessary. Do not remove preexisting unrelated profiles.

## Limits
- Installed status does not prove policy is effective across ScreenCaptureKit,
  third-party recorders, mirroring or external cameras. Actual Mac testing is
  required on each supported hardware/OS configuration.
- Root/admin malware can defeat device policy evidence. A removable profile can
  be removed. A camera pointing at the display is beyond software prevention.
- The production app MUST fail closed until an independently verified capture
  policy is available; it must NOT set captureProtectionVerified=true simply
  because the test profile file exists.
