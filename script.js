"use strict";

const items = document.querySelector("#items");
const itemTemplate = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const grandTotal = document.querySelector("#grand-total");
const discountInput = document.querySelector("#discount-percent");
const vatInput = document.querySelector("#vat-percent");
const currencySelect = document.querySelector("#currency");
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
  document.querySelectorAll("[data-price-label]").forEach((label) => {
    label.textContent = `Цена, ${currencySelect.value}`;
  });
}

function addItem(focus = true) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
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
});

items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || event.repeat) return;
  if (!event.target.matches("input")) return;
  if (event.target.closest("tr") !== items.lastElementChild) return;
  event.preventDefault();
  addItem();
});

// Используем местную дату, чтобы UTC не сдвигал день около полуночи.
const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

addItem(false);
recalculate();
