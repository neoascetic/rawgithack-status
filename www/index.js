const maxDays = 30;

const url = "https://raw.githubusercontent.com/neoascetic/ctatyc/refs/heads/master/log.csv";

async function genReportLog(container, key, logData) {
  const normalized = normalizeData(logData);
  const statusStream = constructStatusStream(key, normalized);
  container.appendChild(statusStream);
}

function constructStatusStream(key, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal) {
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: getTooltip(key, date, color),
  });

  const show = () => {
    showTooltip(square, key, date, color);
  };
  square.addEventListener("mouseover", show);
  square.addEventListener("mousedown", show);
  square.addEventListener("mouseout", hideTooltip);
  return square;
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "No Data Available"
    : color == "success"
    ? "Fully Operational"
    : color == "failure"
    ? "Major Outage"
    : color == "partial"
    ? "Partial Outage"
    : "Unknown";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "No Data Available: Health check was not performed."
    : color == "success"
    ? "No downtime recorded on this day."
    : color == "failure"
    ? "Major outages recorded on this day."
    : color == "partial"
    ? "Partial outages recorded on this day."
    : "Unknown";
}

function getTooltip(key, date, quartile, color) {
  let statusText = getStatusText(color);
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(logData) {
  const dateNormalized = splitRowsByDate(logData);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const [dateTimeStr, resultStr] = rows[ii];
    // Replace '-' with '/' because Safari
    const dateTime = new Date(
      Date.parse(dateTimeStr.replaceAll("-", "/") + " GMT")
    );
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (dateValues.length > maxDays) {
        break;
      }
    }

    let result = 0;
    let resultInt = parseInt(resultStr);
    // allowed statuses
    if (resultInt >= 200 && resultInt < 300) {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
  dateValues.upTime = upTime;
  return dateValues;
}

let tooltipTimeout = null;
function showTooltip(element, key, date, color) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10 + 'px';
  toolTipDiv.style.left =
    element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2 + 'px';
  toolTipDiv.style.opacity = "1";
  toolTipDiv.style.zIndex = "100";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
    toolTipDiv.style.zIndex = "-1";
  }, 1000);
}

async function genAllReports() {
  const response = await fetch(url);
  const log = await response.text();
  const logLines = log.split("\n");
  let acc = {}
  for (let ii = 0; ii < logLines.length; ii++) {
    const logLine = logLines[ii];
    let [key, dateTime, status] = logLine.split(",");
    if (!key) continue;
    key = key.replaceAll("_", " ")
    if (!acc[key]) acc[key] = [];
    acc[key].push([dateTime, status])
  }

  for (const key of Object.keys(acc).sort()) {
    await genReportLog(
      document.getElementById("reports"),
      key,
      acc[key]
    );
  }
}

genAllReports();
