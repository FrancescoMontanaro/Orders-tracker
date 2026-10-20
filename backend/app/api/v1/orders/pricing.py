from decimal import Decimal, ROUND_HALF_UP
from typing import Literal, Sequence
from dataclasses import dataclass


# Constants and types for order pricing calculations.
DiscountType = Literal["percentage", "fixed"]
CENT = Decimal("0.01")
HUNDRED = Decimal(100)
MAX_DISCOUNT = Decimal("9999999999.99")


@dataclass(frozen=True)
class OrderPricing:
    """Rounded order amounts and net line amounts in their original order."""

    subtotal: Decimal
    discount_amount: Decimal
    total: Decimal
    line_totals: tuple[Decimal, ...]


def calculate_order_pricing(
    lines: Sequence[tuple[float, float | Decimal]],
    applied_discount: float | Decimal = 0,
    discount_type: DiscountType = "percentage",
) -> OrderPricing:
    """Validate a discount and distribute the final total proportionally.

    Lines contain quantity and unit price. Cumulative rounding assigns any
    residual cents deterministically and guarantees that lines sum to total.
    """

    # Convert line quantities and prices to Decimal and calculate subtotal.
    amounts = [
        Decimal(str(quantity)) * Decimal(str(price)).quantize(CENT, rounding = ROUND_HALF_UP)
        for quantity, price in lines
    ]
    subtotal = sum(amounts, Decimal(0))
    discount = Decimal(str(applied_discount))

    # Validate discount format and positivity.
    if not discount.is_finite() or discount < 0:
        raise ValueError("Lo sconto deve essere positivo o zero, con al massimo due decimali.")
    if discount > MAX_DISCOUNT:
        raise ValueError("Lo sconto supera l'importo massimo consentito.")
    if discount != discount.quantize(CENT):
        raise ValueError("Lo sconto deve avere al massimo due decimali.")

    # Calculate the total after applying the discount.
    if discount_type == "percentage":
        if discount > HUNDRED:
            raise ValueError("Lo sconto percentuale deve essere compreso tra 0 e 100.")
        total = subtotal * (1 - discount / HUNDRED)

    # For fixed discounts, subtract the amount in euros from the subtotal.
    elif discount_type == "fixed":
        if discount > subtotal:
            raise ValueError("Lo sconto in euro non può superare il subtotale dell'ordine.")
        total = subtotal - discount

    # Reject unsupported discount types.
    else:
        raise ValueError("Tipo di sconto non valido.")

    # Round the total and subtotal to the nearest cent.
    total = total.quantize(CENT, rounding = ROUND_HALF_UP)
    rounded_subtotal = subtotal.quantize(CENT, rounding = ROUND_HALF_UP)

    # Round cumulative shares rather than each line independently to preserve cents.
    # This ensures that the sum of line totals equals the rounded total.
    cumulative = Decimal(0)
    allocated = Decimal(0)
    line_totals: list[Decimal] = []
    for amount in amounts:
        cumulative += amount
        target = (
            (cumulative * total / subtotal).quantize(CENT, rounding = ROUND_HALF_UP)
            if subtotal else Decimal(0)
        )
        line_totals.append(target - allocated)
        allocated = target

    # At this point, line_totals contains the rounded amounts for each line, summing to the total.
    return OrderPricing(
        subtotal = rounded_subtotal,
        discount_amount = rounded_subtotal - total,
        total = total,
        line_totals = tuple(line_totals),
    )
