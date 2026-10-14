import { pool } from "./db";

export type OrderItem = { productId: number; quantity: number };

export async function listProducts() {
  const { rows } = await pool.query(
    "SELECT id, name, price, stock FROM products ORDER BY id",
  );
  return rows;
}

export async function placeOrder(customerId: number, items: OrderItem[]) {
  const payload = items.map((i) => ({
    product_id: i.productId,
    quantity: i.quantity,
  }));

  const { rows } = await pool.query<{ order_id: number }>(
    "SELECT place_order($1, $2::jsonb) AS order_id",
    [customerId, JSON.stringify(payload)],
  );
  return rows[0].order_id;
}

export async function getOrderSummary(orderId: number) {
  const { rows } = await pool.query(
    "SELECT * FROM order_summary WHERE order_id = $1",
    [orderId],
  );
  return rows[0] ?? null;
}

export async function getCustomerSpending(customerId: number) {
  const { rows } = await pool.query(
    "SELECT * FROM customer_spending WHERE id = $1",
    [customerId],
  );
  return rows;
}

export async function searchProducts(opts: {
  q?: string;
  limit: number;
  afterId?: number;
}) {
  const { rows } = await pool.query(
    `SELECT id, name, price, stock
     FROM products
     WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
       AND id > $2
     ORDER BY id
     LIMIT $3`,
    [opts.q ?? null, opts.afterId ?? 0, opts.limit],
  );
  return rows;
}

export async function getCustomerOrders(
  customerId: number,
  limit: number, //pageSize
  offset: number, //page number
) {
  const { rows } = await pool.query(
    `SELECT order_id, status, created_at, order_total
     FROM order_summary
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset],
  );
  return rows;
}

export async function cancelOrder(orderId: number) {
  await pool.query("SELECT cancel_order($1)", [orderId]);
}

export async function getOrderItems(orderId: number) {
  const { rows } = await pool.query(
    `SELECT p.id AS product_id, p.name, oi.quantity, oi.unit_price,
            oi.quantity * oi.unit_price AS line_total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY p.name`,
    [orderId],
  );
  return rows;
}
