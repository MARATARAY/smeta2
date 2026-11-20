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

// Базовая цена хранится отдельно: переключения не накапливают скидку.
function unitPrice(basePrice, unit) {
  const price = unit === "порция" ? basePrice * 2 * 0.9 : basePrice;
  return Number.isFinite(price) ? Number(price.toFixed(2)) : 0;
}

function rememberBasePrice(row) {
  const price = readNumber(row.querySelector(".item-price").value);
  const factor = row.querySelector(".item-unit").value === "порция" ? 1.8 : 1;
  row.dataset.basePrice = String(price / factor);
}

function applyUnitPrice(row) {
  row.querySelector(".item-price").value = String(unitPrice(
    readNumber(row.dataset.basePrice || "0"), row.querySelector(".item-unit").value
  ));
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
    label.textContent = `Цена за ед., ${currencySelect.value}`;
  });
}

const appetizerMenu = [
  { name: "Брускета с картофельным пюре и беконом", unit: "шт", basePrice: 200 },
  { name: "Брускета с овощами и фетой", unit: "шт", basePrice: 200 },
  { name: "Брускета с паштетом из говядины", unit: "шт", basePrice: 250 },
  { name: "Брускета с паштетом из маслин", unit: "шт", basePrice: 200 },
  { name: "Брускета с томатами", unit: "шт", basePrice: 200 },
  { name: "Канапе с мясом говядины", unit: "шт", basePrice: 300 },
  { name: "Канапе овощное", unit: "шт", basePrice: 200 },
  { name: "Канапе с полосатым хлебом и лососем", unit: "шт", basePrice: 400 },
  { name: "Канапе со сливочным маслом и красной икрой", unit: "шт", basePrice: 400 },
  { name: "Канапе с ростбифом", unit: "шт", basePrice: 400 },
  { name: "Канапе сыр с виноградом", unit: "шт", basePrice: 300 },
  { name: "Канапе фруктовое", unit: "шт", basePrice: 200 },
  { name: "Тарталетки с салатом из крабовых палочек", unit: "шт", basePrice: 300 },
  { name: "Тарталетки с салатом из куриного мяса", unit: "шт", basePrice: 300 },
  { name: "Тарталетка с красной икрой и сливочным маслом", unit: "шт", basePrice: 400 },
  { name: "Блинчики с лососем и сливочным сыром", unit: "180 грамм", basePrice: 2100 },
  { name: "Мини-самса с курицей", unit: "шт", basePrice: 250 },
  { name: "Мини-самса с мясом", unit: "шт", basePrice: 300 },
  { name: "Мини-чебуреки с говядиной", unit: "6 шт", basePrice: 1000 },
  { name: "Мини-сэндвич с мясом", unit: "шт", basePrice: 400 },
  { name: "Мини-сэндвич с курицей", unit: "шт", basePrice: 350 },
  { name: "Мини-сэндвич с сыром", unit: "шт", basePrice: 300 },
  { name: "Мини-сэндвич с тунцом", unit: "шт", basePrice: 350 },
  { name: "Мини-сэндвич с казы", unit: "шт", basePrice: 400 },
  { name: "Мини-пирожки духовые с мясом", unit: "шт", basePrice: 300 },
  { name: "Мини-пирожки духовые с картофелем", unit: "шт", basePrice: 200 },
  { name: "Мини-пирожки духовые с капустой", unit: "шт", basePrice: 200 },
];
const itemUnits = ["шт", "порция"];
const legacyUnits = ["порц", "180 грамм", "6 шт", "час", "услуга", "гость", "смена", "стол", "рейс"];
let openPicker = null;
let menuMatches = [];
let activeMenuIndex = -1;
let pickerSequence = 0;

function normalizeMenuText(value) {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[-–—]/g, " ").trim();
}

function nameWithPortion(name, unit) {
  const portion = `(${unit})`;
  return ["180 грамм", "6 шт"].includes(unit) && !name.endsWith(portion) ? `${name} ${portion}` : name;
}

function findMenuDishes(query) {
  const words = normalizeMenuText(query).split(/\s+/).filter(Boolean);
  return appetizerMenu.filter((dish) => {
    const text = normalizeMenuText(`${dish.name} ${dish.unit}`);
    return words.every((word) => text.includes(word));
  });
}

function closeMenu() {
  if (!openPicker) return;
  const input = openPicker.querySelector(".item-name");
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  openPicker.querySelector(".menu-dropdown").hidden = true;
  openPicker = null;
  menuMatches = [];
  activeMenuIndex = -1;
}

function positionMenu(input) {
  const dropdown = input.closest(".dish-picker").querySelector(".menu-dropdown");
  const rect = input.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;
  const below = Math.max(0, top + height - rect.bottom - 16);
  const above = Math.max(0, rect.top - top - 16);
  const openAbove = below < 200 && above > below;
  dropdown.style.width = `${Math.min(440, width - 24)}px`;
  dropdown.style.maxHeight = `${openAbove ? above : below}px`;
  dropdown.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - dropdown.offsetWidth - 12))}px`;
  dropdown.style.top = `${openAbove ? rect.top - dropdown.offsetHeight - 6 : rect.bottom + 6}px`;
}

function showMenu(input, query = "") {
  const picker = input.closest(".dish-picker");
  if (openPicker !== picker) closeMenu();
  openPicker = picker;
  const list = picker.querySelector(".menu-options");
  list.replaceChildren();
  menuMatches = findMenuDishes(query);
  activeMenuIndex = -1;
  input.removeAttribute("aria-activedescendant");
  for (const [index, dish] of menuMatches.entries()) {
    const option = document.createElement("div");
    option.className = "menu-option";
    option.id = `${list.id}-option-${index}`;
    option.dataset.menuIndex = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.setAttribute("aria-disabled", String(currencySelect.value !== "₸"));
    const name = document.createElement("span");
    name.className = "menu-option-name";
    name.textContent = `${dish.name} (${dish.unit})`;
    const price = document.createElement("span");
    price.className = "menu-option-price";
    price.textContent = `${moneyFormatter.format(dish.basePrice).replace(/[\u00a0\u202f]/g, " ")} ₸`;
    option.append(name, price);
    list.append(option);
  }
  const empty = picker.querySelector(".menu-empty");
  empty.hidden = menuMatches.length > 0 && currencySelect.value === "₸";
  empty.textContent = currencySelect.value !== "₸"
    ? "Цены меню указаны в тенге. Выберите валюту ₸ для подстановки блюда или введите свою цену вручную."
    : "Ничего не найдено. Можно оставить своё название и указать цену вручную.";
  list.scrollTop = 0;
  picker.querySelector(".menu-dropdown").hidden = false;
  positionMenu(input);
  input.setAttribute("aria-expanded", "true");
}

function highlightMenuOption(index) {
  if (!openPicker || !menuMatches.length || currencySelect.value !== "₸") return;
  activeMenuIndex = (index + menuMatches.length) % menuMatches.length;
  const options = openPicker.querySelectorAll(".menu-option");
  options.forEach((option, i) => option.setAttribute("aria-selected", String(i === activeMenuIndex)));
  const selected = options[activeMenuIndex];
  openPicker.querySelector(".item-name").setAttribute("aria-activedescendant", selected.id);
  selected.scrollIntoView({ block: "nearest" });
}

function chooseMenuDish(index) {
  const dish = menuMatches[index];
  if (!openPicker || !dish || currencySelect.value !== "₸") return;
  const row = openPicker.closest("tr");
  const input = row.querySelector(".item-name");
  input.value = nameWithPortion(dish.name, dish.unit);
  row.dataset.basePrice = String(dish.basePrice);
  row.querySelector(".item-unit").value = "шт";
  applyUnitPrice(row);
  const quantity = row.querySelector(".item-quantity");
  if (readNumber(quantity.value) === 0) quantity.value = "1";
  input.focus();
  closeMenu();
  recalculate();
  clearCopyFeedback();
  saveDraft();
}

items.addEventListener("focusin", (event) => {
  if (event.target.matches(".item-name")) showMenu(event.target);
});
items.addEventListener("click", (event) => {
  if (event.target.matches(".item-name")) showMenu(event.target);
  const option = event.target.closest(".menu-option");
  if (option) chooseMenuDish(Number(option.dataset.menuIndex));
});
items.addEventListener("mousedown", (event) => {
  // Сохраняем курсор в поле: прокрутка пальцем при этом остаётся доступной.
  if (event.target.closest(".menu-option")) event.preventDefault();
});
items.addEventListener("input", (event) => {
  if (event.target.matches(".item-name")) showMenu(event.target, event.target.value);
});
document.addEventListener("pointerdown", (event) => {
  if (openPicker && !openPicker.contains(event.target)) closeMenu();
});
document.addEventListener("focusin", (event) => {
  if (openPicker && !openPicker.contains(event.target)) closeMenu();
});
document.addEventListener("scroll", (event) => {
  if (openPicker && !openPicker.querySelector(".menu-dropdown").contains(event.target)) closeMenu();
}, true);
window.addEventListener("resize", closeMenu);
window.visualViewport?.addEventListener("resize", () => {
  if (openPicker) positionMenu(openPicker.querySelector(".item-name"));
});

function addItem(focus = true) {
  closeMenu();
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.basePrice = "0";
  const input = row.querySelector(".item-name");
  const list = row.querySelector(".menu-options");
  list.id = `appetizers-${++pickerSequence}`;
  input.setAttribute("aria-controls", list.id);
  items.append(row);
  recalculate();
  saveDraft();
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

addButton.addEventListener("click", () => addItem());
items.addEventListener("input", (event) => {
  if (event.target.matches(".item-price")) rememberBasePrice(event.target.closest("tr"));
  recalculate();
});
items.addEventListener("change", (event) => {
  const row = event.target.closest("tr");
  if (event.target.matches(".item-price")) rememberBasePrice(row);
  if (event.target.matches(".item-unit")) applyUnitPrice(row);
  recalculate();
});
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencySelect.addEventListener("change", recalculate);
currencySelect.addEventListener("change", closeMenu);

items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  closeMenu();
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addItem();
  recalculate();
  saveDraft();
});

items.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (event.target.matches(".item-name")) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!openPicker) showMenu(event.target, event.target.value);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      highlightMenuOption(activeMenuIndex < 0 ? (direction > 0 ? 0 : menuMatches.length - 1) : activeMenuIndex + direction);
      return;
    }
    if (event.key === "Escape" && openPicker) {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "Enter" && openPicker && activeMenuIndex >= 0) {
      event.preventDefault();
      if (!event.repeat) chooseMenuDish(activeMenuIndex);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") closeMenu();
  }
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
  closeMenu();
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
  const positions = Array.from(items.rows, (row) => ({
    ...Object.fromEntries(Object.entries(itemFields).map(([key, selector]) => [key, row.querySelector(selector).value])),
    basePrice: row.dataset.basePrice,
  }));
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
    if (!draft.positions.every((position) => position && Object.keys(itemFields).every((key) => typeof position[key] === "string") && [...itemUnits, ...legacyUnits].includes(position.unit))) return false;
    for (const id of draftFieldIds) document.getElementById(id).value = draft.fields[id];
    for (const position of draft.positions) {
      const row = addItem(false);
      for (const [key, selector] of Object.entries(itemFields)) row.querySelector(selector).value = position[key];
      row.querySelector(".item-unit").value = position.unit === "порц" ? "порция" : itemUnits.includes(position.unit) ? position.unit : "шт";
      row.querySelector(".item-name").value = nameWithPortion(position.name, position.unit);
      if (typeof position.basePrice === "string") {
        row.dataset.basePrice = String(readNumber(position.basePrice));
        applyUnitPrice(row);
      } else {
        // Старый черновик: сохраняем показанную цену, определяя базу для будущих переключений.
        rememberBasePrice(row);
      }
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
  closeMenu();
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
