import { pool } from "./db";
import { listProducts, placeOrder, getOrderSummary } from "./shop";

async function main() {
  console.log(await listProducts());

  const orderId = await placeOrder(1, [
    { productId: 1, quantity: 1 },
    { productId: 4, quantity: 2 },
  ]);
  console.log("Created order", orderId);
  console.log(await getOrderSummary(orderId));

  try {
    await placeOrder(1, [{ productId: 3, quantity: 999 }]);
  } catch (err: any) {
    console.log("Order failed:", err.code, err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
