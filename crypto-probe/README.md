# Maintained libp2p Noise integration test

GitHub Actions starts two local dummy libp2p peers using Noise XX and
exchanges harmless bytes over a real authenticated encrypted stream.

Passing this test does NOT prove complete app E2EE, identity enrolment, a
working relay, screen-capture resistance or real Mac/USB security. No actual
private content or user credentials should be used in the test.
