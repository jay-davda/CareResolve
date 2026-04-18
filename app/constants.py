"""
Constant values used across the application.
"""


class ComplaintCategory:
    """Allowed complaint categories for wellness products."""

    PRODUCT_ISSUE = "Product Issue"
    PACKAGING_ISSUE = "Packaging Issue"
    TRADE_ISSUE = "Trade Issue"

    # Handy list for validation / dropdowns
    ALL = [PRODUCT_ISSUE, PACKAGING_ISSUE, TRADE_ISSUE]
