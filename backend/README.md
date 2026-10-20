# Orders-tracker-backend

Orders accept `discount_type` (`percentage` or `fixed`) and `applied_discount`.
Omitting the type on creation preserves the previous percentage behavior; omitted
fields on PATCH keep the stored values. Fixed discounts are in euros and remain
fixed when quantities change. Discounts must be nonnegative with at most two
decimal places; percentages cannot exceed 100 and fixed amounts cannot exceed
the subtotal calculated from the order's snapshot prices.

Pricing uses decimal arithmetic and rounds half up to cents. Net line amounts
(`items[].net_amount`) are allocated proportionally using cumulative rounding,
so their sum matches `total_amount`. Reports and DDTs use the same allocation;
the customer report expresses fixed discounts as equivalent percentages.
Order exports include separate discount value and unit columns.

The startup schema patch adds the discount type and replaces the old percentage
constraint on existing MySQL databases. Existing orders remain percentages.
Rebuild and restart both backend and frontend together when deploying.

Run regression checks from this directory:

```bash
uv run python -m unittest discover -s tests -v
```

Tests use an isolated SQLite database and do not read application `.env` files
or connect to MySQL. MySQL startup DDL is checked separately with mocked schema
inspection; verify it against MySQL when deploying to a staging environment.

Frontend pricing checks: `cd ../frontend && npm run test:pricing` (Node 22.6+).
