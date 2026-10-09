/* ============================================================
   VicBirth Nigeria — register.js
   Registration form logic: inline validation, submission,
   demo ID generation, localStorage saving, success panel.
   Beginner-friendly: one small function per job.
   Needs js/main.js loaded first (bcnGetRecords, bcnAddRecord,
   bcnGenerateId).
   ============================================================ */

"use strict";

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("birthForm");
  if (!form) {
    return; // not on the registration page
  }

  // Grab every field and control once.
  var fields = {
    childName: document.getElementById("childName"),
    dob: document.getElementById("dob"),
    sex: document.getElementById("sex"),
    state: document.getElementById("state"),
    lga: document.getElementById("lga"),
    placeOfBirth: document.getElementById("placeOfBirth"),
    facilityName: document.getElementById("facilityName"),
    fatherName: document.getElementById("fatherName"),
    motherName: document.getElementById("motherName"),
    contactPhone: document.getElementById("contactPhone"),
    contactEmail: document.getElementById("contactEmail"),
    relationship: document.getElementById("relationship")
  };
  var submitBtn = document.getElementById("submitBtn");
  var clearBtn = document.getElementById("clearBtn");
  var formAlert = document.getElementById("formAlert");
  var successPanel = document.getElementById("successPanel");
  var successId = document.getElementById("successId");
  var successTime = document.getElementById("successTime");
  var anotherBtn = document.getElementById("anotherBtn");

  // Guard against double-click duplicate submissions.
  var isSubmitting = false;

  // The date input must never offer a future date (native help).
  fields.dob.max = toISODate(new Date());

  /* ---------------- small helpers ---------------- */

  // "2026-10-09" style date for the max attribute (local date).
  function toISODate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  // Show an inline error under one field (Bootstrap styling).
  function showError(input, message) {
    input.classList.remove("is-valid");
    input.classList.add("is-invalid");
    var feedback = document.getElementById(input.id + "-error");
    if (feedback && message) {
      feedback.textContent = message;
    }
  }

  // Mark one field as valid and hide its error.
  function showValid(input) {
    input.classList.remove("is-invalid");
    input.classList.add("is-valid");
  }

  // Clear any validation state for one field.
  function clearState(input) {
    input.classList.remove("is-invalid");
    input.classList.remove("is-valid");
  }

  // Page-level message box (for save failures / summaries).
  function showAlert(kind, message) {
    formAlert.classList.remove("d-none", "alert-danger", "alert-success", "alert-info");
    formAlert.classList.add("alert-" + kind);
    formAlert.textContent = message;
  }

  function hideAlert() {
    formAlert.classList.add("d-none");
  }

  /* ---------------- single-field validators ----------------
     Each returns true when valid (and paints the field). */

  function validName(value, minLength) {
    var text = value.trim();
    // Letters, spaces, hyphens, apostrophes — at least minLength letters.
    var letters = text.replace(/[^A-Za-zÀ-ÿ'’\- ]/g, "");
    return text.length >= minLength && letters.length >= minLength;
  }

  function validateChildName() {
    if (validName(fields.childName.value, 3)) {
      showValid(fields.childName);
      return true;
    }
    showError(fields.childName, "Enter the child\u2019s full name (at least 3 letters).");
    return false;
  }

  function validateDob() {
    var raw = fields.dob.value; // "YYYY-MM-DD" from <input type="date">
    if (!raw) {
      showError(fields.dob, "Choose the date of birth.");
      return false;
    }
    var parts = raw.split("-");
    if (parts.length !== 3) {
      showError(fields.dob, "Enter a valid date of birth (not in the future).");
      return false;
    }
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);
    // Reject impossible dates: 2024-02-30 would roll over to March.
    var realDate =
      !isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    if (!realDate || year < 1900) {
      showError(fields.dob, "That date does not exist. Check day, month and year.");
      return false;
    }
    // Strip time: a birth date of "today" is fine, "tomorrow" is not.
    var dobDay = new Date(year, month - 1, day);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dobDay.getTime() > today.getTime()) {
      showError(fields.dob, "Date of birth cannot be in the future.");
      return false;
    }
    showValid(fields.dob);
    return true;
  }

  function validateRequiredSelect(input, message) {
    if (input.value) {
      showValid(input);
      return true;
    }
    showError(input, message);
    return false;
  }

  function validateLga() {
    if (fields.lga.value.trim().length >= 2) {
      showValid(fields.lga);
      return true;
    }
    showError(fields.lga, "Enter the LGA (at least 2 characters).");
    return false;
  }

  function validateFacility() {
    // Optional — but if the birth was in a hospital/clinic, ask for it.
    var place = fields.placeOfBirth.value;
    var name = fields.facilityName.value.trim();
    if ((place === "Hospital" || place === "Clinic") && name !== "" && name.length < 3) {
      showError(fields.facilityName, "Enter the facility name (at least 3 characters), or leave it blank.");
      return false;
    }
    clearState(fields.facilityName);
    if (name.length >= 3) {
      showValid(fields.facilityName);
    }
    return true;
  }

  function validateFatherName() {
    // Optional: blank is fine; a too-short entry is not.
    var name = fields.fatherName.value.trim();
    if (name === "") {
      clearState(fields.fatherName);
      return true;
    }
    if (validName(name, 3)) {
      showValid(fields.fatherName);
      return true;
    }
    showError(fields.fatherName, "If given, use at least 3 characters.");
    return false;
  }

  function validateMotherName() {
    if (validName(fields.motherName.value, 3)) {
      showValid(fields.motherName);
      return true;
    }
    showError(fields.motherName, "Enter the mother\u2019s full name (at least 3 letters).");
    return false;
  }

  function validatePhone() {
    var raw = fields.contactPhone.value.trim();
    // Sensible, not strict: allow +, spaces, dashes, brackets;
    // count the digits (Nigerian numbers vary, so accept 7–15).
    var digits = raw.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      showValid(fields.contactPhone);
      return true;
    }
    showError(fields.contactPhone, "Enter a valid phone number (7\u201315 digits).");
    return false;
  }

  function validateEmail() {
    // Optional: blank passes; otherwise a simple sensible check.
    var raw = fields.contactEmail.value.trim();
    if (raw === "") {
      clearState(fields.contactEmail);
      return true;
    }
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw);
    if (ok && raw.length <= 120) {
      showValid(fields.contactEmail);
      return true;
    }
    showError(fields.contactEmail, "Enter a valid email address, or leave it blank.");
    return false;
  }

  // Run every check; returns true only when the whole form is valid.
  function validateWholeForm() {
    var checks = [
      validateChildName(),
      validateDob(),
      validateRequiredSelect(fields.sex, "Choose the recorded sex."),
      validateRequiredSelect(fields.state, "Choose the state of birth."),
      validateLga(),
      validateRequiredSelect(fields.placeOfBirth, "Choose where the birth took place."),
      validateFacility(),
      validateFatherName(),
      validateMotherName(),
      validatePhone(),
      validateEmail(),
      validateRequiredSelect(fields.relationship, "Choose who is completing this form.")
    ];
    return checks.every(function (passed) {
      return passed === true;
    });
  }

  /* ---------------- live feedback while typing ---------------- */

  Object.keys(fields).forEach(function (key) {
    var input = fields[key];
    // Re-validate gently on each change (only if already touched).
    input.addEventListener("input", function () {
      if (input.classList.contains("is-invalid")) {
        validateWholeFormLight(key);
      }
      hideAlert();
    });
    input.addEventListener("change", function () {
      if (input.classList.contains("is-invalid") || input.classList.contains("is-valid")) {
        validateWholeFormLight(key);
      }
    });
  });

  // Validate just one field (used for live feedback).
  function validateWholeFormLight(key) {
    if (key === "childName") {
      validateChildName();
    } else if (key === "dob") {
      validateDob();
    } else if (key === "sex") {
      validateRequiredSelect(fields.sex, "Choose the recorded sex.");
    } else if (key === "state") {
      validateRequiredSelect(fields.state, "Choose the state of birth.");
    } else if (key === "lga") {
      validateLga();
    } else if (key === "placeOfBirth") {
      validateRequiredSelect(fields.placeOfBirth, "Choose where the birth took place.");
    } else if (key === "facilityName") {
      validateFacility();
    } else if (key === "fatherName") {
      validateFatherName();
    } else if (key === "motherName") {
      validateMotherName();
    } else if (key === "contactPhone") {
      validatePhone();
    } else if (key === "contactEmail") {
      validateEmail();
    } else if (key === "relationship") {
      validateRequiredSelect(fields.relationship, "Choose who is completing this form.");
    }
  }

  /* ---------------- buttons ---------------- */

  clearBtn.addEventListener("click", function () {
    form.reset();
    Object.keys(fields).forEach(function (key) {
      clearState(fields[key]);
    });
    hideAlert();
    fields.childName.focus();
  });

  if (anotherBtn) {
    anotherBtn.addEventListener("click", function () {
      successPanel.classList.add("d-none");
      form.classList.remove("d-none");
      form.reset();
      Object.keys(fields).forEach(function (key) {
        clearState(fields[key]);
      });
      hideAlert();
      window.scrollTo(0, 0);
      fields.childName.focus();
    });
  }

  /* ---------------- submit ---------------- */

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // we validate and save with JavaScript

    // Block a second click while this submission is being handled.
    if (isSubmitting) {
      return;
    }

    var formIsValid = validateWholeForm();
    if (!formIsValid) {
      showAlert("danger", "Please fix the highlighted fields before saving.");
      var firstError = form.querySelector(".is-invalid");
      if (firstError) {
        firstError.focus();
      }
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Saving\u2026"; // honest local state, not a fake network call

    // Build the record with consistent field names (matches main.js).
    var existing = bcnGetRecords();
    var record = {
      id: bcnGenerateId(existing),
      childName: fields.childName.value.trim(),
      dob: fields.dob.value,
      sex: fields.sex.value,
      state: fields.state.value,
      lga: fields.lga.value.trim(),
      placeOfBirth: fields.placeOfBirth.value,
      facilityName: fields.facilityName.value.trim(),
      fatherName: fields.fatherName.value.trim(),
      motherName: fields.motherName.value.trim(),
      contactPhone: fields.contactPhone.value.trim(),
      contactEmail: fields.contactEmail.value.trim(),
      relationship: fields.relationship.value,
      createdAt: new Date().toISOString()
    };

    // Save (appends; never overwrites previous records).
    var saved = bcnAddRecord(record);

    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (!saved) {
      // Storage full or unavailable: say so honestly, keep the form data.
      showAlert(
        "danger",
        "Could not save this record (browser storage unavailable or full). " +
          "Nothing was saved \u2014 please try again or free up space. Your entries are still in the form."
      );
      return;
    }

    // Success: reset the form only AFTER storage confirmed, then celebrate.
    form.reset();
    Object.keys(fields).forEach(function (key) {
      clearState(fields[key]);
    });
    hideAlert();
    form.classList.add("d-none");
    successId.textContent = record.id;
    successTime.textContent =
      "Saved on " + new Date(record.createdAt).toLocaleString() + " \u00B7 demo ID, not an official certificate number.";
    successPanel.classList.remove("d-none");
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
