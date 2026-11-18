"use strict";

const items = document.querySelector("#items");
const itemTemplate = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const grandTotal = document.querySelector("#grand-total");
const discountInput = document.querySelector("#discount-percent");
const vatInput = document.querySelector("#vat-percent");
const currencySelect = document.querySelector("#currency");
const draftKey = "smeta5-draft-v1";
const draftFieldIds = ["sender", "recipient", "estimate-number", "estimate-date", "discount-percent", "vat-percent", "currency", "comment"];
const itemFields = { name: ".item-name", quantity: ".item-quantity", unit: ".item-unit", price: ".item-price" };
let restoringDraft = true;
let copyTimer;
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Разрешаем десятичную запятую и пробелы между тысячами.
function readNumber(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatMoney(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${moneyFormatter.format(safeValue).replace(/[\u00a0\u202f]/g, " ")} ${currencySelect.value}`;
}

function roundAmount(value) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function tengeAmountInWords(amount) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 999999999) return "";
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  function groupWords(number, feminine = false) {
    const words = [hundreds[Math.floor(number / 100)]];
    const remainder = number % 100;
    if (remainder >= 10 && remainder <= 19) words.push(teens[remainder - 10]);
    else {
      words.push(tens[Math.floor(remainder / 10)]);
      const unit = remainder % 10;
      words.push(feminine && unit === 1 ? "одна" : feminine && unit === 2 ? "две" : units[unit]);
    }
    return words.filter(Boolean).join(" ");
  }

  function plural(number, forms) {
    const lastTwo = number % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
    const last = number % 10;
    return last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
  }

  const words = [];
  const millions = Math.floor(amount / 1000000);
  const thousands = Math.floor(amount / 1000) % 1000;
  const remainder = amount % 1000;
  if (millions) words.push(groupWords(millions), plural(millions, ["миллион", "миллиона", "миллионов"]));
  if (thousands) words.push(groupWords(thousands, true), plural(thousands, ["тысяча", "тысячи", "тысяч"]));
  if (remainder) words.push(groupWords(remainder));
  words.push("тенге");
  const text = words.join(" ");
  return text[0].toUpperCase() + text.slice(1);
}

function updateAmountWords(amount) {
  const text = currencySelect.value === "₸" ? tengeAmountInWords(amount) : "";
  document.querySelector("#amount-words").textContent = text;
  document.querySelector("#amount-words-row").hidden = !text;
}

function updateSummary(outputId, rowId, amount) {
  document.querySelector(outputId).textContent = formatMoney(amount);
  if (rowId) document.querySelector(rowId).hidden = amount === 0;
}

function recalculate() {
  let total = 0;
  for (const row of items.rows) {
    const quantity = readNumber(row.querySelector(".item-quantity").value);
    const price = readNumber(row.querySelector(".item-price").value);
    const product = quantity * price;
    const amount = roundAmount(product);
    row.querySelector(".line-total").textContent = formatMoney(amount);
    total = roundAmount(total + amount);
  }
  const discount = roundAmount(total * (readNumber(discountInput.value) / 100));
  const discountedTotal = roundAmount(total - discount);
  const vat = roundAmount(discountedTotal * (readNumber(vatInput.value) / 100));
  updateSummary("#subtotal", null, total);
  updateSummary("#discount-amount", "#discount-row", discount);
  updateSummary("#discounted-total", "#discounted-row", discountedTotal);
  updateSummary("#vat-amount", "#vat-row", vat);
  grandTotal.textContent = formatMoney(roundAmount(discountedTotal + vat));
  updateAmountWords(roundAmount(discountedTotal + vat));
  document.querySelectorAll("[data-price-label]").forEach((label) => {
    label.textContent = `Цена, ${currencySelect.value}`;
  });
}

function addItem(focus = true) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
  saveDraft();
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

addButton.addEventListener("click", () => addItem());
items.addEventListener("input", recalculate);
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencySelect.addEventListener("change", recalculate);

items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addItem();
  recalculate();
  saveDraft();
});

items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  if (!event.target.matches("input")) return;
  if (event.target.closest("tr") !== items.lastElementChild) return;
  event.preventDefault();
  addItem();
});

function localDate() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
}

// Текстовые копии позволяют печатать длинные значения целиком, без обрезки полями.
function preparePrint() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  document.querySelector("#print-title").textContent = `Смета № ${number} от ${formattedDate}`;

  document.querySelectorAll("main input, main select, #comment").forEach((field) => {
    let printValue = field.nextElementSibling;
    if (!printValue || !printValue.classList.contains("print-value")) {
      printValue = document.createElement("span");
      printValue.className = "print-value";
      printValue.setAttribute("aria-hidden", "true");
      field.after(printValue);
    }
    printValue.textContent = field.value;
  });
}

document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
window.addEventListener("beforeprint", preparePrint);

function saveDraft() {
  if (restoringDraft) return;
  const fields = Object.fromEntries(draftFieldIds.map((id) => [id, document.getElementById(id).value]));
  const positions = Array.from(items.rows, (row) => Object.fromEntries(
    Object.entries(itemFields).map(([key, selector]) => [key, row.querySelector(selector).value])
  ));
  try {
    localStorage.setItem(draftKey, JSON.stringify({ version: 1, fields, positions }));
    document.querySelector("#draft-status").textContent = "";
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик в браузере. Не закрывайте страницу до сохранения PDF или копирования текста.";
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    // Проверяем весь черновик до изменения формы.
    if (draft?.version !== 1 || !draft.fields || !Array.isArray(draft.positions)) return false;
    if (!draftFieldIds.every((id) => typeof draft.fields[id] === "string")) return false;
    if (!["₸", "₽", "$", "€"].includes(draft.fields.currency)) return false;
    if (!draft.positions.every((position) => position && Object.keys(itemFields).every((key) => typeof position[key] === "string") && ["шт", "час", "услуга"].includes(position.unit))) return false;
    for (const id of draftFieldIds) document.getElementById(id).value = draft.fields[id];
    for (const position of draft.positions) {
      const row = addItem(false);
      for (const [key, selector] of Object.entries(itemFields)) row.querySelector(selector).value = position[key];
    }
    return true;
  } catch {
    return false;
  }
}

function clearCopyFeedback() {
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#share-text").value = "";
}

document.querySelector("main").addEventListener("input", (event) => {
  if (!event.target.matches("input, select, #comment")) return;
  clearCopyFeedback();
  saveDraft();
});
document.querySelector("main").addEventListener("change", (event) => {
  if (!event.target.matches("input, select, #comment")) return;
  clearCopyFeedback();
  saveDraft();
});

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const current = document.querySelector("#estimate-number").value.trim();
  const match = current.match(/^(.*?)(\d+)$/);
  const nextNumber = match ? match[1] + String(BigInt(match[2]) + 1n).padStart(match[2].length, "0") : "1";
  restoringDraft = true;
  for (const id of draftFieldIds) document.getElementById(id).value = "";
  discountInput.value = "0";
  vatInput.value = "0";
  currencySelect.value = "₸";
  document.querySelector("#estimate-number").value = nextNumber;
  document.querySelector("#estimate-date").value = localDate();
  items.replaceChildren();
  document.querySelectorAll(".print-value").forEach((value) => value.remove());
  document.querySelector("#print-title").textContent = "";
  clearCopyFeedback();
  addItem();
  restoringDraft = false;
  saveDraft();
});

function buildShareText() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const lines = [`Смета № ${number} от ${date ? date.split("-").reverse().join(".") : "—"}`];
  for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  const quantityFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 20 });
  for (const row of items.rows) {
    const name = row.querySelector(".item-name").value.trim();
    const quantity = row.querySelector(".item-quantity").value;
    const price = row.querySelector(".item-price").value;
    if (!name && !quantity.trim() && !price.trim()) continue;
    const unit = row.querySelector(".item-unit").value;
    const formattedQuantity = quantityFormatter.format(readNumber(quantity)).replace(/[\u00a0\u202f]/g, " ");
    lines.push(`• ${name || "Без наименования"} — ${formattedQuantity} ${unit} × ${formatMoney(readNumber(price))} = ${row.querySelector(".line-total").textContent}`);
  }
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  if (!document.querySelector("#discount-row").hidden) {
    lines.push(`Скидка (${readNumber(discountInput.value)} %): ${document.querySelector("#discount-amount").textContent}`);
    lines.push(`Сумма со скидкой: ${document.querySelector("#discounted-total").textContent}`);
  }
  if (!document.querySelector("#vat-row").hidden) lines.push(`НДС (${readNumber(vatInput.value)} %): ${document.querySelector("#vat-amount").textContent}`);
  lines.push(`Итого к оплате: ${grandTotal.textContent}`);
  const amountWords = document.querySelector("#amount-words").textContent;
  if (amountWords) lines.push(`Сумма прописью: ${amountWords}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", `Комментарий: ${comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  clearCopyFeedback();
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.querySelector("#copy-status").textContent = ""; }, 2000);
  } catch {
    document.querySelector("#manual-copy").hidden = false;
    const field = document.querySelector("#share-text");
    field.value = text;
    field.focus();
    field.select();
  }
});

document.querySelector("#estimate-date").value = localDate();
restoreDraft();
if (!items.rows.length) addItem(false);
recalculate();
restoringDraft = false;
