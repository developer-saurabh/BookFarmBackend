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
const mongoose = require("mongoose");

const SLOT_KEYS = ["full_day", "day_slot", "night_slot", "full_night"];

const safeNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const normalizeFeature = (input, { withDesc = false, bookingModes = {} } = {}) => {
  const out = {
    isAvailable: !!(input && input.isAvailable),
    slots: {},
  };

  for (const slot of SLOT_KEYS) {
    const raw = (input?.slots?.[slot]) || {};

    // effectiveAvailable depends on both the slot and the top-level availability
    const effectiveAvailable = !!raw.isAvailable && out.isAvailable && (bookingModes[slot] !== false);
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

/**
 * Convert normalized feature ({ isAvailable, slots: { full_day: {isAvailable, price, description} } })
 * into flattened per-slot object: { full_day: { isAvailable, price, description }, ... }
 * This shape is how dailyPricing expects kitchenOffered / barbequeCharcoal in your DB/response.
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

    // include description when present (keep empty string if not available)
    if ("description" in slotNorm) out[slot].description = finalAvailable ? (slotNorm.description || "") : "";
  }
  return out;
};

/**
 * Validate and normalize dailyPricing array.
 * - fills entry.slots from entry.timings (price & pricePerGuest)
 * - maps kitchenOffered / barbequeCharcoal -> flattened per-slot shape
 * - sets kitchenOfferedActive / barbequeCharcoalActive / mealsOfferedActive
 * - honors bookingModes to disable slots
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
    // allow overnight for night_slot and full_day/full_night as per your previous logic
    if (["night_slot", "full_day", "full_night"].includes(slot) && end <= start) {
      end += 1440;
    } else if (end <= start) {
      throw new Error(`${slot} checkOut must be after checkIn.`);
    }

    return { slot, start, end };
  };

  const out = dailyPricing.map((entryRaw) => {
    // clone to avoid mutating original object references unexpectedly
    const entry = JSON.parse(JSON.stringify(entryRaw || {}));

    // date normalization + uniqueness
    if (!entry.date) throw new Error("Each dailyPricing entry must have a date.");
    const isoDate = new Date(entry.date).toISOString().split("T")[0];
    if (seenDates.has(isoDate)) throw new Error(`Duplicate pricing for ${isoDate}`);
    seenDates.add(isoDate);
    entry.date = new Date(entry.date).toISOString();

    // ensure timings object exists
    if (!entry.timings) entry.timings = {};
    const t = entry.timings;

    // validate timings (build intervals if needed)
    const intervals = [];
    for (const slot of SLOT_KEYS) {
      const slotObj = t[slot];
      if (slotObj) {
        const iv = buildInterval(slot, slotObj.checkIn, slotObj.checkOut);
        if (iv) intervals.push(iv);
      }
    }

    // --- build entry.slots from timings prices (price & pricePerGuest) ---
    entry.slots = entry.slots || {};
    for (const slot of SLOT_KEYS) {
      const timing = t[slot] || {};
      entry.slots[slot] = {
        price: safeNum(timing.price, 0),
        pricePerGuest: safeNum(timing.pricePerGuest, 0),
      };

      // If booking mode disabled globally, zero out
      if (bookingModes && bookingModes[slot] === false) {
        entry.slots[slot] = { price: 0, pricePerGuest: 0 };
      }
    }

    // --- normalize kitchenOffered & barbequeCharcoal into flattened per-slot shape ---
    const normKitchen = normalizeFeature(entry.kitchenOffered || {}, { withDesc: true, bookingModes });
    entry.kitchenOffered = mapNormalizedFeatureToFlat(normKitchen, bookingModes);
    entry.kitchenOfferedActive = !!normKitchen.isAvailable;

    const normBarb = normalizeFeature(entry.barbequeCharcoal || {}, { withDesc: false, bookingModes });
    entry.barbequeCharcoal = mapNormalizedFeatureToFlat(normBarb, bookingModes);
    entry.barbequeCharcoalActive = !!normBarb.isAvailable;

    // ensure mealsOffered skeleton for enabled bookingModes
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
      // if booking mode disabled, force isOffered false
      if (bookingModes && bookingModes[slot] === false) {
        entry.mealsOffered[slot].isOffered = false;
      }
    });

    entry.mealsOfferedActive = Object.values(entry.mealsOffered || {}).some((m) => !!(m && m.isOffered));

    // final safety: ensure keys exist for response shape expected
    // ensure slots exist
    for (const slot of SLOT_KEYS) {
      entry.slots[slot] = entry.slots[slot] || { price: 0, pricePerGuest: 0 };
      entry.kitchenOffered[slot] = entry.kitchenOffered[slot] || { isAvailable: false, price: 0, description: "" };
      entry.barbequeCharcoal[slot] = entry.barbequeCharcoal[slot] || { isAvailable: false, price: 0 };
    }

    return entry;
  });

  return out;
};
const MAX_BATCH_SIZE = 5; // batch 5 images at a time

const normalizeFiles = (files) =>
  !files ? [] : Array.isArray(files) ? files : [files];
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
};
module.exports = {
  SLOT_KEYS,chunkArray,
  safeNum,MAX_BATCH_SIZE,
  normalizeFeature,
  mapNormalizedFeatureToFlat,
  validateDailyPricing,
};
