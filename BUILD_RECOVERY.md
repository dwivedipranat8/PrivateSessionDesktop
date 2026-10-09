# How to restore the GitHub Windows download

**Current block (9 October 2026):** The private-repository Actions runs are
failing before any runner starts. The jobs report \`runner_id: 0\` and have
**zero steps**; no new Windows ZIP exists. The GitHub connector cannot read
the private account's billing entitlements. It is therefore incorrect to say
that every source-code test failed or that the current build is ready.

## Step 1 — Check the GitHub account (owner action only)
1. Sign in as the **owner of this private repository**.
2. Click the profile avatar → **Settings** → **Billing and licensing**
   (or **Billing and plans**, depending on the current GitHub interface).
3. Find **Usage / Actions**, remaining included minutes, spending/budget
   limits and any payment/usage restriction banners.
4. If the included allowance has been exhausted and you do not wish to pay,
   wait for the next billing-cycle reset; **do not** enable paid overages
   merely to download this test.
5. If the allowance is healthy but all jobs still fail before steps, open the
   latest run and look for its runner/job annotation. Contact GitHub Support
   with the run URL and the message if it mentions a billing restriction.

Official documentation:
https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Step 2 — Build deliberately, only after runners work
1. Open https://github.com/dwivedipranat8/PrivateSessionDesktop/actions
2. Choose **Security tests and opt-in packaging**.
3. Click **Run workflow**.
4. Select branch **development/security-engine**.
5. Select **verify_packages = true** and **build_mac = false**.
6. Start the workflow and wait for Windows and test jobs to pass.
7. Under **Artifacts** download **Windows-EXPERIMENTAL-NOT-SECURE**,
   only if GitHub produced it in a fully successful packaging job.

Do NOT publish, install for real private use or grant the Protected user
actual confidential content based on this package. The full Mac hardware
capture restriction and USB monitoring remain unverified. Do not disable
Windows Defender, Gatekeeper, SIP, or other operating system defenses just
to force an unsigned build to run.

## Step 3 — Capture assurance must be tested separately
A Windows screenshot FILE existing does not establish that its screenshot
contains the capture-excluded private WINDOW. Use dummy content only and
compare the actual image region. Test built-in screenshot, screen recording,
third-party ScreenCaptureKit on the Mac, a recorder that starts before launch,
remote desktop and screen sharing. No software-only result can guarantee
absence of every privileged or physical camera capture path.

For more Mac testing detail see capture-pilot/macos/README.md.
