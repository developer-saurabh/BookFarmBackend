// const SLOT_KEYS = ["full_day", "day_slot", "night_slot", "full_night"];

// const safeNum = (v, fallback = 0) => {
//   const n = Number(v);
//   return Number.isFinite(n) && n >= 0 ? n : fallback;
// };

// const normalizeFeature = (input, { withDesc = false } = {}) => {
//   const out = {
//     isAvailable: !!(input && input.isAvailable),
//     slots: {},
//   };

//   for (const slot of SLOT_KEYS) {
//     const raw = (input?.slots?.[slot]) || {};

//     const effectiveAvailable = !!raw.isAvailable && out.isAvailable;
//     const slotObj = {
//       isAvailable: effectiveAvailable,
//       price: effectiveAvailable ? safeNum(raw.price, 0) : 0,
//     };

//     if (withDesc) {
//       slotObj.description = effectiveAvailable ? (raw.description ?? "") : "";
//     }

//     out.slots[slot] = slotObj;
//   }

//   if (!out.isAvailable) {
//     for (const s of SLOT_KEYS) {
//       out.slots[s].isAvailable = false;
//       out.slots[s].price = 0;
//       if (withDesc) out.slots[s].description = "";
//     }
//   }

//   return out;
// };

// module.exports = {
//   normalizeFeature,
// };

// utils/features.js
const SLOT_KEYS = ["full_day", "day_slot", "night_slot", "full_night"];

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * normalizeFeature
 * - input: top-level feature object (maybe from client) { isAvailable, slots: { full_day: {isAvailable, price, description} } }
 * - bookingModes: global booking modes to honor (slot disabled if bookingModes[slot] === false)
 * - overrideBookingModes: if true, do NOT force-disable slots when bookingModes[slot] === false (client intent wins)
 */
function normalizeFeature(
  feature = {},
  { withDesc = false, bookingModes = {}, overrideBookingModes = false } = {}
) {
   const slots = {};
  // If bookingModes is empty, default to all known SLOT_KEYS so feature slots are preserved.
  const modeKeys = (bookingModes && Object.keys(bookingModes).length) ? Object.keys(bookingModes) : SLOT_KEYS.slice();
  let anyAvailable = feature.isAvailable || false;


  for (const mode of modeKeys) {
    // ✅ Always include the slot, not just active ones
    const src = feature.slots?.[mode] || {};
    const isActive = bookingModes[mode] || overrideBookingModes;

    slots[mode] = {
      isAvailable: src.isAvailable || false,
      price: typeof src.price === "number" ? src.price : 0,
    };

    if (withDesc) {
      slots[mode].description = src.description || "";
    }

    if (slots[mode].isAvailable) {
      anyAvailable = true;
    }

    // If the slot is inactive in bookingModes but still provided, keep it
    if (!isActive && !overrideBookingModes) {
      slots[mode].isAvailable = slots[mode].isAvailable; // don’t zero it out
    }
  }

  return {
    isAvailable: anyAvailable,
    slots,
  };
}



/**
 * Convert normalized feature to flattened shape (used by dailyPricing entries)
 */
const mapNormalizedFeatureToFlat = (normFeat = {}, bookingModes = {}) => {
  const out = {};
  for (const slot of SLOT_KEYS) {
    const slotNorm = (normFeat?.slots && normFeat.slots[slot]) || { isAvailable: false, price: 0, description: "" };
    const finalAvailable = !!slotNorm.isAvailable && (bookingModes[slot] !== false);

    out[slot] = {
      isAvailable: !!finalAvailable,
      price: safeNum(slotNorm.price, 0),
    };

    if ("description" in slotNorm) out[slot].description = finalAvailable ? (slotNorm.description || "") : "";
  }
  return out;
};

/**
 * validateDailyPricing (same as before) - respects bookingModes for daily entries
 */
const validateDailyPricing = (dailyPricing, bookingModes = {}) => {
  if (!Array.isArray(dailyPricing)) return [];

  const seenDates = new Set();
  const timeRegex =
    /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM))$|^([01]\d|2[0-3]):([0-5]\d)$/i;
  const isBlank = (v) => v === "" || v == null;

  const toMinutes = (timeStr) => {
    if (/AM|PM/i.test(timeStr)) {
      const m = timeStr.match(/(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)/i);
      if (!m) throw new Error(`Invalid time string: ${timeStr}`);
      const [, hh, mm, meridian] = m;
      let h = parseInt(hh, 10),
        mn = parseInt(mm, 10);
      if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
      if (meridian.toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + mn;
    } else {
      const parts = timeStr.split(":").map(Number);
      if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1]))
        throw new Error(`Invalid time string: ${timeStr}`);
      return parts[0] * 60 + parts[1];
    }
  };

  const buildInterval = (slot, checkIn, checkOut) => {
    if (isBlank(checkIn) && isBlank(checkOut)) return null;
    if (isBlank(checkIn) || isBlank(checkOut)) {
      throw new Error(`${slot} requires both checkIn and checkOut when one is provided.`);
    }
    if (!timeRegex.test(checkIn) || !timeRegex.test(checkOut)) {
      throw new Error(`Invalid time format for ${slot}.`);
    }

    const start = toMinutes(checkIn);
    let end = toMinutes(checkOut);
    if (["night_slot", "full_day", "full_night"].includes(slot) && end <= start) {
      end += 1440;
    } else if (end <= start) {
      throw new Error(`${slot} checkOut must be after checkIn.`);
    }

    return { slot, start, end };
  };

  const out = dailyPricing.map((entryRaw) => {
    const entry = JSON.parse(JSON.stringify(entryRaw || {}));

    if (!entry.date) throw new Error("Each dailyPricing entry must have a date.");
    const isoDate = new Date(entry.date).toISOString().split("T")[0];
    if (seenDates.has(isoDate)) throw new Error(`Duplicate pricing for ${isoDate}`);
    seenDates.add(isoDate);
    entry.date = new Date(entry.date).toISOString();

    if (!entry.timings) entry.timings = {};
    const t = entry.timings;

    for (const slot of SLOT_KEYS) {
      const slotObj = t[slot];
      if (slotObj) {
        buildInterval(slot, slotObj.checkIn, slotObj.checkOut); // will throw if invalid
      }
    }

    entry.slots = entry.slots || {};
    for (const slot of SLOT_KEYS) {
      const timing = t[slot] || {};
      entry.slots[slot] = {
        price: safeNum(timing.price, 0),
        pricePerGuest: safeNum(timing.pricePerGuest, 0),
      };

      if (bookingModes && bookingModes[slot] === false) {
        entry.slots[slot] = { price: 0, pricePerGuest: 0 };
      }
    }

    // normalize features into flattened per-slot (these calls respect bookingModes)
    const normKitchen = normalizeFeature(entry.kitchenOffered || {}, { withDesc: true, bookingModes });
    entry.kitchenOffered = mapNormalizedFeatureToFlat(normKitchen, bookingModes);
    entry.kitchenOfferedActive = !!normKitchen.isAvailable;

    const normBarb = normalizeFeature(entry.barbequeCharcoal || {}, { withDesc: false, bookingModes });
    entry.barbequeCharcoal = mapNormalizedFeatureToFlat(normBarb, bookingModes);
    entry.barbequeCharcoalActive = !!normBarb.isAvailable;

    // meals skeleton
    entry.mealsOffered = entry.mealsOffered || {};
    Object.keys(bookingModes || {}).forEach((slot) => {
      if (!entry.mealsOffered[slot]) {
        entry.mealsOffered[slot] = {
          isOffered: false,
          meals: {
            breakfast: { isAvailable: false, value: [] },
            lunch: { isAvailable: false, value: [] },
            hi_tea: { isAvailable: false, value: [] },
            dinner: { isAvailable: false, value: [] },
          },
        };
      }
      if (bookingModes && bookingModes[slot] === false) {
        entry.mealsOffered[slot].isOffered = false;
      }
    });

    entry.mealsOfferedActive = Object.values(entry.mealsOffered || {}).some((m) => !!(m && m.isOffered));

    // ensure keys exist
    for (const slot of SLOT_KEYS) {
      entry.slots[slot] = entry.slots[slot] || { price: 0, pricePerGuest: 0 };
      entry.kitchenOffered[slot] = entry.kitchenOffered[slot] || { isAvailable: false, price: 0, description: "" };
      entry.barbequeCharcoal[slot] = entry.barbequeCharcoal[slot] || { isAvailable: false, price: 0 };
    }

    return entry;
  });

  return out;
};

module.exports = {
  SLOT_KEYS,
  safeNum,
  normalizeFeature,
  mapNormalizedFeatureToFlat,
  validateDailyPricing,
};
