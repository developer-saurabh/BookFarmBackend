const SLOT_KEYS = ["full_day", "day_slot", "night_slot", "full_night"];

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const normalizeFeature = (input, { withDesc = false } = {}) => {
  const out = {
    isAvailable: !!(input && input.isAvailable),
    slots: {},
  };

  for (const slot of SLOT_KEYS) {
    const raw = (input?.slots?.[slot]) || {};

    const effectiveAvailable = !!raw.isAvailable && out.isAvailable;
    const slotObj = {
      isAvailable: effectiveAvailable,
      price: effectiveAvailable ? safeNum(raw.price, 0) : 0,
    };

    if (withDesc) {
      slotObj.description = effectiveAvailable ? (raw.description ?? "") : "";
    }

    out.slots[slot] = slotObj;
  }

  if (!out.isAvailable) {
    for (const s of SLOT_KEYS) {
      out.slots[s].isAvailable = false;
      out.slots[s].price = 0;
      if (withDesc) out.slots[s].description = "";
    }
  }

  return out;
};

module.exports = {
  normalizeFeature,
};
