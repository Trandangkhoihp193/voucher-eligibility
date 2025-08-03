// api/vouchers.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed, use POST' });
  }

  // CORS để có thể gọi từ frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse body JSON
  let body;
  try {
    body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const cart = body.cart;
  if (!cart || !Array.isArray(cart.items)) {
    return res.status(400).json({ error: 'Missing or malformed cart in request body' });
  }

  // Định nghĩa voucher (có thể mở rộng / thay bằng load động sau)
  const vouchers = [
    {
      id: 'duopremium_50',
      code: 'DUOPREMIUM50',
      title: '$50 OFF DUOPREMIUM',
      description: "Áp dụng nếu giỏ hàng có ít nhất 2 món và có ít nhất một món được gán nhãn size 'M'.",
      discount_type: 'fixed_amount',
      value: 50,
      conditions: {
        min_total_items: 2,
        required_size_labels: ['M']
      },
      exclusive: true,
      active: true
    },
    {
      id: 'super2xl_100',
      code: 'SUPER2XL100',
      title: '$100 OFF SUPER2XL',
      description: "Áp dụng nếu giỏ hàng có ít nhất 2 món và có ít nhất một món có nhãn size 'XL'.",
      discount_type: 'fixed_amount',
      value: 100,
      conditions: {
        min_total_items: 2,
        required_size_labels: ['XL']
      },
      exclusive: true,
      active: true
    }
  ];

  // Helper: lấy size_label từ item
  function getSizeLabelFromItem(item) {
    if (Array.isArray(item.options)) {
      for (const opt of item.options) {
        const match = opt.match(/^Size Label:\s*(.+)$/i);
        if (match) {
          return match[1].trim();
        }
      }
    }
    if (typeof item.variant_title === 'string') {
      const match = item.variant_title.match(/\b(M|L|XL)\b/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  function cartIsEligibleForVoucher(cart, voucher) {
    const totalItems = cart.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    if (voucher.conditions.min_total_items && totalItems < voucher.conditions.min_total_items) {
      return false;
    }

    if (voucher.conditions.required_size_labels) {
      const requiredLabels = voucher.conditions.required_size_labels;
      const hasMatching = cart.items.some(item => {
        const label = getSizeLabelFromItem(item);
        return label && requiredLabels.includes(label);
      });
      if (!hasMatching) return false;
    }

    return true;
  }

  const applicable = [];
  const originalTotal = typeof cart.original_total === 'number' ? cart.original_total : (cart.original_total || 0);

  vouchers.forEach(voucher => {
    if (!voucher.active) return;
    if (cartIsEligibleForVoucher(cart, voucher)) {
      const discountAmount = voucher.value;
      const discountedTotal = Math.max(0, originalTotal - discountAmount);
      applicable.push({
        id: voucher.id,
        code: voucher.code,
        title: voucher.title,
        description: voucher.description,
        discount_display: `$${discountAmount} off`,
        discounted_total: discountedTotal,
        saved_amount: discountAmount,
        is_selected: false
      });
    }
  });

  res.status(200).json({
    applicable_vouchers: applicable,
    cart_total: originalTotal
  });
}
