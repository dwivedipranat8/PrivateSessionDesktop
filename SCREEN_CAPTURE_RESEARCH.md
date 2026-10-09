# Screen Capture Security Research — 2026-10-09

## Absolute requirement
The intended sensitive-use app must refuse release unless the developer can
demonstrate that the supported Mac and Windows threat model actually meets the
user's mandatory screenshot/recording protection. Current status: UNMET.

## Electron/Windows
Electron BrowserWindow.setContentProtection(true) calls
SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) on Windows, which excludes
normal OS-supported capture routes. Microsoft explicitly says it does NOT
provide strict DRM/security guarantees. Electron warns the content-exclusion
flag takes effect after a compositor pass. It is not mathematical impossibility.
Official references:
https://www.electronjs.org/docs/latest/api/browser-window/
https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity

## Electron/macOS
NSWindowSharingNone is bypassed by newer ScreenCaptureKit-based capture apps,
even without root-level compromise. See Electron documentation above.

## OS-managed macOS restrictions (stronger candidate)
Official macOS Device Management can set allowScreenShot=false to disable
saving screenshots and screen recordings. Also available in some Intune policies:
https://developer.apple.com/documentation/devicemanagement/restrictions
https://support.apple.com/guide/deployment/restrictions-for-mac-depba790e53/web
https://learn.microsoft.com/en-us/mem/intune/configuration/device-restrictions-macos
This affects the whole Mac. It requires the person's fully informed consent,
compatible device management/profile, reversibility and verification that
the policy truly stays active. Do NOT create or install a policy profile
without asking that Mac owner. Do NOT enrol users into broad remote-control
or wipe privileges. No real Mac testing has occurred.

## Apple Automatic Assessment Configuration (AAC)
Official educational assessment mode prevents screen recordings/captures:
https://developer.apple.com/documentation/automaticassessmentconfiguration/
BUT Apple grants a restricted entitlement only on approval, aimed at
educational assessment applications. A private messenger cannot claim
eligibility or bypass this entitlement.
https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.automatic-assessment-configuration
No entitlement has been requested, issued or tested.

## Strict limits
- A camera filming a screen or a compromised operating system remains possible.
- Finite screenshot/record tests cannot prove that every recording method fails.
- Privileged/root detection on ordinary Windows and macOS can be bypassed.
- Detectable failure must close local session and attempt E2EE peer notification.
- A peer cannot receive a notification while genuinely offline.
- Capturing a protected screen with separate devices is not preventable by
  software on the display.

## Next validation checkpoint
Record the actual Mac model and version; evaluate whether consented device
policy enforcement is available; test QuickTime, built-in screenshot tools,
ScreenCaptureKit, OBS, virtual displays, remote sessions, and preexisting
recording apps. Make sure a removed or expired policy blocks session Start.
Windows testing must cover Game Bar, Snipping Tool, OBS, and remote capture.
Build releases must stay blocked until independent review and real hardware
tests; the current CI release gate intentionally refuses sensitive release.
