/* ============================================================
   VicBirth Nigeria — main.js (shared helpers)
   Plain vanilla JavaScript. Every page loads this file.
   It owns: storage key, reading/saving records, unique IDs,
   one-time fictional demo seed, and home-page statistics.
   ============================================================ */

"use strict";

/* The single localStorage key used by the whole app. */
var BCN_STORAGE_KEY = "birthconnect_records_v1";

/* ------------------------------------------------------------
   Read records from localStorage.
   Returns an array (empty if nothing stored or data is bad).
   Never crashes the page when JSON is malformed.
------------------------------------------------------------ */
function bcnGetRecords() {
  try {
    var raw = window.localStorage.getItem(BCN_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    // Malformed JSON: keep the app running, report in console only.
    console.warn("VicBirth: stored records could not be read.", error);
    return [];
  }
}

/* ------------------------------------------------------------
   Save the full record list back to localStorage.
   Returns true on success, false when storage is unavailable.
------------------------------------------------------------ */
function bcnSaveRecords(records) {
  try {
    window.localStorage.setItem(BCN_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    console.warn("VicBirth: could not save records.", error);
    return false;
  }
}

/* ------------------------------------------------------------
   Add one record while preserving existing ones.
   Returns true when the record was stored.
------------------------------------------------------------ */
function bcnAddRecord(record) {
  var records = bcnGetRecords();
  records.push(record);
  return bcnSaveRecords(records);
}

/* ------------------------------------------------------------
   Delete one record by its demo registration ID.
   Returns true when a record was removed and saved.
------------------------------------------------------------ */
function bcnDeleteRecordById(registrationId) {
  var records = bcnGetRecords();
  var kept = records.filter(function (item) {
    return item && item.id !== registrationId;
  });
  if (kept.length === records.length) {
    return false; // nothing matched
  }
  return bcnSaveRecords(kept);
}

/* ------------------------------------------------------------
   Generate a unique demo registration ID, e.g. VBN-2026-X1Y2Z3W4
   Checks existing records so IDs are never duplicated.
------------------------------------------------------------ */
function bcnGenerateId(existingRecords) {
  var year = new Date().getFullYear();
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O, 1/I
  var existingIds = {};
  (existingRecords || []).forEach(function (item) {
    if (item && item.id) {
      existingIds[item.id] = true;
    }
  });

  var candidate = "";
  do {
    var suffix = "";
    for (var i = 0; i < 8; i++) {
      var pick = Math.floor(Math.random() * alphabet.length);
      suffix += alphabet.charAt(pick);
    }
    candidate = "VBN-" + year + "-" + suffix;
  } while (existingIds[candidate]);

  return candidate;
}

/* ------------------------------------------------------------
   "Is this timestamp from today?" — compares local calendar dates.
------------------------------------------------------------ */
function bcnIsToday(isoTimestamp) {
  var date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    return false;
  }
  var now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/* ------------------------------------------------------------
   Seed a small set of FICTIONAL demo records — but only once.
   Rule: seed only when the storage key has NEVER been initialised
   (getItem returns null). Deleting records must never bring them
   back on reload, so we check for null, not for an empty array.
------------------------------------------------------------ */
function bcnSeedDemoRecordsOnce() {
  try {
    if (window.localStorage.getItem(BCN_STORAGE_KEY) !== null) {
      return; // already initialised (even if the user deleted everything)
    }
  } catch (error) {
    console.warn("VicBirth: storage unavailable, skipping seed.", error);
    return;
  }

  var now = new Date();
  var todayISO = now.toISOString();
  var yesterdayISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // All names/places below are fictional and for demonstration only.
  var demoRecords = [
    {
      id: "VBN-" + now.getFullYear() + "-LAGOS01A",
      childName: "Adaeze Oluchi Mensah (demo)",
      dob: "2024-03-14",
      sex: "Female",
      state: "Lagos",
      lga: "Ikeja",
      placeOfBirth: "Hospital",
      facilityName: "Demo General Hospital, Ikeja",
      fatherName: "Kwame Mensah (demo)",
      motherName: "Ngozi Mensah (demo)",
      contactPhone: "0803 000 0001",
      contactEmail: "",
      relationship: "Parent",
      createdAt: todayISO
    },
    {
      id: "VBN-" + now.getFullYear() + "-KANO02B",
      childName: "Musa Ibrahim Bello (demo)",
      dob: "2023-11-02",
      sex: "Male",
      state: "Kano",
      lga: "Nassarawa",
      placeOfBirth: "Clinic",
      facilityName: "Demo Primary Health Centre",
      fatherName: "Ibrahim Bello (demo)",
      motherName: "Aisha Bello (demo)",
      contactPhone: "0803 000 0002",
      contactEmail: "",
      relationship: "Parent",
      createdAt: todayISO
    },
    {
      id: "VBN-" + now.getFullYear() + "-FCT03C",
      childName: "Chiamaka Nwosu (demo)",
      dob: "2025-06-21",
      sex: "Female",
      state: "FCT - Abuja",
      lga: "Gwagwalada",
      placeOfBirth: "Hospital",
      facilityName: "Demo Specialist Hospital",
      fatherName: "",
      motherName: "Funke Nwosu (demo)",
      contactPhone: "0803 000 0003",
      contactEmail: "demo-parent@example.com",
      relationship: "Parent",
      createdAt: yesterdayISO
    },
    {
      id: "VBN-" + now.getFullYear() + "-RIV04D",
      childName: "Tamuno Briggs (demo)",
      dob: "2022-08-09",
      sex: "Male",
      state: "Rivers",
      lga: "Port Harcourt",
      placeOfBirth: "Other",
      facilityName: "",
      fatherName: "Ebikefe Briggs (demo)",
      motherName: "Ibiso Briggs (demo)",
      contactPhone: "0803 000 0004",
      contactEmail: "",
      relationship: "Guardian",
      createdAt: yesterdayISO
    },
    {
      id: "VBN-" + now.getFullYear() + "-ENU05E",
      childName: "Olumide Adeyemi (demo)",
      dob: "2024-12-01",
      sex: "Male",
      state: "Enugu",
      lga: "Enugu North",
      placeOfBirth: "Hospital",
      facilityName: "Demo Maternity Hospital",
      fatherName: "Tunde Adeyemi (demo)",
      motherName: "Bisi Adeyemi (demo)",
      contactPhone: "0803 000 0005",
      contactEmail: "",
      relationship: "Parent",
      createdAt: yesterdayISO
    }
  ];

  bcnSaveRecords(demoRecords);
}

/* ------------------------------------------------------------
   Home-page statistics: calculated live from stored records.
   Fills the elements with IDs stat-total, stat-today,
   stat-male, stat-female, stat-states (if present on the page).
------------------------------------------------------------ */
function bcnRenderHomeStats() {
  var totalEl = document.getElementById("stat-total");
  if (!totalEl) {
    return; // not on the home page
  }

  var records = bcnGetRecords();
  var todayCount = 0;
  var maleCount = 0;
  var femaleCount = 0;
  var states = {};

  records.forEach(function (item) {
    if (bcnIsToday(item.createdAt)) {
      todayCount += 1;
    }
    if (item.sex === "Male") {
      maleCount += 1;
    } else if (item.sex === "Female") {
      femaleCount += 1;
    }
    if (item.state) {
      states[item.state] = true;
    }
  });

  // Small helper: write a number safely as text (no HTML injection).
  function setNumber(elementId, value) {
    var el = document.getElementById(elementId);
    if (el) {
      el.textContent = String(value);
    }
  }

  setNumber("stat-total", records.length);
  setNumber("stat-today", todayCount);
  setNumber("stat-male", maleCount);
  setNumber("stat-female", femaleCount);
  setNumber("stat-states", Object.keys(states).length);
}

/* ------------------------------------------------------------
   Run on every page: seed once, then render home stats if needed.
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  bcnSeedDemoRecordsOnce();
  bcnRenderHomeStats();
});
