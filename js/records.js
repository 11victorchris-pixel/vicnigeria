/* ============================================================
   VicBirth Nigeria — records.js
   Dashboard logic: summary cards, search + filters, table with
   pagination, details modal, confirmed delete, CSV export and
   print-friendly summaries.
   Beginner-friendly: one small function per job. User-entered
   values are always written with textContent (never innerHTML).
   Needs js/main.js loaded first (bcnGetRecords, bcnSaveRecords,
   bcnDeleteRecordById, bcnIsToday).
   ============================================================ */

"use strict";

document.addEventListener("DOMContentLoaded", function () {
  var tableBody = document.getElementById("recordsBody");
  if (!tableBody) {
    return; // not on the dashboard page
  }

  // ---- Controls ----
  var searchInput = document.getElementById("searchInput");
  var filterState = document.getElementById("filterState");
  var filterSex = document.getElementById("filterSex");
  var filterDate = document.getElementById("filterDate");
  var clearFiltersBtn = document.getElementById("clearFilters");
  var resultCount = document.getElementById("resultCount");
  var pageInfo = document.getElementById("pageInfo");
  var prevPageBtn = document.getElementById("prevPage");
  var nextPageBtn = document.getElementById("nextPage");
  var exportBtn = document.getElementById("exportBtn");
  var resetDemoBtn = document.getElementById("resetDemo");
  var pageAlert = document.getElementById("pageAlert");

  // ---- Modals (Bootstrap's supported JS API) ----
  var detailsModal = new bootstrap.Modal(document.getElementById("detailsModal"));
  var confirmModal = new bootstrap.Modal(document.getElementById("confirmModal"));
  var detailsList = document.getElementById("detailsList");
  var confirmText = document.getElementById("confirmText");
  var confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  var printBtn = document.getElementById("printBtn");
  var printContent = document.getElementById("printContent");

  // ---- Page state (kept in two small variables) ----
  var PAGE_SIZE = 8; // rows per page; keeps large lists usable
  var currentPage = 1;
  var pendingDeleteId = null; // ID waiting for delete confirmation
  var lastViewedRecord = null; // record currently shown in the modal

  /* ---------------- small helpers ---------------- */

  // Mother's name first (required at registration), else father's.
  function guardianName(record) {
    if (record.motherName) {
      return record.motherName;
    }
    if (record.fatherName) {
      return record.fatherName;
    }
    return "—";
  }

  // "2024-03-14" -> "14 Mar 2024" (midday avoids timezone day-shifts).
  function formatDob(ymd) {
    var parts = String(ymd || "").split("-");
    if (parts.length !== 3) {
      return "—";
    }
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
    if (isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // ISO timestamp -> local short date for the table.
  function formatRegistered(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function showPageAlert(kind, message) {
    pageAlert.classList.remove("d-none", "alert-danger", "alert-warning", "alert-success", "alert-info");
    pageAlert.classList.add("alert-" + kind);
    pageAlert.textContent = message;
  }

  function hidePageAlert() {
    pageAlert.classList.add("d-none");
  }

  /* ---------------- summary cards ----------------
     Always calculated from the FULL stored list (not the filter). */
  function renderSummary(allRecords) {
    var today = 0;
    var male = 0;
    var female = 0;
    allRecords.forEach(function (item) {
      if (bcnIsToday(item.createdAt)) {
        today += 1;
      }
      if (item.sex === "Male") {
        male += 1;
      } else if (item.sex === "Female") {
        female += 1;
      }
      // "Unspecified" is counted in the total only — never forced
      // into the male or female cards.
    });
    document.getElementById("sum-total").textContent = String(allRecords.length);
    document.getElementById("sum-today").textContent = String(today);
    document.getElementById("sum-male").textContent = String(male);
    document.getElementById("sum-female").textContent = String(female);
  }

  /* ---------------- state filter options ----------------
     Rebuilt from stored records so new states appear automatically. */
  function renderStateOptions(allRecords) {
    var chosen = filterState.value;
    var seen = {};
    allRecords.forEach(function (item) {
      if (item.state) {
        seen[item.state] = true;
      }
    });
    // Keep "All states", then add each state alphabetically.
    filterState.length = 1;
    Object.keys(seen)
      .sort()
      .forEach(function (stateName) {
        var option = document.createElement("option");
        option.value = stateName;
        option.textContent = stateName;
        filterState.appendChild(option);
      });
    filterState.value = chosen; // restore selection if still present
  }

  /* ---------------- search + filters ----------------
     All filters combine: a record must pass every active one. */
  function getFilteredRecords(allRecords) {
    var query = searchInput.value.trim().toLowerCase();
    var wantState = filterState.value;
    var wantSex = filterSex.value;
    var wantDate = filterDate.value;
    var now = Date.now();

    return allRecords.filter(function (item) {
      // 1. Search: child's name OR registration ID.
      if (query) {
        var nameHit = (item.childName || "").toLowerCase().indexOf(query) !== -1;
        var idHit = (item.id || "").toLowerCase().indexOf(query) !== -1;
        if (!nameHit && !idHit) {
          return false;
        }
      }
      // 2. State filter.
      if (wantState && item.state !== wantState) {
        return false;
      }
      // 3. Sex filter.
      if (wantSex && item.sex !== wantSex) {
        return false;
      }
      // 4. Date-registered filter (uses the saved creation timestamp).
      if (wantDate) {
        var created = new Date(item.createdAt).getTime();
        if (isNaN(created)) {
          return false;
        }
        var ageDays = (now - created) / (24 * 60 * 60 * 1000);
        if (wantDate === "today" && !bcnIsToday(item.createdAt)) {
          return false;
        }
        if (wantDate === "week" && ageDays > 7) {
          return false;
        }
        if (wantDate === "month" && ageDays > 30) {
          return false;
        }
      }
      return true;
    });
  }

  /* ---------------- table + pagination ---------------- */

  // One table cell with plain text (safe against HTML injection).
  function cell(text) {
    var td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  // Small sex badge: green for Male/Female, gold for Unspecified.
  function sexBadge(sex) {
    var td = document.createElement("td");
    var pill = document.createElement("span");
    pill.className = "bcn-pill" + (sex === "Unspecified" ? " gold" : "");
    pill.textContent = sex || "—";
    td.appendChild(pill);
    return td;
  }

  function renderTable(matching) {
    // Clear old rows.
    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    var totalRecords = bcnGetRecords().length;

    // Empty states: different message when filters hide everything.
    if (matching.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 8;
      emptyCell.className = "bcn-empty";
      if (totalRecords === 0) {
        emptyCell.textContent = "No birth records yet. Register the first demonstration birth to get started.";
      } else {
        emptyCell.textContent = "No records match your search and filters. Try clearing them.";
      }
      emptyRow.appendChild(emptyCell);
      tableBody.appendChild(emptyRow);

      var linkRow = document.createElement("tr");
      var linkCell = document.createElement("td");
      linkCell.colSpan = 8;
      linkCell.className = "bcn-empty-action";
      var link = document.createElement("a");
      link.className = "btn btn-primary btn-sm";
      link.href = "register.html";
      link.textContent = "Register a Birth";
      linkCell.appendChild(link);
      linkRow.appendChild(linkCell);
      tableBody.appendChild(linkRow);
      return;
    }

    // Newest registrations first.
    var sorted = matching.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Clamp to a valid page, then slice this page's rows.
    var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageRows = sorted.slice(start, start + PAGE_SIZE);

    pageRows.forEach(function (record) {
      var row = document.createElement("tr");
      var idCell = document.createElement("td");
      var idCode = document.createElement("code");
      idCode.textContent = record.id || "—";
      idCell.appendChild(idCode);
      row.appendChild(idCell);
      row.appendChild(cell(record.childName || "—"));
      row.appendChild(cell(formatDob(record.dob)));
      row.appendChild(sexBadge(record.sex));
      row.appendChild(cell(record.state || "—"));
      row.appendChild(cell(guardianName(record)));
      row.appendChild(cell(formatRegistered(record.createdAt)));

      // Actions cell: View + Delete buttons carrying the record ID.
      var actions = document.createElement("td");
      actions.className = "bcn-actions";
      var viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "btn btn-outline-secondary btn-sm";
      viewBtn.textContent = "View";
      viewBtn.setAttribute("data-action", "view");
      viewBtn.setAttribute("data-id", record.id);
      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-soft-danger btn-sm";
      deleteBtn.textContent = "Delete";
      deleteBtn.setAttribute("data-action", "delete");
      deleteBtn.setAttribute("data-id", record.id);
      actions.appendChild(viewBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(actions);

      tableBody.appendChild(row);
    });
  }

  function renderPagination(matching) {
    var totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (matching.length === 0) {
      pageInfo.textContent = "Showing 0 records";
    } else {
      var from = (currentPage - 1) * PAGE_SIZE + 1;
      var to = Math.min(currentPage * PAGE_SIZE, matching.length);
      pageInfo.textContent = "Showing " + from + "–" + to + " of " + matching.length + " matching records";
    }
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  /* ---------------- master refresh ----------------
     Re-read storage, then update summary, table and pagination. */
  function refresh(resetPage) {
    if (resetPage) {
      currentPage = 1; // search/filter changes always restart at page 1
    }
    var all = bcnGetRecords();
    renderSummary(all);
    renderStateOptions(all);
    var matching = getFilteredRecords(all);
    var word = matching.length === 1 ? "record" : "records";
    resultCount.textContent = matching.length + " matching " + word + " (of " + all.length + " stored)";
    renderTable(matching);
    renderPagination(matching);
  }

  /* ---------------- record details modal ---------------- */

  function addDetailRow(list, term, value) {
    var wrapper = document.createElement("div");
    wrapper.className = "bcn-detail-row";
    var dt = document.createElement("dt");
    dt.textContent = term;
    var dd = document.createElement("dd");
    dd.textContent = value && String(value).trim() !== "" ? value : "—";
    wrapper.appendChild(dt);
    wrapper.appendChild(dd);
    list.appendChild(wrapper);
  }

  function findRecordById(id) {
    var found = null;
    bcnGetRecords().forEach(function (item) {
      if (item && item.id === id) {
        found = item;
      }
    });
    return found;
  }

  function showDetails(record) {
    lastViewedRecord = record;
    while (detailsList.firstChild) {
      detailsList.removeChild(detailsList.firstChild);
    }
    addDetailRow(detailsList, "Registration ID (demo)", record.id);
    addDetailRow(detailsList, "Child's full name", record.childName);
    addDetailRow(detailsList, "Date of birth", formatDob(record.dob));
    addDetailRow(detailsList, "Sex", record.sex);
    addDetailRow(detailsList, "State of birth", record.state);
    addDetailRow(detailsList, "LGA", record.lga);
    addDetailRow(detailsList, "Place of birth", record.placeOfBirth);
    addDetailRow(detailsList, "Hospital / facility", record.facilityName);
    addDetailRow(detailsList, "Father's name", record.fatherName);
    addDetailRow(detailsList, "Mother's name", record.motherName);
    addDetailRow(detailsList, "Contact number", record.contactPhone);
    addDetailRow(detailsList, "Contact email", record.contactEmail);
    addDetailRow(detailsList, "Relationship to child", record.relationship);
    document.getElementById("detailsTitle").textContent = "Record details — " + (record.childName || "record");
    detailsModal.show();
  }

  /* ---------------- delete (with confirmation) ---------------- */

  function askDelete(id) {
    var record = findRecordById(id);
    pendingDeleteId = id;
    confirmText.textContent = record
      ? 'Delete the demonstration record for "' + record.childName + '" (' + record.id + ')? This cannot be undone.'
      : "Delete this record? This cannot be undone.";
    confirmModal.show();
  }

  confirmDeleteBtn.addEventListener("click", function () {
    if (!pendingDeleteId) {
      return;
    }
    var ok = bcnDeleteRecordById(pendingDeleteId);
    pendingDeleteId = null;
    confirmModal.hide();
    if (ok) {
      showPageAlert("success", "Record deleted. The dashboard and statistics have been updated.");
    } else {
      showPageAlert("danger", "That record could not be found. Nothing was deleted.");
    }
    refresh(false);
  });

  // One listener on the table body handles every View/Delete button.
  tableBody.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    var id = button.getAttribute("data-id");
    if (button.getAttribute("data-action") === "view") {
      var record = findRecordById(id);
      if (record) {
        hidePageAlert();
        showDetails(record);
      }
    } else if (button.getAttribute("data-action") === "delete") {
      hidePageAlert();
      askDelete(id);
    }
  });

  /* ---------------- CSV export ----------------
     Exports only the currently matching (searched + filtered) rows. */

  // Escape commas, quotes and newlines the CSV way.
  function csvCell(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (text.indexOf('"') !== -1 || text.indexOf(",") !== -1 || text.indexOf("\n") !== -1) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  exportBtn.addEventListener("click", function () {
    var matching = getFilteredRecords(bcnGetRecords());
    if (matching.length === 0) {
      showPageAlert("warning", "Nothing to export — no records match the current search and filters.");
      return;
    }
    hidePageAlert();

    var headers = [
      "Registration ID",
      "Child name",
      "Date of birth",
      "Sex",
      "State",
      "LGA",
      "Place of birth",
      "Facility name",
      "Father name",
      "Mother name",
      "Contact phone",
      "Contact email",
      "Relationship",
      "Date registered"
    ];
    var lines = [headers.map(csvCell).join(",")];
    matching.forEach(function (record) {
      lines.push(
        [
          record.id,
          record.childName,
          record.dob,
          record.sex,
          record.state,
          record.lga,
          record.placeOfBirth,
          record.facilityName,
          record.fatherName,
          record.motherName,
          record.contactPhone,
          record.contactEmail,
          record.relationship,
          record.createdAt
        ]
          .map(csvCell)
          .join(",")
      );
    });

    // Real browser download via Blob + object URL (revoked afterwards).
    var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "vicbirth-records.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showPageAlert(
      "success",
      "Exported " + matching.length + " matching record(s) to vicbirth-records.csv. " +
        "Exports may contain personal data — use fictional records only."
    );
  });

  /* ---------------- print-friendly summary ---------------- */

  function addPrintRow(list, term, value) {
    var wrapper = document.createElement("div");
    wrapper.className = "bcn-print-row";
    var dt = document.createElement("dt");
    dt.textContent = term;
    var dd = document.createElement("dd");
    dd.textContent = value && String(value).trim() !== "" ? value : "—";
    wrapper.appendChild(dt);
    wrapper.appendChild(dd);
    list.appendChild(wrapper);
  }

  printBtn.addEventListener("click", function () {
    if (!lastViewedRecord) {
      return;
    }
    var record = lastViewedRecord;

    // Build the printable sheet fresh on every print (textContent only).
    while (printContent.firstChild) {
      printContent.removeChild(printContent.firstChild);
    }
    var heading = document.createElement("h1");
    heading.textContent = "VicBirth Nigeria — Online Birth Recording System";
    var sub = document.createElement("p");
    sub.className = "bcn-print-sub";
    sub.textContent = "Registration summary (academic demonstration, " + formatRegistered(record.createdAt) + ")";
    var list = document.createElement("dl");
    list.className = "bcn-print-list";
    printContent.appendChild(heading);
    printContent.appendChild(sub);
    printContent.appendChild(list);

    addPrintRow(list, "Demo registration ID", record.id);
    addPrintRow(list, "Child's full name", record.childName);
    addPrintRow(list, "Date of birth", formatDob(record.dob));
    addPrintRow(list, "Sex", record.sex);
    addPrintRow(list, "State of birth", record.state);
    addPrintRow(list, "LGA", record.lga);
    addPrintRow(list, "Place of birth", record.placeOfBirth);
    addPrintRow(list, "Hospital / facility", record.facilityName);
    addPrintRow(list, "Father's name", record.fatherName);
    addPrintRow(list, "Mother's name", record.motherName);
    addPrintRow(list, "Contact number", record.contactPhone);
    addPrintRow(list, "Contact email", record.contactEmail);
    addPrintRow(list, "Relationship to child", record.relationship);

    var note = document.createElement("p");
    note.className = "bcn-print-note";
    note.textContent =
      "VicBirth Nigeria is an independent academic demonstration project. " +
      "This printed summary is NOT an official birth certificate, and the demo registration ID " +
      "is not an official government number.";
    printContent.appendChild(note);

    detailsModal.hide(); // modals must not appear on the printed page
    window.setTimeout(function () {
      window.print();
    }, 150);
  });

  /* ---------------- toolbar events ---------------- */

  // Typing or changing any filter re-renders instantly (no reload).
  searchInput.addEventListener("input", function () {
    hidePageAlert();
    refresh(true);
  });
  filterState.addEventListener("change", function () {
    refresh(true);
  });
  filterSex.addEventListener("change", function () {
    refresh(true);
  });
  filterDate.addEventListener("change", function () {
    refresh(true);
  });

  clearFiltersBtn.addEventListener("click", function () {
    searchInput.value = "";
    filterState.value = "";
    filterSex.value = "";
    filterDate.value = "";
    hidePageAlert();
    refresh(true);
    searchInput.focus();
  });

  prevPageBtn.addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage -= 1;
      refresh(false);
    }
  });
  nextPageBtn.addEventListener("click", function () {
    currentPage += 1;
    refresh(false);
  });

  // Restore the original fictional samples (confirmed first).
  resetDemoBtn.addEventListener("click", function () {
    var sure = window.confirm(
      "Replace all current records with the original fictional sample data? Your current demo records will be removed."
    );
    if (!sure) {
      return;
    }
    try {
      window.localStorage.removeItem(BCN_STORAGE_KEY);
    } catch (error) {
      showPageAlert("danger", "Browser storage is unavailable, so sample data cannot be reset.");
      return;
    }
    bcnSeedDemoRecordsOnce();
    hidePageAlert();
    showPageAlert("success", "Sample demonstration data restored.");
    refresh(true);
  });

  // First paint.
  refresh(true);
});
