import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEnrolled,admit,permittedPair} from '../src/policy.mjs';
const sample=JSON.stringify([
 {peerId:'12D3KooWAAAaaa1234567890',role:'builder'},
 {peerId:'12D3KooWBBBbbb1234567890',role:'partner'},
 {peerId:'12D3KooWCCCccc1234567890',role:'partner'},
 {peerId:'12D3KooWDDDddd1234567890',role:'portable'},
 {peerId:'12D3KooWEEEeee1234567890',role:'partner',revoked:true}
]);
test('builder may test partner, but cannot access portable conversations',()=>{
 const m=parseEnrolled(sample);
 assert.equal(admit(m,'12D3KooWEEEeee1234567890'),false);
 assert.equal(permittedPair(m,'12D3KooWAAAaaa1234567890','12D3KooWDDDddd1234567890'),false);
 assert.equal(permittedPair(m,'12D3KooWAAAaaa1234567890','12D3KooWBBBbbb1234567890'),true);
});
test('separately approved partner devices allowed private pairing only',()=>{
 const m=parseEnrolled(sample);
 assert.equal(permittedPair(m,'12D3KooWBBBbbb1234567890','12D3KooWDDDddd1234567890'),true);
 assert.equal(permittedPair(m,'12D3KooWCCCccc1234567890','12D3KooWDDDddd1234567890'),true);
 assert.equal(permittedPair(m,'12D3KooWCCCccc1234567890','12D3KooWBBBbbb1234567890'),false);
});
test('no empty or malformed enrollment allowed',()=>{
 assert.throws(()=>parseEnrolled('[]'));
 assert.throws(()=>parseEnrolled('[{"peerId":"short","role":"partner"}]'));
 assert.throws(()=>parseEnrolled('invalid JSON'));
});
