const DATA_BASE_URL = new URL("./data/", window.location.href);
const DATA_SOURCES = [
  { url: new URL("log-summary.json", DATA_BASE_URL), sample: false },
  { url: new URL("log-summary.sample.json", DATA_BASE_URL), sample: true },
];

let selectedReport = null;
let currentData = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchSummary() {
  const cacheBuster = "?_=" + Date.now();

  for (const source of DATA_SOURCES) {
    try {
      const response = await fetch(source.url.href + cacheBuster);
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      return { data, sample: source.sample };
    } catch (error) {
      continue;
    }
  }

  throw new Error("Could not load live or sample data.");
}

function setNotice(message, isVisible) {
  const notice = document.querySelector("#dataNotice");
  notice.textContent = message;
  notice.classList.toggle("is-visible", isVisible);
}

async function load() {
  try {
    const { data, sample } = await fetchSummary();

    document.querySelector("#meta").textContent =
      `Generated: ${data.generated_at} | Total parsed: ${data.total}`;
    renderSummaryCards(data);
    currentData = data;

    if (sample) {
      setNotice("Live data is unavailable. Showing sample demo data instead.", true);
    } else {
      setNotice("", false);
    }

    renderCategoryChart(data);
    renderTimelineChart(data);
    renderTables(data);
    syncSelectedReport(data);
  } catch (error) {
    document.querySelector("#meta").textContent = "Could not load dashboard data.";
    renderSummaryCards({ total: 0, by_status: {}, by_category: {} });
    currentData = null;
    selectedReport = null;
    renderEmptyDetailReport();
    setNotice("Neither live data nor sample data could be loaded.", true);
  }
}

function syncSelectedReport(data) {
  if (!selectedReport) {
    renderEmptyDetailReport();
    return;
  }

  if (selectedReport.type === "ip") {
    const ipReports = data.ip_reports || {};
    if (ipReports[selectedReport.key]) {
      renderIpReport(selectedReport.key, ipReports[selectedReport.key]);
      return;
    }
  }

  if (selectedReport.type === "host") {
    const hostReports = data.host_reports || {};
    if (hostReports[selectedReport.key]) {
      renderHostReport(selectedReport.key, hostReports[selectedReport.key]);
      return;
    }
  }

  selectedReport = null;
  renderEmptyDetailReport();
}

function renderSummaryCards(data) {
  const total = Number(data.total || 0);
  const statuses = Object.entries(data.by_status || {}).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  );
  const categories = Object.keys(data.by_category || {});

  document.querySelector("#totalRequests").textContent = total;
  document.querySelector("#topStatus").textContent = statuses.length
    ? `${statuses[0][0]} (${statuses[0][1]})`
    : "-";
  document.querySelector("#categoryCount").textContent = categories.length;
}

function renderCategoryChart(data) {
  const categories = Object.entries(data.by_category || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const svg = d3.select("#categoryChart");
  svg.selectAll("*").remove();

  const width = 600;
  const height = 320;
  const margin = { top: 10, right: 20, bottom: 90, left: 50 };

  if (!categories.length) {
    svg
      .append("text")
      .attr("x", 30)
      .attr("y", 50)
      .style("fill", "#aaa")
      .text("No category data available yet.");
    return;
  }

  const x = d3
    .scaleBand()
    .domain(categories.map((item) => item.name))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(categories, (item) => item.value) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("fill", "#eee");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#eee");

  svg
    .selectAll("rect")
    .data(categories)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (item) => x(item.name))
    .attr("y", (item) => y(item.value))
    .attr("width", x.bandwidth())
    .attr("height", (item) => y(0) - y(item.value));
}

function renderTimelineChart(data) {
  const timeline = data.timeline || [];
  const ignoreKeys = new Set([
    "minute",
    "normal",
    "video/app",
    "claude bot",
    "internet measurement",
  ]);
  const keys = Array.from(
    new Set(timeline.flatMap((item) => Object.keys(item).filter((key) => !ignoreKeys.has(key)))),
  );

  const svg = d3.select("#timelineChart");
  svg.selectAll("*").remove();

  const width = 1000;
  const height = 360;
  const margin = { top: 20, right: 180, bottom: 50, left: 50 };

  if (!timeline.length || !keys.length) {
    svg
      .append("text")
      .attr("x", 30)
      .attr("y", 50)
      .style("fill", "#aaa")
      .text("No attack timeline data yet.");
    return;
  }

  const stacked = d3
    .stack()
    .keys(keys)
    .value((item, key) => item[key] || 0)(timeline);

  const x = d3
    .scaleBand()
    .domain(timeline.map((item) => item.minute))
    .range([margin.left, width - margin.right])
    .padding(0.15);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(stacked, (layer) => d3.max(layer, (item) => item[1])) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal().domain(keys).range(d3.schemeTableau10);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(x.domain().filter((_, index) => index % 5 === 0)))
    .selectAll("text")
    .style("fill", "#eee");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#eee");

  svg
    .selectAll("g.layer")
    .data(stacked)
    .join("g")
    .attr("class", "layer")
    .attr("fill", (layer) => color(layer.key))
    .selectAll("rect")
    .data((layer) => layer)
    .join("rect")
    .attr("x", (item) => x(item.data.minute))
    .attr("y", (item) => y(item[1]))
    .attr("height", (item) => y(item[0]) - y(item[1]))
    .attr("width", x.bandwidth());

  const legend = svg
    .append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

  keys.forEach((key, index) => {
    const row = legend.append("g").attr("transform", `translate(0, ${index * 22})`);

    row.append("rect").attr("width", 12).attr("height", 12).attr("fill", color(key));

    row
      .append("text")
      .attr("x", 18)
      .attr("y", 11)
      .text(key)
      .style("fill", "#eee")
      .style("font-size", "12px");
  });
}

function renderTables(data) {
  document.querySelector("#topIps").innerHTML =
    "<tr><th>IP</th><th>Hits</th></tr>" +
    renderTableRows(data.top_ips || [], 2, "No IP data yet.", ([ip, count]) =>
      `<tr><td><button type="button" class="ip-link${isSelectedReport("ip", ip) ? " is-selected" : ""}" data-ip="${escapeHtml(ip)}">${escapeHtml(ip)}</button></td><td>${count}</td></tr>`,
    );

  document.querySelector("#topHosts").innerHTML =
    "<tr><th>Host</th><th>Hits</th></tr>" +
    renderTableRows(data.top_hosts || [], 2, "No host data yet.", ([host, count]) =>
      `<tr><td><button type="button" class="host-link${isSelectedReport("host", host) ? " is-selected" : ""}" data-host="${escapeHtml(host)}">${escapeHtml(host)}</button></td><td>${count}</td></tr>`,
    );

  document.querySelector("#recent").innerHTML =
    "<tr><th>Time</th><th>IP</th><th>Host</th><th>Status</th><th>Category</th><th>Request</th></tr>" +
    renderTableRows(
      (data.recent || []).slice().reverse(),
      6,
      "No recent requests yet.",
      (row) => `
        <tr>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.ip)}</td>
          <td>${escapeHtml(row.host)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.request)}</td>
        </tr>
      `,
    );

  bindIpLinks();
  bindHostLinks();
}

function isSelectedReport(type, key) {
  return selectedReport && selectedReport.type === type && selectedReport.key === key;
}

function renderTableRows(items, columns, emptyMessage, renderRow) {
  if (!items.length) {
    return `<tr><td colspan="${columns}" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  }

  return items.map(renderRow).join("");
}

function bindIpLinks() {
  document.querySelectorAll(".ip-link").forEach((button) => {
    button.addEventListener("click", () => {
      const ip = button.dataset.ip;
      selectedReport = { type: "ip", key: ip };
      renderTables(currentData || {});
      renderIpReport(ip, currentData && currentData.ip_reports ? currentData.ip_reports[ip] : null);
    });
  });
}

function bindHostLinks() {
  document.querySelectorAll(".host-link").forEach((button) => {
    button.addEventListener("click", () => {
      const host = button.dataset.host;
      selectedReport = { type: "host", key: host };
      renderTables(currentData || {});
      renderHostReport(
        host,
        currentData && currentData.host_reports ? currentData.host_reports[host] : null,
      );
    });
  });
}

function renderEmptyDetailReport() {
  closeIpReportModal();
  document.querySelector("#ipReportTitle").textContent = "Detail Report";
  document.querySelector("#ipReport").innerHTML = "";
}

function renderIpReport(ip, report) {
  const title = document.querySelector("#ipReportTitle");
  const body = document.querySelector("#ipReport");

  title.textContent = `IP Report: ${ip}`;
  openIpReportModal();

  if (!report) {
    body.innerHTML = '<p class="empty">No report data available for this IP.</p>';
    return;
  }

  body.innerHTML = `
    <div class="report-meta">
      <strong>${escapeHtml(report.classification || "Unknown")}</strong>
      <div>Total requests: ${escapeHtml(report.total)}</div>
      <div>First seen: ${escapeHtml(report.first_seen)}</div>
      <div>Last seen: ${escapeHtml(report.last_seen)}</div>
    </div>
    <div class="report-grid">
      <div class="report-block">
        <h3>Hosts targeted</h3>
        ${renderPillList(report.hosts || [], ([host, count]) => `${escapeHtml(host)} (${count})`, "No hosts available.")}
      </div>
      <div class="report-block">
        <h3>Status breakdown</h3>
        ${renderPillList(Object.entries(report.statuses || {}), ([status, count]) => `${escapeHtml(status)} (${count})`, "No status data available.")}
      </div>
      <div class="report-block">
        <h3>Category breakdown</h3>
        ${renderPillList(Object.entries(report.categories || {}), ([category, count]) => `${escapeHtml(category)} (${count})`, "No category data available.")}
      </div>
      <div class="report-block">
        <h3>Top requested paths</h3>
        ${renderPillList(report.top_paths || [], ([path, count]) => `${escapeHtml(path)} (${count})`, "No path data available.")}
      </div>
      <div class="report-block">
        <h3>User agents</h3>
        ${renderPillList(report.user_agents || [], ([ua, count]) => `${escapeHtml(ua)} (${count})`, "No user-agent data available.")}
      </div>
    </div>
    <div class="report-block">
      <h3>Recent requests from this IP</h3>
      <div class="table-wrap">
        <table class="detail-table">
          <thead>
          <tr><th>Time</th><th>Host</th><th>Status</th><th>Category</th><th>Request</th></tr>
          </thead>
          <tbody>
          ${renderTableRows((report.recent || []).slice().reverse(), 5, "No recent requests available.", (row) => `
            <tr>
              <td data-label="Time">${escapeHtml(row.time)}</td>
              <td data-label="Host">${escapeHtml(row.host)}</td>
              <td data-label="Status">${escapeHtml(row.status)}</td>
              <td data-label="Category">${escapeHtml(row.category)}</td>
              <td data-label="Request">${escapeHtml(row.request)}</td>
            </tr>
          `)}
          </tbody>
        </table>
      </div>
    </div>
    <div class="report-copy">
      <button type="button" data-copy-ip="${escapeHtml(ip)}">Copy Markdown report</button>
    </div>
  `;

  const copyButton = body.querySelector("[data-copy-ip]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const markdown = buildMarkdownReport(ip, report);
      try {
        await navigator.clipboard.writeText(markdown);
        copyButton.textContent = "Copied Markdown report";
      } catch (error) {
        copyButton.textContent = "Copy failed";
      }
    });
  }
}

function renderHostReport(host, report) {
  const title = document.querySelector("#ipReportTitle");
  const body = document.querySelector("#ipReport");

  title.textContent = `Host Report: ${host}`;
  openIpReportModal();

  if (!report) {
    body.innerHTML = '<p class="empty">No report data available for this host.</p>';
    return;
  }

  body.innerHTML = `
    <div class="report-meta">
      <strong>${escapeHtml(host)}</strong>
      <div>Total requests: ${escapeHtml(report.total)}</div>
      <div>First seen: ${escapeHtml(report.first_seen)}</div>
      <div>Last seen: ${escapeHtml(report.last_seen)}</div>
    </div>
    <div class="report-grid">
      <div class="report-block">
        <h3>Category breakdown</h3>
        ${renderPillList(Object.entries(report.categories || {}), ([category, count]) => `${escapeHtml(category)} (${count})`, "No category data available.")}
      </div>
      <div class="report-block">
        <h3>Status breakdown</h3>
        ${renderPillList(Object.entries(report.statuses || {}), ([status, count]) => `${escapeHtml(status)} (${count})`, "No status data available.")}
      </div>
      <div class="report-block">
        <h3>Top requested paths</h3>
        ${renderPillList(report.top_paths || [], ([path, count]) => `${escapeHtml(path)} (${count})`, "No path data available.")}
      </div>
      <div class="report-block">
        <h3>Top source IPs</h3>
        ${renderPillList(report.top_ips || [], ([ip, count]) => `${escapeHtml(ip)} (${count})`, "No IP data available.")}
      </div>
      <div class="report-block">
        <h3>User agents</h3>
        ${renderPillList(report.user_agents || [], ([ua, count]) => `${escapeHtml(ua)} (${count})`, "No user-agent data available.")}
      </div>
    </div>
    <div class="report-block">
      <h3>Recent requests to this host</h3>
      <div class="table-wrap">
        <table class="detail-table">
          <thead>
          <tr><th>Time</th><th>IP</th><th>Status</th><th>Category</th><th>Request</th></tr>
          </thead>
          <tbody>
          ${renderTableRows((report.recent || []).slice().reverse(), 5, "No recent requests available.", (row) => `
            <tr>
              <td data-label="Time">${escapeHtml(row.time)}</td>
              <td data-label="IP">${escapeHtml(row.ip)}</td>
              <td data-label="Status">${escapeHtml(row.status)}</td>
              <td data-label="Category">${escapeHtml(row.category)}</td>
              <td data-label="Request">${escapeHtml(row.request)}</td>
            </tr>
          `)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openIpReportModal() {
  document.body.classList.add("modal-open");
  document.querySelector("#ipReportModal").hidden = false;
}

function closeIpReportModal() {
  document.body.classList.remove("modal-open");
  document.querySelector("#ipReportModal").hidden = true;
}

function renderPillList(items, formatter, emptyMessage) {
  if (!items.length) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<ul class="pill-list">${items.map((item) => `<li class="pill">${formatter(item)}</li>`).join("")}</ul>`;
}

function buildMarkdownReport(ip, report) {
  return [
    `## IP Report: ${ip}`,
    "",
    `Classification: ${report.classification || "Unknown"}`,
    "",
    `Total requests: ${report.total}`,
    `First seen: ${report.first_seen}`,
    `Last seen: ${report.last_seen}`,
    "",
    "Top paths:",
    ...(report.top_paths || []).map(([path, count]) => `- ${path}: ${count}`),
    "",
    "Hosts targeted:",
    ...(report.hosts || []).map(([host, count]) => `- ${host}: ${count}`),
  ].join("\n");
}

function bindModalEvents() {
  document.querySelector("#ipReportClose").addEventListener("click", closeIpReportModal);
  document.querySelector("#ipReportBackdrop").addEventListener("click", closeIpReportModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("#ipReportModal").hidden) {
      closeIpReportModal();
    }
  });
}

bindModalEvents();
load();
setInterval(load, 60000);
