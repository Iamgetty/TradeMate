const test = require('node:test');
const assert = require('node:assert/strict');
const { decimalToUnits, unitsToDecimal, productToFiatCents, fiatCentsToQuantityUnits } = require('../dist/p2p-decimal');

test('fixed-point parser preserves all supported price and quantity digits', () => {
  assert.equal(decimalToUnits('65000.1234567890', 10, 'price'), 650001234567890n);
  assert.equal(unitsToDecimal(10001n, 12), '0.000000010001');
  assert.equal(decimalToUnits('0.01', 2, 'fiat'), 1n);
});

test('fixed-point parser rejects exponent notation, excess precision and malformed values', () => {
  assert.throws(() => decimalToUnits('1e-8', 12, 'quantity'));
  assert.throws(() => decimalToUnits('0.0000000000001', 12, 'quantity'));
  assert.throws(() => decimalToUnits('-1.00', 2, 'fiat'));
  assert.throws(() => decimalToUnits('NaN', 2, 'fiat'));
});

test('fiat-to-asset conversion rounds down and never over-reserves quantity', () => {
  const price = decimalToUnits('3.00', 10, 'price');
  const cents = decimalToUnits('10.00', 2, 'fiat');
  const quantity = fiatCentsToQuantityUnits(cents, price);
  assert.equal(unitsToDecimal(quantity, 12), '3.333333333333');
  assert.ok(productToFiatCents(price, quantity) <= cents);
});

test('product valuation rounds half-up to fiat cents', () => {
  const price = decimalToUnits('1.005', 10, 'price');
  const quantity = decimalToUnits('1', 12, 'quantity');
  assert.equal(unitsToDecimal(productToFiatCents(price, quantity), 2), '1.01');
});

test('partial fill and cancellation restoration are exact at asset precision', () => {
  const total = decimalToUnits('1.000000000001', 12, 'quantity');
  const fill = decimalToUnits('0.333333333333', 12, 'quantity');
  const remaining = total - fill;
  assert.equal(unitsToDecimal(remaining, 12), '0.666666666668');
  assert.equal(unitsToDecimal(remaining + fill, 12), '1.000000000001');
});
