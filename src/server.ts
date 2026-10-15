import express, { NextFunction, Request, Response } from "express";
import {
  searchProducts,
  placeOrder,
  getOrderSummary,
  getCustomerOrders,
  cancelOrder,
  getOrderItems,
  payOrder,
  getOrderHistory,
  searchProductsText,
} from "./shop";

const app = express();
app.use(express.json());

// GET /products?q=mouse&limit=10&afterId=0
app.get("/products", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const afterId = Number(req.query.afterId) || 0;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    let attrs: object | undefined;
    if (typeof req.query.attrs === "string") {
      try {
        attrs = JSON.parse(req.query.attrs);
      } catch {
        return res.status(400).json({ error: "attrs must be valid JSON" });
      }
    }
    const products = await searchProducts({ q, limit, afterId, attrs });
    const nextAfterId =
      products.length === limit ? products[products.length - 1].id : null;
    res.json({ products, nextAfterId });
  } catch (err) {
    next(err);
  }
});

// GET /search?q=wireless mouse&page=1&pageSize=10
app.get("/search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.status(400).json({ error: "q is required" });
    }
    const pageSize = Math.min(Number(req.query.pageSize) || 10, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const results = await searchProductsText({
      q,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ q, page, pageSize, results });
  } catch (err) {
    next(err);
  }
});

// POST /orders  { "customerId": 1, "items": [{ "productId": 1, "quantity": 2 }] }
app.post("/orders", async (req, res, next) => {
  try {
    const { customerId, items } = req.body;
    if (!Number.isInteger(customerId) || !Array.isArray(items)) {
      return res
        .status(400)
        .json({ error: "customerId and items are required" });
    }
    const key = req.header("Idempotency-Key");
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (key !== undefined && !uuidRe.test(key)) {
      return res.status(400).json({ error: "Idempotency-Key must be a UUID" });
    }
    const { orderId, created } = await placeOrder(customerId, items, key);
    res.status(created ? 201 : 200).json(await getOrderSummary(orderId));
  } catch (err) {
    next(err);
  }
});

// GET /customers/:id/orders?page=1&pageSize=10
app.get("/customers/:id/orders", async (req, res, next) => {
  try {
    const pageSize = Math.min(Number(req.query.pageSize) || 10, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const orders = await getCustomerOrders(
      Number(req.params.id),
      pageSize,
      (page - 1) * pageSize,
    );
    res.json({ page, pageSize, orders });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/cancel
app.post("/orders/:id/cancel", async (req, res, next) => {
  try {
    await cancelOrder(Number(req.params.id));
    res.json({ status: "cancelled" });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id
app.get("/orders/:id", async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "Invalid order ID" });
    }
    const order = await getOrderSummary(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const items = await getOrderItems(orderId);
    res.json({ ...order, items });
  } catch (err) {
    next(err);
  }
});

app.post("/orders/:id/pay", async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const method = req.body?.method;
    if (!["card", "upi", "cod"].includes(method)) {
      return res.status(400).json({ error: "method must be card, upi or cod" });
    }
    const paymentId = await payOrder(orderId, method);
    res.json({ paymentId });
  } catch (err) {
    next(err);
  }
});

app.get("/orders/:id/history", async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "Invalid order ID" });
    }
    const history = await getOrderHistory(orderId);
    if (history.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ orderId, history });
  } catch (err) {
    next(err);
  }
});

// Translate Postgres errors into HTTP responses
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  switch (err.code) {
    case "P0001": // RAISE EXCEPTION in our functions
      return res.status(409).json({ error: err.message });
    case "P0002":
      return res.status(404).json({ error: err.message });
    case "P0003":
      return res.status(422).json({ error: err.message });
    case "23503": // foreign key violation (e.g. unknown customer)
      return res.status(404).json({ error: "Referenced record not found" });
    case "23505": // unique violation
      return res.status(409).json({ error: "Duplicate record" });
    case "23514": // check violation
      return res.status(422).json({ error: "Value not allowed" });
    case "22P02": // invalid text representation (e.g. bad integer)
      return res.status(400).json({ error: "Invalid input" });
    default:
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => console.log("Shop API on http://localhost:3000"));
