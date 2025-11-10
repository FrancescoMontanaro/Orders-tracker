from typing import List
from sqlalchemy import select, func, and_

from ....db.session import db_session
from ....db.orm import (
    ProductORM,
    ExpenseORM,
    ExpenseCategoryORM,
    IncomeORM,
    IncomesCategoryORM,
    CustomerORM,
    OrderORM,
    OrderItemORM
)

# Importing models from the same module
from .models import (
    ProductSalesRequest, ProductSalesRow,
    ExpensesCategoriesRequest, ExpenseCategoriesRow,
    IncomeCategoriesRequest, IncomeCategoriesRow,
    CustomerSalesRequest, CustomerSalesResponse, CustomerSalesRow,
    CashflowRequest, CashflowResponse, CashEntry, CashExpense, CashIncome
)


# --------------------------- #
# ------ Product Sales ------ #
# --------------------------- #

async def report_product_sales(payload: ProductSalesRequest) -> List[ProductSalesRow]:
    """
    Function to generate product sales report.

    Parameters:
    - payload: ProductSalesRequest

    Returns:
    - List[ProductSalesRow]
    """

    # Querying the database
    async with db_session() as session:
        # Create the statement to compute product sales
        stmt = (
            select(
                ProductORM.id.label("product_id"),
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("unit"),
                func.sum(OrderItemORM.quantity).label("total_qty"),
                func.sum(OrderItemORM.quantity * OrderItemORM.unit_price).label("revenue"),
            )
            .join(OrderItemORM, OrderItemORM.product_id == ProductORM.id)
            .join(OrderORM, OrderORM.id == OrderItemORM.order_id)
            .where(OrderORM.delivery_date.between(payload.start_date, payload.end_date))
            .group_by(ProductORM.id, ProductORM.name)
            .order_by(ProductORM.name.asc())
        )

        # If a specific product ID is provided, filter the results
        if payload.product_ids:
            # Filtering by product ID
            stmt = stmt.where(ProductORM.id.in_(payload.product_ids))

        # Executing the query
        res = await session.execute(stmt)

        # Processing the results
        rows = res.all()

        # Create and return the list of ProductSalesRow
        return [
            ProductSalesRow(
                product_id = int(r.product_id),
                product_name = r.product_name,
                total_qty = round(float(r.total_qty or 0), 2),
                unit = r.unit,
                revenue = round(float(r.revenue or 0), 2)
            )
            for r in rows
        ]


# ---------------------- #
# ------ Expenses ------ #
# ---------------------- #

async def report_expenses_categories(payload: ExpensesCategoriesRequest) -> List[ExpenseCategoriesRow]:
    """
    Function to generate expenses report.

    Parameters:
    - payload: ExpensesCategoriesRequest

    Returns:
    - List[ExpenseCategoriesRow]
    """

    # Querying the database
    async with db_session() as session:
        # Create the statement to compute expenses by category
        stmt = (
            select(
                ExpenseCategoryORM.id.label("category_id"),
                ExpenseCategoryORM.descr.label("category_descr"),
                func.coalesce(func.sum(ExpenseORM.amount), 0).label("amount"),
                func.count(ExpenseORM.id).label("records_count"),
            )
            .select_from(ExpenseCategoryORM)
            .join(
                ExpenseORM,
                and_(
                    ExpenseORM.category_id == ExpenseCategoryORM.id,
                    ExpenseORM.timestamp >= payload.start_date,
                    ExpenseORM.timestamp <= payload.end_date,
                ),
                isouter = True, 
            )
            .group_by(ExpenseCategoryORM.id, ExpenseCategoryORM.descr)
            .order_by(ExpenseCategoryORM.id.asc())
        )
        
        # If specific category IDs are provided, filter the results
        if payload.category_ids:
            # Filtering by category ID
            stmt = stmt.where(ExpenseCategoryORM.id.in_(payload.category_ids))

        # Executing the query
        res = await session.execute(stmt)
        
        # Extracting all rows
        rows = res.all()

        # Create and return the list of ExpenseCategoriesRow
        return [
            ExpenseCategoriesRow(
                category_id = int(r.category_id),
                category_descr = r.category_descr,
                amount = round(float(r.amount or 0), 2),
                count = int(r.records_count or 0)
            )
            for r in rows
        ]

# --------------------- #
# ------ Incomes ------ #
# --------------------- #


async def report_income_categories(payload: IncomeCategoriesRequest) -> List[IncomeCategoriesRow]:
    """
    Function to generate income report.

    Parameters:
    - payload: IncomeCategoriesRequest

    Returns:
    - List[IncomeCategoriesRow]
    """

    # Querying the database
    async with db_session() as session:
        # Create the statement to compute income by category
        stmt = (
            select(
                IncomesCategoryORM.id.label("category_id"),
                IncomesCategoryORM.descr.label("category_descr"),
                func.coalesce(func.sum(IncomeORM.amount), 0).label("amount"),
                func.count(IncomeORM.id).label("records_count"),
            )
            .select_from(IncomesCategoryORM)
            .join(
                IncomeORM,
                and_(
                    IncomeORM.category_id == IncomesCategoryORM.id,
                    IncomeORM.timestamp >= payload.start_date,
                    IncomeORM.timestamp <= payload.end_date,
                ),
                isouter = True, 
            )
            .group_by(IncomesCategoryORM.id, IncomesCategoryORM.descr)
            .order_by(IncomesCategoryORM.id.asc())
        )
        
        # If specific category IDs are provided, filter the results
        if payload.category_ids:
            # Filtering by category ID
            stmt = stmt.where(IncomesCategoryORM.id.in_(payload.category_ids))

        # Executing the query
        res = await session.execute(stmt)
        
        # Extracting all rows
        rows = res.all()

        # Create and return the list of IncomesCategoriesRow
        return [
            IncomeCategoriesRow(
                category_id = int(r.category_id),
                category_descr = r.category_descr,
                amount = round(float(r.amount or 0), 2),
                count = int(r.records_count or 0)
            )
            for r in rows
        ]


# ---------------------------- #
# ------ Customer Sales ------ #
# ---------------------------- #

async def report_customer_sales(payload: CustomerSalesRequest) -> CustomerSalesResponse:
    """
    Function to generate customer sales report.

    Parameters:
    - payload: CustomerSalesRequest

    Returns:
    - CustomerSalesResponse
    """

    # Creating the database session
    async with db_session() as session:
        # Create the statement for per-product sales
        per_product_stmt = (
            select(
                ProductORM.id.label("product_id"),
                ProductORM.name.label("product_name"),
                ProductORM.unit.label("unit"),
                func.avg(OrderORM.applied_discount).label("avg_discount"),
                func.sum(OrderItemORM.quantity).label("total_qty"),
                func.sum(OrderItemORM.quantity * OrderItemORM.unit_price * (1 - (func.coalesce(OrderORM.applied_discount, 0) / 100.0))).label("revenue"),
            )
            .join(OrderItemORM, OrderItemORM.product_id == ProductORM.id)
            .join(OrderORM, OrderORM.id == OrderItemORM.order_id)
            .where(
                OrderORM.customer_id == payload.customer_id,
                OrderORM.delivery_date.between(payload.start_date, payload.end_date),
            )
            .group_by(ProductORM.id, ProductORM.name)
            .order_by(ProductORM.name.asc())
        )

        # Executing the query
        res = await session.execute(per_product_stmt)
        per_product_rows = res.all()

        # Create the statement for total revenue
        total_stmt = (
            select(
                func.sum(
                    OrderItemORM.quantity * OrderItemORM.unit_price *
                    (1 - (func.coalesce(OrderORM.applied_discount, 0) / 100.0))
                )
            )
            .select_from(OrderORM)
            .join(OrderItemORM, OrderItemORM.order_id == OrderORM.id)
            .where(
                OrderORM.customer_id == payload.customer_id,
                OrderORM.delivery_date.between(payload.start_date, payload.end_date),
            )
        )

        # Executing the query
        total = float(await session.scalar(total_stmt) or 0.0)

        # Get customer name
        cust = await session.get(CustomerORM, payload.customer_id)
        cust_name = cust.name if cust else None

        # Creating the CustomerSalesResponse object
        return CustomerSalesResponse(
            customer_id = payload.customer_id,
            customer_name = cust_name,
            total_revenue = round(total, 2),
            per_product = [
                CustomerSalesRow(
                    product_id = int(r.product_id),
                    product_name = r.product_name,
                    avg_discount = round(float(r.avg_discount or 0), 2),
                    total_qty = round(float(r.total_qty or 0), 2),
                    revenue = round(float(r.revenue or 0), 2),
                    unit = r.unit
                )
                for r in per_product_rows
            ]
        )


# ---------------------- #
# ------ Cashflow ------ #
# ---------------------- #

async def report_cashflow(payload: CashflowRequest) -> CashflowResponse:
    """
    Function to generate cash flow report.

    Parameters:
    - payload: CashflowRequest

    Returns:
    - CashflowResponse
    """

    # Creating the database session
    async with db_session() as session:
        # Create the statement for cash flow entries
        entries_stmt = (
            select(
                OrderORM.id.label("order_id"),
                OrderORM.delivery_date.label("date"),
                (
                    func.sum(
                        OrderItemORM.quantity * OrderItemORM.unit_price * (1 - (func.coalesce(OrderORM.applied_discount, 0) / 100.0))
                    ).label("amount")
                )
            )
            .join(OrderItemORM, OrderItemORM.order_id == OrderORM.id)
            .group_by(OrderORM.id, OrderORM.delivery_date)
            .where(OrderORM.delivery_date.between(payload.start_date, payload.end_date))
            .where(OrderORM.status == "delivered")
            .order_by(OrderORM.delivery_date.asc(), OrderORM.id.asc())
        )

        # Executing the query
        entries_res = await session.execute(entries_stmt)
        entries_rows = entries_res.all()

        # Mapping the results to CashEntry objects
        entries = [
            CashEntry(
                order_id = int(r.order_id), 
                date = r.date, 
                amount = float(r.amount or 0)
            )
            for r in entries_rows
        ]

        # Calculating the total entries amount
        entries_total = sum(e.amount for e in entries)
        
        # Initializing incomes list
        incomes: List[CashIncome] = []
        
        # If include_incomes is True, process incomes
        if payload.include_incomes:
            # Create the statement for cash flow incomes
            incomes_stmt = (
                select(
                    IncomeORM.id,
                    IncomeORM.timestamp,
                    IncomeORM.amount,
                    IncomeORM.note,
                )
                .where(IncomeORM.timestamp.between(payload.start_date, payload.end_date))
                .order_by(IncomeORM.timestamp.asc(), IncomeORM.id.asc())
            )

            # Executing the query
            incomes_res = await session.execute(incomes_stmt)
            incomes_rows = incomes_res.all()

            # Mapping the results to CashIncome objects
            incomes = [
                CashIncome(
                    id = int(r.id), 
                    date = r.timestamp, 
                    amount = float(r.amount or 0), 
                    note = r.note
                )
                for r in incomes_rows
            ]

            # Adding incomes amounts to entries total
            incomes_total = sum(i.amount for i in incomes)
            entries_total += incomes_total

        # Create the statement for cash flow expenses
        expenses_stmt = (
            select(
                ExpenseORM.id,
                ExpenseORM.timestamp,
                ExpenseORM.amount,
                ExpenseORM.note,
            )
            .where(ExpenseORM.timestamp.between(payload.start_date, payload.end_date))
            .order_by(ExpenseORM.timestamp.asc(), ExpenseORM.id.asc())
        )

        # Executing the query
        expenses_res = await session.execute(expenses_stmt)
        expenses_rows = expenses_res.all()

        # Mapping the results to CashExpense objects
        expenses = [
            CashExpense(
                id = int(r.id), 
                date = r.timestamp, 
                amount = float(r.amount or 0), 
                note = r.note
            )
            for r in expenses_rows
        ]

        # Calculating the total expenses amount
        expenses_total = sum(e.amount for e in expenses)

        # Calculating the net cash flow
        net = entries_total - expenses_total

        # Creating the CashflowResponse object
        return CashflowResponse(
            entries_total = round(entries_total, 2),
            expenses_total = round(expenses_total, 2),
            net = round(net, 2),
            entries = entries,
            expenses = expenses,
            incomes = incomes,
        )