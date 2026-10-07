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
