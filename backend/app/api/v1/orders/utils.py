def format_it_number(value: float) -> str:
    """
    Format a float using Italian-style formatting:
    - thousands separator: '.'
    - decimal separator: ','
    - always 2 decimal places
    """

    # Format with US style first: 12,345.60
    formatted = f"{value:,.2f}"
    
    # Swap separators: , -> temporary, . -> ,, temp -> .
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
    
    # Return the formatted string
    return formatted