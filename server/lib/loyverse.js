export class UnmappedItemError extends Error {
  constructor(names) {
    super(`เมนูยังไม่ได้แมป Loyverse variant: ${names.join(", ")}`);
    this.name = "UnmappedItemError";
    this.names = names;
  }
}

export class ReceiptTotalMismatchError extends Error {
  constructor(sum, total) {
    super(`ยอดรวมรายการ (${sum}) ไม่ตรงกับยอดบิล (${total}) — มีส่วนลด/ใช้แต้ม ยังไม่รองรับใน v1`);
    this.name = "ReceiptTotalMismatchError";
  }
}

// pure: order + lineItems + config -> Loyverse POST /receipts payload
export function buildReceiptPayload(order, lineItems, config) {
  const unmapped = lineItems.filter((it) => !it.loyverse_variant_id).map((it) => it.name);
  if (unmapped.length) throw new UnmappedItemError(unmapped);

  const sum = lineItems.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  if (sum !== Number(order.total)) throw new ReceiptTotalMismatchError(sum, order.total);

  const method = order.payment_method || "cash";
  const ptId = config.paymentTypeMap[method];
  if (!ptId) throw new Error(`ยังไม่ได้ตั้งค่า payment type สำหรับ '${method}'`);

  return {
    store_id: config.storeId,
    receipt_date: new Date().toISOString(),
    note: `FoodPOS #${order.order_number}`,
    line_items: lineItems.map((it) => ({
      variant_id: it.loyverse_variant_id,
      quantity: Number(it.qty),
      price: Number(it.price),
      line_note: it.note ?? null,
    })),
    payments: [{ payment_type_id: ptId, money_amount: Number(order.total) }],
  };
}
