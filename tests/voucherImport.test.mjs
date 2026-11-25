import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseVoucherCodes} from '../src/voucherImport.js';
test('CSV header, BOM, CRLF and normalized codes',()=>assert.deepEqual(parseVoucherCodes('\uFEFFcode\r\nabc12\r\nXYZ99\r\n'),['ABC12','XYZ99']));
test('reject malformed input and blank files',()=>{for(const s of ['','code','abc12,xyz99','1234','=formula'])assert.throws(()=>parseVoucherCodes(s));});
test('preserve duplicates for server-side accounting',()=>assert.deepEqual(parseVoucherCodes('ABCDE\nABCDE'),['ABCDE','ABCDE']));
