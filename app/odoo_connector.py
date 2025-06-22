import xmlrpc.client

def authenticate_with_odoo(db, username, password):
    """
    Authenticate with the Odoo instance.

    :param db: Odoo database name
    :param username: Odoo username (email)
    :param password: Odoo password
    :return: Tuple (uid, models) if authentication is successful
    """
    url = "http://localhost:8069"  # Update this if your Odoo instance URL changes
    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
    uid = common.authenticate(db, username, password, {})

    if not uid:
        raise Exception("Failed to authenticate with Odoo. Check your credentials.")

    models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
    return uid, models

def add_product_to_odoo(uid, models, db, password, name, price, quantity):
    """
    Add a product to the Odoo instance.

    :param uid: Authenticated user ID
    :param models: Object proxy for Odoo model operations
    :param db: Odoo database name
    :param password: Odoo password
    :param name: Name of the product
    :param price: Price of the product
    :param quantity: Quantity of the product
    :return: ID of the created product
    """
    product_id = models.execute_kw(
        db, uid, password,
        'product.product', 'create',
        [{
            'name': name,
            'list_price': float(price),
            'qty_available': quantity,
        }]
    )
    return product_id