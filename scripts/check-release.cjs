'use strict';
const {evaluateSensitiveRelease}=require('../core/release-gate.cjs');
const assessment=evaluateSensitiveRelease({platform:process.platform});
console.error('RELEASE BLOCKED: '+assessment.reason);
console.error('Outstanding gates: '+assessment.blockers.join(', '));
process.exitCode=assessment.allowed?0:1;
