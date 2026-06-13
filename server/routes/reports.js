import { Router } from "express";
import db from "../db.js";
import { adminRequired } from "../middleware/auth.js";

const r = Router();

r.use(adminRequired);

// Thailand timezone (UTC+7). Apply to both sides of comparison.
const TZ = "'+7 hours'";

function dateClause(period) {
  if (period === "week")
    return `date(o.created_at, ${TZ}) >= date('now', ${TZ}, '-6 days')`;
  if (period === "month")
    return `date(o.created_at, ${TZ}) >= date('now', ${TZ}, 'start of month')`;
  if (period === "year")
    return `date(o.created_at, ${TZ}) >= date('now', ${TZ}, 'start of year')`;
  return `date(o.created_at, ${TZ}) = date('now', ${TZ})`;
}

r.get("/summary", (req, res) => {
  const period = req.query.period || "today";
  const where = dateClause(period);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS bills,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(SUM(discount), 0) AS discount,
              SUM(CASE WHEN status = 'เสร็จสิ้น' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'ยกเลิก' THEN 1 ELSE 0 END) AS cancelled,
              COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash,
              COALESCE(SUM(CASE WHEN payment_method = 'qr' THEN total ELSE 0 END), 0) AS qr,
              COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) AS card
       FROM orders o
       WHERE ${where} AND status != 'ยกเลิก' AND status != 'พักบิล'`
    )
    .get();

  // Cost (sum of ingredients consumed × cost_per_unit) for the same period
  const cost = db
    .prepare(
      `SELECT COALESCE(SUM(-sm.delta * i.cost_per_unit), 0) AS cost
       FROM stock_movements sm
       JOIN ingredients i ON i.id = sm.ingredient_id
       WHERE sm.delta < 0 AND sm.ref_order_id IN (
         SELECT id FROM orders o WHERE ${where}
       )`
    )
    .get();

  const profit = (total.revenue || 0) - (cost.cost || 0);
  const avgPerBill = total.bills > 0 ? Math.round(total.revenue / total.bills) : 0;

  // Daily / hourly series for charts (Thai timezone)
  let series = [];
  if (period === "today") {
    series = db
      .prepare(
        `SELECT CAST(strftime('%H', created_at, ${TZ}) AS INTEGER) AS bucket,
                COALESCE(SUM(total), 0) AS revenue,
                COUNT(*) AS bills
         FROM orders o
         WHERE ${where} AND status != 'ยกเลิก' AND status != 'พักบิล'
         GROUP BY bucket ORDER BY bucket`
      )
      .all();
  } else if (period === "year") {
    series = db
      .prepare(
        `SELECT strftime('%Y-%m', created_at, ${TZ}) AS bucket,
                COALESCE(SUM(total), 0) AS revenue,
                COUNT(*) AS bills
         FROM orders o
         WHERE ${where} AND status != 'ยกเลิก' AND status != 'พักบิล'
         GROUP BY bucket ORDER BY bucket`
      )
      .all();
  } else {
    series = db
      .prepare(
        `SELECT date(created_at, ${TZ}) AS bucket,
                COALESCE(SUM(total), 0) AS revenue,
                COUNT(*) AS bills
         FROM orders o
         WHERE ${where} AND status != 'ยกเลิก' AND status != 'พักบิล'
         GROUP BY bucket ORDER BY bucket`
      )
      .all();
  }

  res.json({
    period,
    summary: { ...total, cost: cost.cost || 0, profit, avgPerBill },
    series,
  });
});

r.get("/by-item", (req, res) => {
  const period = req.query.period || "today";
  const where = dateClause(period);
  const rows = db
    .prepare(
      `SELECT oi.name,
              SUM(oi.qty) AS qty,
              SUM(oi.qty * oi.price) AS revenue,
              SUM(oi.qty * COALESCE((
                  SELECT SUM(r.qty * i.cost_per_unit)
                  FROM recipes r
                  JOIN ingredients i ON i.id = r.ingredient_id
                  WHERE r.menu_item_id = oi.menu_item_id
              ), 0)) AS cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE ${where} AND o.status != 'ยกเลิก' AND o.status != 'พักบิล'
       GROUP BY oi.name, oi.menu_item_id
       ORDER BY revenue DESC LIMIT 50`
    )
    .all();
    
  // Add margin
  res.json(rows.map(r => ({
      ...r,
      margin: r.revenue - r.cost
  })));
});

r.get("/by-category", (req, res) => {
  const period = req.query.period || "today";
  const where = dateClause(period);
  const rows = db
    .prepare(
      `SELECT COALESCE(c.name, 'ไม่ระบุ') AS category,
              SUM(oi.qty) AS qty,
              SUM(oi.qty * oi.price) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE ${where} AND o.status != 'ยกเลิก' AND o.status != 'พักบิล'
       GROUP BY c.name
       ORDER BY revenue DESC`
    )
    .all();
  res.json(rows);
});

r.get("/forecast", (req, res) => {
  const data = db.prepare(`
    SELECT date(created_at, ${TZ}) AS date, SUM(total) as revenue
    FROM orders
    WHERE date(created_at, ${TZ}) >= date('now', ${TZ}, '-14 days')
      AND status != 'ยกเลิก' AND status != 'พักบิล'
    GROUP BY date ORDER BY date ASC
  `).all();

  if (data.length < 2) {
    return res.json({ historical: data, forecast: [] });
  }

  // Simple Linear Regression: y = mx + b
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  data.forEach((d, i) => {
    sumX += i;
    sumY += d.revenue;
    sumXY += i * d.revenue;
    sumXX += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  const lastDateStr = data[data.length - 1].date;
  const lastDate = new Date(lastDateStr);
  
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + i);
    const x = n - 1 + i;
    const predictedRevenue = Math.max(0, Math.round(slope * x + intercept));
    
    forecast.push({
      date: nextDate.toISOString().slice(0, 10),
      revenue: predictedRevenue
    });
  }

  res.json({ historical: data, forecast });
});

export default r;
