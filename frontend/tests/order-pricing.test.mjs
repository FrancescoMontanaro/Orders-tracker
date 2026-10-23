import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderPricing, formatDiscount } from '../src/lib/order-pricing.ts';

const items = [{ quantity: 1, unit_price: 200 }];

test('percentage and fixed discounts retain their meaning when quantities change', () => {
  assert.equal(calculateOrderPricing(items, 10).total, 180);
  assert.equal(calculateOrderPricing(items, 20, 'fixed').total, 180);
  assert.equal(calculateOrderPricing([{ quantity: 1.5, unit_price: 200 }], 20, 'fixed').total, 280);
  assert.equal(calculateOrderPricing(items, '', 'fixed').total, 200);
});

test('reject invalid values and defer subtotal validation when prices are missing', () => {
  for (const [value, type] of [[-1, 'fixed'], [201, 'fixed'], [101, 'percentage'], [1.001, 'fixed'], [Infinity, 'fixed'], [NaN, 'fixed']]) {
    assert.ok(calculateOrderPricing(items, value, type).validationError);
  }
  assert.equal(calculateOrderPricing([{ quantity: 1 }], 20, 'fixed').validationError, null);
  assert.equal(calculateOrderPricing(items, 200, 'fixed').total, 0);
  assert.equal(calculateOrderPricing(items, 100, 'percentage').total, 0);
  assert.equal(calculateOrderPricing([{ quantity: 3, unit_price: .3 }], .9, 'fixed').validationError, null);
});

test('allocate residual cents and use server amounts for persisted lines', () => {
  const lines = Array.from({ length: 3 }, () => ({ quantity: 1, unit_price: 1 }));
  assert.deepEqual(calculateOrderPricing(lines, 1, 'fixed').lineTotals, [.67, .66, .67]);
  assert.equal(calculateOrderPricing([{ quantity: 1, unit_price: .05 }], 10).total, .05);
  assert.equal(calculateOrderPricing([{ quantity: 1, unit_price: 80.35 }], 10).total, 72.32);
  assert.deepEqual(calculateOrderPricing([{ quantity: 1, unit_price: 1, net_amount: .33 }], 0).lineTotals, [.33]);
});

test('format discount labels with the correct unit', () => {
  assert.equal(formatDiscount(12.5), '12,5%');
  assert.match(formatDiscount(20, 'fixed'), /20,00\s*€/);
});

test('customer line amounts stay at full price while the order discount is separate', () => {
  const pricing = calculateOrderPricing([
    { quantity: 2, unit_price: 30, net_amount: 56.43 },
    { quantity: 1, unit_price: 40, net_amount: 37.62 },
  ], 5.95, 'fixed');
  assert.deepEqual(pricing.grossLineTotals, [60, 40]);
  assert.equal(pricing.subtotal, 100);
  assert.equal(pricing.discountAmount, 5.95);
  assert.equal(pricing.total, 94.05);
  const fractional = [{ quantity: .25, unit_price: 3.50 }, { quantity: .25, unit_price: 3.50 }];
  const original = calculateOrderPricing(fractional);
  const discounted = calculateOrderPricing(fractional, .05, 'fixed');
  assert.deepEqual(discounted.grossLineTotals, original.grossLineTotals);
  assert.equal(discounted.grossLineTotals.reduce((sum, amount) => sum + amount, 0), discounted.subtotal);
});
