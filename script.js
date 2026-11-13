/* =========================================================
   Pantry Party 🛒 — stock & shopping list logic
   All data lives in localStorage. No server needed.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "pantryParty.v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const EMOJI_RULES = [
    [/milk|yogurt|yoghurt|cream|dairy/, "🥛"],
    [/egg/, "🥚"],
    [/bread|loaf|bagel|bun|toast/, "🍞"],
    [/rice/, "🍚"],
    [/pasta|spaghetti|noodle|macaroni/, "🍝"],
    [/flour/, "🌾"],
    [/sugar/, "🍬"],
    [/coffee/, "☕"],
    [/tea/, "🍵"],
    [/tissue|toilet|paper towel|napkin/, "🧻"],
    [/\boil\b/, "🫒"],
    [/butter/, "🧈"],
    [/cheese/, "🧀"],
    [/chicken/, "🍗"],
    [/meat|beef|steak|mince|lamb|pork/, "🥩"],
    [/fish|salmon|tuna|prawn|shrimp/, "🐟"],
    [/apple/, "🍎"],
    [/banana/, "🍌"],
    [/orange|mandarin/, "🍊"],
    [/lemon|lime/, "🍋"],
    [/tomato/, "🍅"],
    [/potato/, "🥔"],
    [/onion/, "🧅"],
    [/carrot/, "🥕"],
    [/garlic/, "🧄"],
    [/pepper|chilli|chili|spice/, "🌶️"],
    [/salt/, "🧂"],
    [/honey|jam|syrup|nutella/, "🍯"],
    [/chocolate|candy|sweet|biscuit|cookie/, "🍫"],
    [/juice/, "🧃"],
    [/water|soda|cola|drink|lemonade/, "🥤"],
    [/soap|hand ?wash/, "🧼"],
    [/shampoo|lotion|cleaner|spray|conditioner/, "🧴"],
    [/detergent|laundry/, "🧺"],
    [/sponge|dish|washing up|scrub/, "🧽"],
    [/trash|garbage|bin bag|rubbish/, "🗑️"],
    [/bag/, "🛍️"],
    [/battery/, "🔋"],
    [/bulb|light/, "💡"],
    [/candle|match/, "🕯️"],
    [/towel/, "🧺"],
    [/toothpaste|toothbrush|brush/, "🪥"],
    [/broom|mop|dust/, "🧹"],
    [/can|bean|tin/, "🥫"],
    [/soup|cereal|oat|porridge/, "🥣"],
    [/popcorn|snack|chips|crisps/, "🍿"],
    [/ice/, "🧊"],
    [/wine/, "🍷"],
    [/beer/, "🍺"],
    [/foil|wrap|cling|freezer/, "📦"],
  ];

  const state = {
    items: [],
    shopping: [],
    filter: "all",
    search: "",
    editingId: null,
  };

  const el = (id) => document.getElementById(id);
  const money = (n) => "$" + (Number(n) || 0).toFixed(2);
  const isLow = (item) => item.qty <= item.lowAt;
  const uid = () =>
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        default: return "&#39;";
      }
    });

  /* ---------------- helpers ---------------- */

  function detectEmoji(name, category) {
    const clean = String(name).toLowerCase();
    for (const [pattern, emoji] of EMOJI_RULES) {
      if (pattern.test(clean)) return emoji;
    }
    return category === "home" ? "🏠" : "🍳";
  }

  function toPrice(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function toCount(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function hasOpenEntry(itemId) {
    return state.shopping.some((entry) => entry.itemId === itemId && !entry.done);
  }

  function suggestedEntry(item) {
    return {
      id: uid(),
      itemId: item.id,
      name: item.name,
      qty: Math.max(item.lowAt * 2 - item.qty, 1),
      price: item.price,
      done: false,
    };
  }

  /* ---------------- storage ---------------- */

  function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().slice(0, 60);
    if (!name) return null;
    const category = raw.category === "home" ? "home" : "cooking";
    return {
      id: String(raw.id || uid()),
      name,
      category,
      emoji: typeof raw.emoji === "string" && raw.emoji ? raw.emoji : detectEmoji(name, category),
      price: toPrice(raw.price),
      qty: toCount(raw.qty, 0),
      lowAt: toCount(raw.lowAt, 1),
    };
  }

  function normalizeShopEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().slice(0, 60);
    if (!name) return null;
    return {
      id: String(raw.id || uid()),
      itemId: raw.itemId ? String(raw.itemId) : null,
      name,
      qty: Math.max(1, toCount(raw.qty, 1)),
      price: toPrice(raw.price),
      done: Boolean(raw.done),
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn("localStorage is unavailable:", err);
      return;
    }
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) {
        state.items = data.items.map(normalizeItem).filter(Boolean);
      }
      if (Array.isArray(data.shopping)) {
        state.shopping = data.shopping.map(normalizeShopEntry).filter(Boolean);
      }
      const ids = new Set(state.items.map((item) => item.id));
      state.shopping.forEach((entry) => {
        if (entry.itemId && !ids.has(entry.itemId)) entry.itemId = null;
      });
    } catch (err) {
      console.warn("Saved data could not be read:", err);
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, items: state.items, shopping: state.shopping })
      );
    } catch (err) {
      console.warn("Could not save data:", err);
      toast("Could not save — browser storage might be full 😬", "warn");
    }
  }

  /* ---------------- rendering ---------------- */

  function renderStats() {
    const lowCount = state.items.filter(isLow).length;
    const stockValue = state.items.reduce((sum, item) => sum + item.price * item.qty, 0);

    el("statItems").textContent = state.items.length;
    el("statLow").textContent = lowCount;
    el("statValue").textContent = money(stockValue);
    el("stockCount").textContent = state.items.length;
    el("shopCount").textContent = state.shopping.length;
    el("statLow").closest(".stat").classList.toggle("is-hot", lowCount > 0);
  }

  function itemCardHTML(item) {
    const low = isLow(item);
    return `
      <article class="item-card${low ? " is-low" : ""}" data-id="${esc(item.id)}">
        <div class="item-top">
          <div class="item-emoji" aria-hidden="true">${item.emoji}</div>
          <div class="item-title">
            <h3>${esc(item.name)}</h3>
            <span class="chip chip-${item.category}">${item.category === "home" ? "🏠 Home" : "🍳 Cooking"}</span>
          </div>
          <div class="item-actions">
            <button class="icon-btn" type="button" data-act="edit" title="Edit" aria-label="Edit ${esc(item.name)}">✏️</button>
            <button class="icon-btn" type="button" data-act="delete" title="Delete" aria-label="Delete ${esc(item.name)}">🗑️</button>
          </div>
        </div>
        <div class="item-meta">
          <span>${money(item.price)} each</span>
          <span class="dot" aria-hidden="true">•</span>
          <span>${money(item.price * item.qty)} on the shelf</span>
        </div>
        <div class="item-bottom">
          <div class="stepper" role="group" aria-label="Quantity of ${esc(item.name)}">
            <button type="button" data-act="dec" aria-label="Use one ${esc(item.name)}">−</button>
            <span class="qty${item.qty === 0 ? " qty-zero" : ""}">${item.qty}</span>
            <button type="button" data-act="inc" aria-label="Add one ${esc(item.name)}">+</button>
          </div>
          ${
            low
              ? `<span class="badge badge-low" title="You set the low-stock point at ${item.lowAt}">${
                  item.qty === 0 ? "Out of stock" : "Running low"
                }</span>`
              : `<span class="badge badge-ok">In stock</span>`
          }
        </div>
      </article>`;
  }

  function renderStock() {
    const listEl = el("stockList");
    const emptyEl = el("stockEmpty");
    let items = state.items.slice();

    const query = state.search.trim().toLowerCase();
    if (query) {
      items = items.filter((item) => item.name.toLowerCase().includes(query));
    }
    if (state.filter === "cooking" || state.filter === "home") {
      items = items.filter((item) => item.category === state.filter);
    } else if (state.filter === "low") {
      items = items.filter(isLow);
    }

    items.sort(
      (a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name)
    );

    if (state.items.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      emptyEl.innerHTML = `
        <span class="empty-emoji" aria-hidden="true">🧺</span>
        <h3>Your shelves are empty… for now</h3>
        <p>Add your first item above and start tracking what you've got.</p>`;
      return;
    }

    if (items.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      emptyEl.innerHTML = `
        <span class="empty-emoji" aria-hidden="true">🕵️</span>
        <h3>Nothing matches that</h3>
        <p>Try a different search or filter.</p>`;
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = items.map(itemCardHTML).join("");
  }

  function lowRowHTML(item) {
    const onList = hasOpenEntry(item.id);
    return `
      <div class="low-row">
        <span class="low-emoji" aria-hidden="true">${item.emoji}</span>
        <div class="low-info">
          <strong>${esc(item.name)}</strong>
          <span>${item.qty === 0 ? "None left" : item.qty + " left"} · reorder at ${item.lowAt}</span>
        </div>
        <button class="btn btn-mini${onList ? " is-added" : ""}" type="button" data-add-low="${esc(item.id)}" ${
      onList ? "disabled" : ""
    }>${onList ? "✓ On list" : "+ Add"}</button>
      </div>`;
  }

  function shopRowHTML(entry) {
    const item = entry.itemId ? state.items.find((candidate) => candidate.id === entry.itemId) : null;
    const emoji = item ? item.emoji : "🛍️";
    return `
      <li class="shop-row${entry.done ? " done" : ""}" data-id="${esc(entry.id)}">
        <input class="shop-check" type="checkbox" ${entry.done ? "checked" : ""} aria-label="Mark ${esc(
      entry.name
    )} as bought" />
        <span class="shop-emoji" aria-hidden="true">${emoji}</span>
        <div class="shop-name-wrap">
          <span class="shop-name">${esc(entry.name)}</span>
          <span class="shop-meta">${money(entry.price)} each${item ? " · restocks your stock" : ""}</span>
        </div>
        <div class="stepper stepper-sm" role="group" aria-label="Quantity of ${esc(entry.name)} to buy">
          <button type="button" data-act="shop-dec" aria-label="Buy one less ${esc(entry.name)}">−</button>
          <span class="qty">${entry.qty}</span>
          <button type="button" data-act="shop-inc" aria-label="Buy one more ${esc(entry.name)}">+</button>
        </div>
        <span class="shop-subtotal">${money(entry.price * entry.qty)}</span>
        <button class="icon-btn shop-del" type="button" data-act="shop-del" title="Remove" aria-label="Remove ${esc(
          entry.name
        )} from the list">🗑️</button>
      </li>`;
  }

  function renderShopping() {
    const lowItems = state.items
      .filter(isLow)
      .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name));

    el("lowList").innerHTML = lowItems.length
      ? lowItems.map(lowRowHTML).join("")
      : `<p class="all-good">Everything is nicely stocked. Treat yourself! 🎉</p>`;

    const allLowOnList = lowItems.length > 0 && lowItems.every((item) => hasOpenEntry(item.id));
    const addAllBtn = el("addAllLow");
    addAllBtn.disabled = lowItems.length === 0 || allLowOnList;
    addAllBtn.textContent = allLowOnList ? "✓ All on list" : "Add all to list";

    const listEl = el("shopList");
    const emptyEl = el("shopEmpty");
    const summaryEl = el("shopSummary");

    if (state.shopping.length === 0) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      emptyEl.innerHTML = `
        <span class="empty-emoji" aria-hidden="true">📝</span>
        <h3>Nothing on the list yet</h3>
        <p>Add items above, or pull in the things that are running low.</p>`;
      summaryEl.classList.add("hidden");
      el("shopHint").textContent = "Tick things off as you shop.";
      return;
    }

    emptyEl.classList.add("hidden");
    summaryEl.classList.remove("hidden");
    listEl.innerHTML = state.shopping.map(shopRowHTML).join("");
    updateShopSummary();
  }

  function updateShopSummary() {
    const total = state.shopping.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
    const checked = state.shopping.filter((entry) => entry.done);
    const checkedTotal = checked.reduce((sum, entry) => sum + entry.price * entry.qty, 0);
    const itemWord = state.shopping.length === 1 ? "item" : "items";

    el("shopTotal").textContent = money(total);
    el("shopMeta").textContent = `${state.shopping.length} ${itemWord} · ${checked.length} checked (${money(
      checkedTotal
    )})`;
    el("restockBtn").disabled = checked.length === 0;
    el("clearDoneBtn").disabled = checked.length === 0;
    el("shopHint").textContent = checked.length
      ? "Nice! Restock the checked items when you get home."
      : "Tick things off as you shop.";
  }

  function renderAll() {
    renderStock();
    renderShopping();
    renderStats();
  }

  /* ---------------- form / edit state ---------------- */

  function exitEditMode() {
    state.editingId = null;
    el("formTitle").textContent = "Add something to your stock";
    el("formHint").textContent = "Name, price and how many you have.";
    el("submitBtn").textContent = "➕ Add to stock";
    el("cancelEdit").classList.add("hidden");
  }

  function resetItemForm() {
    el("itemForm").reset();
    el("itemCategory").value = "cooking";
    el("itemQty").value = 1;
    el("itemLow").value = 1;
    exitEditMode();
  }

  function startEdit(item) {
    state.editingId = item.id;
    el("itemName").value = item.name;
    el("itemCategory").value = item.category;
    el("itemPrice").value = item.price ? item.price.toFixed(2) : "";
    el("itemQty").value = item.qty;
    el("itemLow").value = item.lowAt;

    el("formTitle").textContent = "Editing " + item.name;
    el("formHint").textContent = "Change anything, then save.";
    el("submitBtn").textContent = "💾 Save changes";
    el("cancelEdit").classList.remove("hidden");

    setTab("stock", false);
    el("itemForm").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => {
      el("itemName").focus({ preventScroll: true });
    }, reduceMotion ? 0 : 320);
  }

  /* ---------------- item actions ---------------- */

  function handleItemSubmit(event) {
    event.preventDefault();

    const name = el("itemName").value.trim();
    if (!name) {
      toast("Give your item a name first 🙂", "warn");
      el("itemName").focus();
      return;
    }

    const category = el("itemCategory").value === "home" ? "home" : "cooking";
    const price = toPrice(el("itemPrice").value);
    const qty = toCount(el("itemQty").value, 0);
    const lowAt = toCount(el("itemLow").value, 1);

    if (state.editingId) {
      const item = state.items.find((candidate) => candidate.id === state.editingId);
      if (!item) {
        resetItemForm();
        return;
      }
      item.name = name;
      item.category = category;
      item.emoji = detectEmoji(name, category);
      item.price = price;
      item.qty = qty;
      item.lowAt = lowAt;

      state.shopping.forEach((entry) => {
        if (entry.itemId === item.id) entry.name = name;
      });

      save();
      resetItemForm();
      renderAll();
      toast(`Saved changes to ${name} ✅`, "success");
      return;
    }

    const item = {
      id: uid(),
      name,
      category,
      emoji: detectEmoji(name, category),
      price,
      qty,
      lowAt,
    };

    state.items.unshift(item);
    save();
    renderAll();
    resetItemForm();

    if (isLow(item)) {
      toast(`${name} added — heads up, it's already low ⚠️`, "warn");
    } else {
      toast(`${name} added to your stock 🎉`, "success");
      celebrate(14);
    }
    el("itemName").focus();
  }

  async function handleStockClick(event) {
    const button = event.target.closest("button[data-act]");
    if (!button) return;

    const card = button.closest("[data-id]");
    if (!card) return;

    const item = state.items.find((candidate) => candidate.id === card.dataset.id);
    if (!item) return;

    const action = button.dataset.act;

    if (action === "inc") {
      item.qty += 1;
      save();
      renderAll();
      return;
    }

    if (action === "dec") {
      if (item.qty <= 0) {
        toast(`${item.name} is already at zero. Time to shop? 🛒`, "warn");
        return;
      }
      const wasLow = isLow(item);
      item.qty -= 1;
      save();
      renderAll();
      if (!wasLow && isLow(item)) {
        toast(`${item.name} is running low ⚠️`, "warn");
      }
      return;
    }

    if (action === "edit") {
      startEdit(item);
      return;
    }

    if (action === "delete") {
      const ok = await confirmAction({
        title: `Delete ${item.name}?`,
        text: "This removes it from your stock and unlinks it from your shopping list.",
        confirmLabel: "Delete item",
      });
      if (!ok) return;

      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      state.shopping.forEach((entry) => {
        if (entry.itemId === item.id) entry.itemId = null;
      });
      if (state.editingId === item.id) resetItemForm();
      save();
      renderAll();
      toast(`${item.name} deleted 🗑️`);
    }
  }

  /* ---------------- shopping actions ---------------- */

  function addLowItem(item) {
    if (hasOpenEntry(item.id)) {
      toast(`${item.name} is already on your list 👌`);
      return;
    }
    state.shopping.unshift(suggestedEntry(item));
    save();
    renderAll();
    toast(`${item.name} added to your list 🛒`, "success");
  }

  function handleLowListClick(event) {
    const button = event.target.closest("[data-add-low]");
    if (!button) return;
    const item = state.items.find((candidate) => candidate.id === button.dataset.addLow);
    if (item) addLowItem(item);
  }

  function addAllLow() {
    let added = 0;
    state.items
      .filter(isLow)
      .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name))
      .forEach((item) => {
        if (hasOpenEntry(item.id)) return;
        state.shopping.push(suggestedEntry(item));
        added += 1;
      });

    if (added === 0) {
      toast("Everything low is already on your list 👌");
      return;
    }

    save();
    renderAll();
    toast(`Added ${added} ${added === 1 ? "item" : "items"} to your list 🛒`, "success");
  }

  function handleShopSubmit(event) {
    event.preventDefault();

    const name = el("shopName").value.trim();
    if (!name) {
      toast("What do you need? Give it a name 🙂", "warn");
      return;
    }

    const qty = Math.max(1, toCount(el("shopQty").value, 1));
    const priceRaw = el("shopPrice").value.trim();
    const price = priceRaw === "" ? 0 : toPrice(priceRaw);
    const match = state.items.find((item) => item.name.toLowerCase() === name.toLowerCase());

    const existing = state.shopping.find(
      (entry) => !entry.done && entry.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      existing.qty += qty;
      if (priceRaw !== "") existing.price = price;
      save();
      renderAll();
      el("shopForm").reset();
      el("shopQty").value = 1;
      toast(`${existing.name} is now ×${existing.qty} on your list 🛒`, "success");
      el("shopName").focus();
      return;
    }

    state.shopping.unshift({
      id: uid(),
      itemId: match ? match.id : null,
      name: match ? match.name : name,
      qty,
      price: priceRaw === "" && match ? match.price : price,
      done: false,
    });

    save();
    renderAll();
    el("shopForm").reset();
    el("shopQty").value = 1;
    toast(`${name} added to your list 🛒`, "success");
    el("shopName").focus();
  }

  function handleShopListClick(event) {
    const button = event.target.closest("button[data-act]");
    if (!button) return;

    const row = button.closest("[data-id]");
    if (!row) return;

    const entry = state.shopping.find((candidate) => candidate.id === row.dataset.id);
    if (!entry) return;

    const action = button.dataset.act;

    if (action === "shop-inc") {
      entry.qty += 1;
    } else if (action === "shop-dec") {
      if (entry.qty <= 1) return;
      entry.qty -= 1;
    } else if (action === "shop-del") {
      state.shopping = state.shopping.filter((candidate) => candidate.id !== entry.id);
      save();
      renderAll();
      toast(`${entry.name} removed from the list`);
      return;
    }

    save();
    row.querySelector(".qty").textContent = entry.qty;
    row.querySelector(".shop-subtotal").textContent = money(entry.price * entry.qty);
    updateShopSummary();
    renderStats();
  }

  function handleShopToggle(event) {
    if (!event.target.classList.contains("shop-check")) return;

    const row = event.target.closest("[data-id]");
    if (!row) return;

    const entry = state.shopping.find((candidate) => candidate.id === row.dataset.id);
    if (!entry) return;

    entry.done = event.target.checked;
    row.classList.toggle("done", entry.done);
    save();
    updateShopSummary();
    renderStats();
  }

  function restockChecked() {
    const checked = state.shopping.filter((entry) => entry.done);
    if (checked.length === 0) {
      toast("Tick off what you bought first 🙂", "warn");
      return;
    }

    let restocked = 0;
    checked.forEach((entry) => {
      if (!entry.itemId) return;
      const item = state.items.find((candidate) => candidate.id === entry.itemId);
      if (item) {
        item.qty += entry.qty;
        restocked += 1;
      }
    });

    state.shopping = state.shopping.filter((entry) => !entry.done);
    save();
    renderAll();

    if (restocked > 0) {
      toast(
        `Restocked ${restocked} ${restocked === 1 ? "item" : "items"} — shelves look happy! 🎉`,
        "success"
      );
      celebrate(30);
    } else {
      toast("Checked items cleared 🧹", "success");
    }
  }

  function clearChecked() {
    const checked = state.shopping.filter((entry) => entry.done);
    if (checked.length === 0) {
      toast("Nothing is checked yet 🙂", "warn");
      return;
    }
    state.shopping = state.shopping.filter((entry) => !entry.done);
    save();
    renderAll();
    toast(`Cleared ${checked.length} checked ${checked.length === 1 ? "item" : "items"} 🧹`);
  }

  async function clearAll() {
    if (state.shopping.length === 0) return;
    const ok = await confirmAction({
      title: "Clear the whole list?",
      text: "All shopping entries will be removed. Your stock stays safe.",
      confirmLabel: "Clear list",
    });
    if (!ok) return;

    state.shopping = [];
    save();
    renderAll();
    toast("Shopping list cleared 🧹");
  }

  /* ---------------- tabs ---------------- */

  function setTab(tab, scroll = true) {
    const showStock = tab === "stock";
    el("stockPanel").classList.toggle("hidden", !showStock);
    el("shoppingPanel").classList.toggle("hidden", showStock);
    el("tabStock").classList.toggle("is-active", showStock);
    el("tabShopping").classList.toggle("is-active", !showStock);
    el("tabStock").setAttribute("aria-selected", String(showStock));
    el("tabShopping").setAttribute("aria-selected", String(!showStock));

    if (scroll && window.scrollY > 180) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  /* ---------------- toast, confetti, dialog ---------------- */

  let toastTimer = null;

  function toast(message, type = "info") {
    const node = el("toast");
    node.textContent = message;
    node.className = "toast show" + (type === "info" ? "" : " " + type);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function celebrate(count = 24) {
    if (reduceMotion) return;
    const layer = el("confetti");
    const chars = ["🎉", "✨", "🛒", "🍎", "🥳", "💫", "🍞", "🧻"];
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.textContent = chars[Math.floor(Math.random() * chars.length)];
      piece.style.left = Math.random() * 100 + "%";
      piece.style.fontSize = 12 + Math.random() * 16 + "px";
      piece.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
      piece.style.animationDelay = Math.random() * 0.3 + "s";
      layer.appendChild(piece);
      window.setTimeout(() => piece.remove(), 3400);
    }
  }

  function confirmAction({ title, text, confirmLabel = "Delete" }) {
    const dialog = el("confirmDialog");

    if (typeof dialog.showModal !== "function") {
      return Promise.resolve(window.confirm(`${title}\n\n${text}`));
    }

    el("confirmTitle").textContent = title;
    el("confirmText").textContent = text;
    el("confirmBtn").textContent = confirmLabel;
    dialog.returnValue = "";
    dialog.showModal();

    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), {
        once: true,
      });
    });
  }

  /* ---------------- events ---------------- */

  function bindEvents() {
    el("itemForm").addEventListener("submit", handleItemSubmit);
    el("cancelEdit").addEventListener("click", () => {
      resetItemForm();
      toast("Edit cancelled");
    });
    el("stockList").addEventListener("click", handleStockClick);

    el("searchInput").addEventListener("input", (event) => {
      state.search = event.target.value;
      renderStock();
    });

    el("filters").addEventListener("click", (event) => {
      const button = event.target.closest(".filter");
      if (!button) return;
      state.filter = button.dataset.filter;
      el("filters")
        .querySelectorAll(".filter")
        .forEach((chip) => chip.classList.toggle("is-active", chip === button));
      renderStock();
    });

    el("tabStock").addEventListener("click", () => setTab("stock"));
    el("tabShopping").addEventListener("click", () => setTab("shopping"));

    el("shopForm").addEventListener("submit", handleShopSubmit);
    el("shopList").addEventListener("click", handleShopListClick);
    el("shopList").addEventListener("change", handleShopToggle);

    el("lowList").addEventListener("click", handleLowListClick);
    el("addAllLow").addEventListener("click", addAllLow);

    el("restockBtn").addEventListener("click", restockChecked);
    el("clearDoneBtn").addEventListener("click", clearChecked);
    el("clearAllBtn").addEventListener("click", clearAll);

    const dialog = el("confirmDialog");
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
  }

  /* ---------------- start ---------------- */

  function init() {
    load();
    bindEvents();
    renderAll();
    setTab("stock", false);
  }

  init();
})();
