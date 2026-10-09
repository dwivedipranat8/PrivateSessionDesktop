# Free Windows build — after GitHub Actions monthly minutes are exhausted

This project is **not a final secure messenger**. The new Windows build is an
**unsigned experimental binary** until real two-device video, macOS capture
policy, actual encrypted USB loss, and independent security tests are complete.

Your October 9 GitHub billing screenshot showed **$12.00 gross usage and $0.00
billed**. Linux 532 min at $0.006/min + Windows 129 min at $0.010/min +
macOS 121.26 min at $0.062/min is about $12, equal to almost exactly
2,000 Linux-equivalent minutes. GitHub Free's private repository allowance is
2,000 minutes per month, so the latest workflows failing with runner ID 0
and no executed steps are consistent with free quota exhaustion.

## Build on the same Windows laptop without paying for Actions

1. Visit the private repository:
   https://github.com/dwivedipranat8/PrivateSessionDesktop
2. Use the branch selector to choose **development/security-engine**.
3. Click **Code** then **Download ZIP**. This downloads source code, not an
   executable. Extract the ZIP somewhere on your Windows computer.
4. Install the official **Node.js 22** from https://nodejs.org/ if missing.
   Use the standard Windows x64 installer. Never paste your chat passwords
   into the build terminal. Do not disable Windows antivirus or protection.
5. Inside the extracted folder open **BUILD_WINDOWS_FREE.cmd**.
   It installs dependencies and runs the application, encryption and relay
   test suites. Only if all pass, it packages the experimental EXE.
   An internet connection is needed the first time for npm packages.
6. The resulting file, if successful, is
   **dist/PrivateSession-Dummy-x64.exe** (not signed).
   Logs are in **LOCAL_WINDOWS_BUILD_LOG.txt** (do not share logs without
   reading and removing any personal paths or data).
7. If a step fails, stop. Send only the **last error text**, redacting any
   personal paths or other identifying details; do not skip the checks.

This procedure does not charge GitHub Actions minutes and can be repeated
locally after future updates. It does **not** turn the existing prototype
into a signed, independently verified or screenshot-proof application.

For an experiment on real encrypted video, an independently deployed
allowlisted relay and TURN service and two physically tested endpoints
are still required. The app's instructions must not encourage the
Protected participant to share camera/microphone without meaningful
permission and an active-use indicator.

GitHub billing official reference:
https://docs.github.com/en/billing/concepts/product-billing/github-actions
