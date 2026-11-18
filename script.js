"use strict";

const items = document.querySelector("#items");
const itemTemplate = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const grandTotal = document.querySelector("#grand-total");
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
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
  return `${moneyFormatter.format(safeValue).replace(/[\u00a0\u202f]/g, " ")} ₸`;
}

function recalculate() {
  let total = 0;
  for (const row of items.rows) {
    const quantity = readNumber(row.querySelector(".item-quantity").value);
    const price = readNumber(row.querySelector(".item-price").value);
    const product = quantity * price;
    const amount = Number.isFinite(product) ? Math.round(product * 100) / 100 : 0;
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    row.querySelector(".line-total").textContent = formatMoney(safeAmount);
    total += safeAmount;
  }
  grandTotal.textContent = formatMoney(total);
}

function addItem(focus = true) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

addButton.addEventListener("click", () => addItem());
items.addEventListener("input", recalculate);

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
