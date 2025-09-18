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

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const DEFAULT_OPTIONS = {
  maxFiles: 50, // safety cap
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB default per file
  allowedMimeTypes: null, // array of allowed mime strings or null for any
  throwOnInvalid: false, // if true, throws on first invalid file; else returns only valid ones
};

/* --- Helpers --- */

const isDataUrl = (str) => typeof str === 'string' && /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.test(str);

const parseDataUrl = (dataUrl) => {
  // returns { buffer, mimetype }
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mimetype = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, mimetype };
};

const looksLikeUrl = (str) => typeof str === 'string' && /^(https?:)?\/\//i.test(str);

const sanitizeFilename = (name = '') => {
  // remove suspicious chars, force safe name
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || `file_${Date.now()}`;
};

const ensureArray = (val) => (Array.isArray(val) ? val : val == null ? [] : [val]);

const buildFilenameFrom = (obj, fallbackExt = '') => {
  if (obj.originalname) return sanitizeFilename(obj.originalname);
  if (obj.name) return sanitizeFilename(obj.name);
  if (obj.mimetype) return sanitizeFilename(`file.${obj.mimetype.split('/')[1] || 'bin'}`);
  return sanitizeFilename(`file${fallbackExt}`);
};

/* --- Normalizer function --- */

function normalizeFiles(input, options = {}) {
  const cfg = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const out = [];

  if (!input) return out;

  // if input is an object like req.files (fieldname -> file or files)
  // Accept objects that look like multer's req.files where keys are arrays/single
  if (typeof input === 'object' && !Buffer.isBuffer(input) && !Array.isArray(input) && !isDataUrl(input) && !looksLikeUrl(input) && (input.fieldname || input.size || input.name || input.path || input.tempFilePath || input.data)) {
    // Single file-like object
    input = [input];
  }

  // If input is an object mapping fields -> array of files
  if (typeof input === 'object' && !Array.isArray(input) && !Buffer.isBuffer(input) && !isDataUrl(input) && !looksLikeUrl(input)) {
    // maybe it's { field1: [..], field2: {...} } — flatten values
    const vals = Object.values(input);
    if (vals.length && (Array.isArray(vals[0]) || vals[0] && typeof vals[0] === 'object' && ('buffer' in vals[0] || 'data' in vals[0] || 'tempFilePath' in vals[0] || 'path' in vals[0] || 'name' in vals[0]))) {
      input = vals.flat();
    }
  }

  // Ensure an array
  const candidates = ensureArray(input).flat();

  for (const cand of candidates) {
    try {
      // Skip null/undefined/empty
      if (cand == null || cand === '') continue;

      // 1) If it's already a Buffer
      if (Buffer.isBuffer(cand)) {
        if (cand.length === 0) continue;
        const filename = `file_${Date.now()}`;
        if (cand.length > cfg.maxSizeBytes) {
          if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
          continue;
        }
        out.push({
          kind: 'buffer',
          filename,
          mimetype: null,
          size: cand.length,
          buffer: cand,
        });
        continue;
      }

      // 2) data URL (base64)
      if (typeof cand === 'string' && isDataUrl(cand)) {
        const parsed = parseDataUrl(cand);
        if (!parsed) {
          if (cfg.throwOnInvalid) throw new Error('Invalid data URL');
          continue;
        }
        if (cfg.allowedMimeTypes && !cfg.allowedMimeTypes.includes(parsed.mimetype)) {
          if (cfg.throwOnInvalid) throw new Error(`Disallowed mimetype: ${parsed.mimetype}`);
          continue;
        }
        if (parsed.buffer.length > cfg.maxSizeBytes) {
          if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
          continue;
        }
        out.push({
          kind: 'buffer',
          filename: `upload_${Date.now()}.${(parsed.mimetype.split('/')[1] || 'bin')}`,
          mimetype: parsed.mimetype,
          size: parsed.buffer.length,
          buffer: parsed.buffer,
        });
        continue;
      }

      // 3) plain URL string (we do not fetch it; return as URL descriptor)
      if (typeof cand === 'string' && looksLikeUrl(cand)) {
        out.push({
          kind: 'url',
          url: cand,
          filename: sanitizeFilename(path.basename(new URL(cand, 'http://example.com').pathname) || `remote_${Date.now()}`),
        });
        continue;
      }

      // 4) string that's not data-url: maybe a local path
      if (typeof cand === 'string') {
        // treat as path if exists on disk
        if (fs.existsSync(cand)) {
          const stat = fs.statSync(cand);
          const stream = fs.createReadStream(cand);
          const filename = path.basename(cand);
          if (stat.size > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          out.push({
            kind: 'stream',
            filename: sanitizeFilename(filename),
            mimetype: null,
            size: stat.size,
            stream,
            path: cand,
          });
          continue;
        } else {
          // fallback: unknown string — skip or add as fake url
          // (we already handled looksLikeUrl above)
          if (cfg.throwOnInvalid) throw new Error('Unsupported string input for file');
          continue;
        }
      }

      // 5) If object looks like multer file (has buffer or path or stream info)
      if (typeof cand === 'object') {
        // common fields: fieldname, originalname, mimetype, buffer, size, path, tempFilePath (express-fileupload)
        const fieldname = cand.fieldname || cand.field || undefined;
        const filename = buildFilenameFrom(cand);
        const mimetype = cand.mimetype || cand.type || null;
        const size = cand.size || (cand.buffer ? cand.buffer.length : undefined);

        if (cand.buffer) {
          // multer when configured with storage: memoryStorage()
          if (size && size > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          if (cfg.allowedMimeTypes && mimetype && !cfg.allowedMimeTypes.includes(mimetype)) {
            if (cfg.throwOnInvalid) throw new Error(`Disallowed mimetype: ${mimetype}`);
            continue;
          }
          out.push({
            kind: 'buffer',
            filename: sanitizeFilename(filename),
            fieldname,
            mimetype,
            size,
            buffer: cand.buffer,
          });
          continue;
        }

        if (cand.data && Buffer.isBuffer(cand.data)) {
          // express-fileupload might set file.data
          const buf = cand.data;
          if (buf.length > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          out.push({
            kind: 'buffer',
            filename: sanitizeFilename(filename),
            fieldname,
            mimetype,
            size: buf.length,
            buffer: buf,
          });
          continue;
        }

        // If object has a tempFilePath (express-fileupload with useTempFiles)
        if (cand.tempFilePath && fs.existsSync(cand.tempFilePath)) {
          const stat = fs.statSync(cand.tempFilePath);
          if (stat.size > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          out.push({
            kind: 'stream',
            filename: sanitizeFilename(filename),
            fieldname,
            mimetype,
            size: stat.size,
            stream: fs.createReadStream(cand.tempFilePath),
            path: cand.tempFilePath,
          });
          continue;
        }

        // If object has a path (disk storage)
        if (cand.path && fs.existsSync(cand.path)) {
          const stat = fs.statSync(cand.path);
          if (stat.size > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          out.push({
            kind: 'stream',
            filename: sanitizeFilename(filename),
            fieldname,
            mimetype,
            size: stat.size,
            stream: fs.createReadStream(cand.path),
            path: cand.path,
          });
          continue;
        }

        // If object has base64 string under .base64 or .data (string)
        if (typeof cand.base64 === 'string' && isDataUrl(cand.base64)) {
          const parsed = parseDataUrl(cand.base64);
          if (!parsed) {
            if (cfg.throwOnInvalid) throw new Error('Invalid data URL in object.base64');
            continue;
          }
          if (parsed.buffer.length > cfg.maxSizeBytes) {
            if (cfg.throwOnInvalid) throw new Error('File exceeds max allowed size');
            continue;
          }
          out.push({
            kind: 'buffer',
            filename: sanitizeFilename(filename),
            fieldname,
            mimetype: parsed.mimetype,
            size: parsed.buffer.length,
            buffer: parsed.buffer,
          });
          continue;
        }

        // If object has url property -> treat as remote URL descriptor
        if (cand.url && looksLikeUrl(cand.url)) {
          out.push({
            kind: 'url',
            url: cand.url,
            filename: sanitizeFilename(path.basename(new URL(cand.url, 'http://example.com').pathname) || filename),
            fieldname,
          });
          continue;
        }

        // Unknown object shape -> skip or throw
        if (cfg.throwOnInvalid) throw new Error('Unsupported file object shape');
        continue;
      }

      // If we reached here: unsupported input type
      if (cfg.throwOnInvalid) throw new Error('Unsupported file input type');
    } catch (err) {
      if (cfg.throwOnInvalid) throw err;
      // otherwise ignore invalid candidate and continue
      continue;
    }

    // stop early if we reached maxFiles
    if (out.length >= cfg.maxFiles) break;
  }

  // Final safety truncate to maxFiles
  return out.slice(0, cfg.maxFiles);
}

function chunkArray(arr, size = 20) {
  if (!Array.isArray(arr)) return [];
  if (typeof size !== 'number' || size <= 0) throw new TypeError('size must be a positive number');
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

module.exports = {
  SLOT_KEYS,normalizeFiles,  MAX_BATCH_SIZE: 50,
  safeNum,chunkArray,
  normalizeFeature,
  mapNormalizedFeatureToFlat,
  validateDailyPricing,
};
