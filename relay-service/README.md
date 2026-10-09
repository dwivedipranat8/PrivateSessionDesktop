# Restricted libp2p relay and TURN credential issuer — DEVELOPMENT ONLY

This is not yet deployed. The server owns the restricted libp2p admission
relay and one authenticated protocol for obtaining short-lived Cloudflare TURN
credentials. It has no chat database, no media decryption keys, and no public
discovery interface.

## Required Render secrets (do not commit actual values)
- RELAY_PRIVATE_KEY_B64: stable libp2p Ed25519 private-key protobuf in base64
- ENROLLED_DEVICES_JSON: approved device peer IDs, roles builder/partner/portable,
  and revoked status; updating this requires a controlled re-deploy
- TURN_KEY_ID and TURN_KEY_API_TOKEN: server-only Cloudflare TURN key
- PUBLIC_RELAY_HOST: the service's DNS name, not a URL (e.g. service.onrender.com)
- PORT: Render's public web service port (normally supplied by Render)

The service fails at startup without the necessary secrets.

## Deployment limit
Only a single public listener is used (libp2p WebSockets). This design
needs a live WSS check on Render before use. Verified remote users still
need their pinned Noise identities, separate enrolled USB profiles and
authentic media signalling. The service must not become a generic relay.

## Security caveats
Provider and hosting logs can include IP/timing/volume metadata; not
anonymous. Cloudflare temporarily processes issuance of relay credentials.
The server knows approved peer IDs. Cryptographic content protection
depends on a distinct pinned client-client Noise connection (not just each
client's encrypted link to this server).

CI tests use only temporary dummy identities and a mocked credential issuer.
No real passwords, API keys, private conversations or USB profiles in GitHub.
