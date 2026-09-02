const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const LICENSE_API = "https://api.lemonsqueezy.com/v1/licenses";
const TRANSLATIONS = window.HLF_TRANSLATIONS || {};
const ESTIMATE_TRANSLATIONS = window.HLF_ESTIMATE_TRANSLATIONS || {};
const RTL_LANGUAGES = new Set(["ar", "ur"]);
const DB_NAME = "haz-la-factura";
const DB_VERSION = 1;
const COMPANY_PROFILE_KEY = "hlf-pro-company-profile";
let historyCache = [];
let databasePromise;
let databaseAvailable = true;
let historySort = { field: "number", direction: "asc" };
const VALUE_IDS = [
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "currency",
  "issuerName",
  "issuerTax",
  "issuerAddress",
  "issuerCountry",
  "issuerEmail",
  "clientName",
  "clientTax",
  "clientAddress",
  "clientCountry",
  "clientEmail",
  "vat",
  "irpf",
  "taxTreatment",
  "taxMention",
  "notes",
  "seriesPrefix",
  "documentStatus",
  "originalInvoiceNumber",
  "originalInvoiceDate",
  "correctionReason",
  "estimateStartDate",
  "estimateDeliveryDate",
  "estimateDeposit",
  "paymentDate",
  "paymentMethod",
  "amountPaid",
];
const TYPE_LABELS = {
  invoice: "Factura",
  estimate: "Presupuesto",
  simplified: "Factura simplificada",
  corrective: "Factura rectificativa",
};
const STATUS_LABELS = {
  draft: "Borrador",
  issued: "Emitido",
  sent: "Enviado",
  accepted: "Aceptado",
  paid: "Cobrado",
  overdue: "Vencido",
  cancelled: "Anulado",
  rectified: "Rectificado",
  rejected: "Rechazado",
};
const PREFIXES = {
  invoice: "FAC",
  estimate: "PRE",
  simplified: "FS",
  corrective: "REC",
};
const TAX_MENTIONS = {
  standard: "",
  exempt: "Operación exenta de IVA. Motivo y referencia normativa: ",
  "not-subject": "Operación no sujeta a IVA. Motivo y referencia normativa: ",
  "reverse-charge": "Inversión del sujeto pasivo.",
  "intra-eu":
    "Operación intracomunitaria. Inversión del sujeto pasivo cuando resulte aplicable.",
  export:
    "Operación exenta por exportación cuando se cumplan los requisitos aplicables.",
  custom: "",
};
const TAX_MENTION_TRANSLATIONS = {
  en: {
    exempt: "VAT-exempt transaction. Reason and legal reference: ",
    "not-subject":
      "Transaction not subject to VAT. Reason and legal reference: ",
    "reverse-charge": "Reverse charge applies.",
    "intra-eu":
      "Intra-Community transaction. Reverse charge applies where applicable.",
    export: "Export exempt from VAT where the applicable requirements are met.",
  },
  ca: {
    exempt: "Operació exempta d’IVA. Motiu i referència normativa: ",
    "not-subject": "Operació no subjecta a IVA. Motiu i referència normativa: ",
    "reverse-charge": "Inversió del subjecte passiu.",
    "intra-eu":
      "Operació intracomunitària. Inversió del subjecte passiu quan sigui aplicable.",
    export:
      "Operació exempta per exportació quan es compleixin els requisits aplicables.",
  },
  "ca-valencia": {
    exempt: "Operació exempta d’IVA. Motiu i referència normativa: ",
    "not-subject": "Operació no subjecta a IVA. Motiu i referència normativa: ",
    "reverse-charge": "Inversió del subjecte passiu.",
    "intra-eu":
      "Operació intracomunitària. Inversió del subjecte passiu quan siga aplicable.",
    export:
      "Operació exempta per exportació quan es complisquen els requisits aplicables.",
  },
  gl: {
    exempt: "Operación exenta de IVE. Motivo e referencia normativa: ",
    "not-subject":
      "Operación non suxeita a IVE. Motivo e referencia normativa: ",
    "reverse-charge": "Inversión do suxeito pasivo.",
    "intra-eu":
      "Operación intracomunitaria. Inversión do suxeito pasivo cando resulte aplicable.",
    export:
      "Operación exenta por exportación cando se cumpran os requisitos aplicables.",
  },
  eu: {
    exempt:
      "BEZetik salbuetsitako eragiketa. Arrazoia eta arau-erreferentzia: ",
    "not-subject":
      "BEZari lotu gabeko eragiketa. Arrazoia eta arau-erreferentzia: ",
    "reverse-charge": "Subjektu pasiboaren inbertsioa.",
    "intra-eu":
      "Europar Batasunaren barruko eragiketa. Subjektu pasiboaren inbertsioa, aplikagarria denean.",
    export:
      "Esportazioagatik salbuetsitako eragiketa, aplikatu beharreko baldintzak betetzen direnean.",
  },
};

const state = {
  items: [newItem("Servicios profesionales", 1, 1000, 21, 0, 0)],
  pro: {
    active: false,
    documentType: "invoice",
    template: "classic",
    invoiceLanguage: "es",
    brandColor: "#1f654a",
    logo: "",
    includeSimplifiedRecipient: false,
    automaticNumber: true,
    hasPayment: false,
  },
  meta: {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fingerprint: "",
  },
};

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("documents"))
          database.createObjectStore("documents", { keyPath: "meta.id" });
        if (!database.objectStoreNames.contains("assets"))
          database.createObjectStore("assets", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("La base de datos local está bloqueada por otra pestaña."),
        );
    });
  }
  return databasePromise;
}
async function idbGetAll(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
async function idbGet(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function idbPut(storeName, value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
async function replaceDocuments(documents) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("documents", "readwrite"),
      store = transaction.objectStore("documents");
    store.clear();
    documents.forEach((document) => store.put(document));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
async function initializeLocalDatabase() {
  await openDatabase();
  let documents = await idbGetAll("documents");
  const legacyHistory = localStorage.getItem("hlf-pro-history");
  if (!documents.length && legacyHistory) {
    try {
      const migrated = JSON.parse(legacyHistory).map(migrate);
      await replaceDocuments(migrated);
      documents = await idbGetAll("documents");
      if (documents.length === migrated.length)
        localStorage.removeItem("hlf-pro-history");
    } catch (error) {
      console.warn("No se pudo migrar el historial anterior.", error);
    }
  }
  const embeddedLogo = documents.find((document) => document.pro?.logo)?.pro
    ?.logo;
  if (embeddedLogo) {
    await idbPut("assets", { key: "brand-logo", value: embeddedLogo });
    documents.forEach((document) => {
      if (document.pro) delete document.pro.logo;
    });
    await replaceDocuments(documents);
  }
  historyCache = documents
    .map(migrate)
    .sort((a, b) => new Date(b.meta.updatedAt) - new Date(a.meta.updatedAt));
  const storedDraft = localStorage.getItem("hazlafactura");
  if (storedDraft) {
    try {
      const draft = JSON.parse(storedDraft);
      if (draft.pro?.logo) {
        await idbPut("assets", { key: "brand-logo", value: draft.pro.logo });
        delete draft.pro.logo;
        localStorage.setItem("hazlafactura", JSON.stringify(draft));
      }
    } catch {}
  }
  const logo = await idbGet("assets", "brand-logo");
  if (logo?.value) state.pro.logo = logo.value;
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function newItem(
  description = "",
  quantity = 1,
  price = 0,
  vat = +$("#vat")?.value || 21,
  irpf = +$("#irpf")?.value || 0,
  discount = 0,
) {
  return { description, quantity, price, vat, irpf, discount };
}
function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[c],
  );
}
function invoiceLanguage() {
  return state.pro.active && TRANSLATIONS[state.pro.invoiceLanguage]
    ? state.pro.invoiceLanguage
    : "es";
}
function invoiceText() {
  return TRANSLATIONS[invoiceLanguage()] || TRANSLATIONS.es;
}
function generatedTaxMention(treatment, language = invoiceLanguage()) {
  if (!treatment || treatment === "standard" || treatment === "custom")
    return "";
  return (
    TAX_MENTION_TRANSLATIONS[language]?.[treatment] ||
    TAX_MENTIONS[treatment] ||
    ""
  );
}
function isGeneratedTaxMention(value) {
  return [
    ...Object.values(TAX_MENTIONS),
    ...Object.values(TAX_MENTION_TRANSLATIONS).flatMap((set) =>
      Object.values(set),
    ),
  ].includes(value);
}
function estimateText() {
  return (
    ESTIMATE_TRANSLATIONS[invoiceLanguage()] ||
    ESTIMATE_TRANSLATIONS.es || [
      "Válido hasta",
      "ACEPTACIÓN DEL PRESUPUESTO",
      "Nombre y firma del cliente",
      "Fecha",
    ]
  );
}
function money(value) {
  return new Intl.NumberFormat(invoiceLanguage(), {
    style: "currency",
    currency: $("#currency").value,
  }).format(value || 0);
}
function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat(invoiceLanguage()).format(
        new Date(`${value}T12:00:00`),
      )
    : "";
}
function party(prefix) {
  return [
    $("#" + prefix + "Name").value,
    $("#" + prefix + "Tax").value,
    $("#" + prefix + "Address").value,
    $("#" + prefix + "Country").value,
    $("#" + prefix + "Email").value,
  ]
    .filter(Boolean)
    .join("\n");
}
function currentType() {
  return state.pro.active ? state.pro.documentType : "invoice";
}
function sequenceKey(
  type = currentType(),
  prefix = $("#seriesPrefix")?.value || PREFIXES[type],
) {
  return `hlf-sequence-${type}-${prefix}-${new Date().getFullYear()}`;
}
function nextNumber(type = currentType()) {
  const prefix = $("#seriesPrefix")?.value || PREFIXES[type];
  return `${prefix}-${new Date().getFullYear()}-${String((+localStorage.getItem(sequenceKey(type, prefix)) || 0) + 1).padStart(3, "0")}`;
}
function commitNumber(type = currentType()) {
  const key = sequenceKey(type);
  localStorage.setItem(key, String((+localStorage.getItem(key) || 0) + 1));
}
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function renderItems() {
  $("#items").innerHTML = state.items
    .map(
      (item, i) => `<div class="item-row advanced-item">
    <label class="item-description">Descripción<input data-i="${i}" data-k="description" value="${escapeHtml(item.description)}" placeholder="Servicio o producto"></label>
    <label>Cantidad<input type="number" min="0" step="0.01" data-i="${i}" data-k="quantity" value="${item.quantity}"></label>
    <label>Precio<input type="number" step="0.01" data-i="${i}" data-k="price" value="${item.price}"></label>
    <label>Dto. %<input type="number" min="0" max="100" step="0.01" data-i="${i}" data-k="discount" value="${item.discount || 0}"></label>
    <label>IVA %<input type="number" min="0" max="100" step="0.01" data-i="${i}" data-k="vat" value="${item.vat || 0}"></label>
    <label>Ret. %<input type="number" min="0" max="100" step="0.01" data-i="${i}" data-k="irpf" value="${item.irpf || 0}"></label>
    <button data-remove="${i}" title="Eliminar" aria-label="Eliminar concepto">×</button></div>`,
    )
    .join("");
  $$("[data-i]").forEach((el) =>
    el.addEventListener("input", (event) => {
      const i = +event.target.dataset.i,
        key = event.target.dataset.k;
      state.items[i][key] =
        key === "description" ? event.target.value : +event.target.value || 0;
      update();
    }),
  );
  $$("[data-remove]").forEach((el) =>
    el.addEventListener("click", (event) => {
      if (state.items.length > 1) {
        state.items.splice(+event.currentTarget.dataset.remove, 1);
        renderItems();
        update();
      }
    }),
  );
}

function calculate() {
  const lines = state.items.map((item) => {
    const gross = item.quantity * item.price,
      discount = (gross * (item.discount || 0)) / 100,
      base = gross - discount,
      vat = (base * (item.vat || 0)) / 100,
      irpf = (base * (item.irpf || 0)) / 100;
    return {
      ...item,
      gross,
      discountAmount: discount,
      base,
      vatAmount: vat,
      irpfAmount: irpf,
      total: base + vat - irpf,
    };
  });
  return {
    lines,
    subtotal: lines.reduce((s, x) => s + x.gross, 0),
    discount: lines.reduce((s, x) => s + x.discountAmount, 0),
    base: lines.reduce((s, x) => s + x.base, 0),
    vat: lines.reduce((s, x) => s + x.vatAmount, 0),
    irpf: lines.reduce((s, x) => s + x.irpfAmount, 0),
    total: lines.reduce((s, x) => s + x.total, 0),
  };
}

function renderTaxBreakdown(lines) {
  const groups = new Map();
  lines.forEach((line) => {
    const key = `${line.vat}|${line.irpf}`;
    const group = groups.get(key) || {
      vat: line.vat,
      irpf: line.irpf,
      base: 0,
      vatAmount: 0,
      irpfAmount: 0,
    };
    group.base += line.base;
    group.vatAmount += line.vatAmount;
    group.irpfAmount += line.irpfAmount;
    groups.set(key, group);
  });
  $("#pTaxBreakdown").innerHTML =
    groups.size > 1
      ? `<small>DESGLOSE FISCAL</small>${[...groups.values()].map((g) => `<p><span>Base ${money(g.base)} · IVA ${g.vat}%${g.irpf ? ` · Ret. ${g.irpf}%` : ""}</span><b>${money(g.vatAmount - g.irpfAmount)}</b></p>`).join("")}`
      : "";
}

function applyProAppearance() {
  const invoice = $("#invoicePreview"),
    active = state.pro.active,
    template = active ? state.pro.template : "classic",
    color = active ? state.pro.brandColor : "#12251f",
    type = currentType(),
    logo = active ? state.pro.logo : "",
    language = invoiceLanguage(),
    text = invoiceText();
  invoice.classList.remove(
    "template-classic",
    "template-minimal",
    "template-bold",
    "template-compact",
    "template-elegant",
  );
  invoice.classList.add(`template-${template}`);
  invoice.style.setProperty("--brand-color", color);
  invoice.lang = language;
  invoice.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  const titles = {
    invoice: text[0],
    estimate: text[1],
    simplified: `${text[0]} SIMPLIFICADA`,
    corrective: `${text[0]} RECTIFICATIVA`,
  };
  $("#pDocumentTitle").textContent = titles[type];
  $("#convertEstimateBtn").hidden = !active || type !== "estimate";
  const img = $("#pLogoImage"),
    fallback = $("#pLogo span");
  img.hidden = !logo;
  fallback.hidden = !!logo;
  if (logo) img.src = logo;
}

function updateDocumentFields() {
  const type = currentType(),
    isEstimate = type === "estimate",
    isCorrective = type === "corrective",
    isSimplified = type === "simplified",
    includesRecipient = isSimplified && state.pro.includeSimplifiedRecipient;
  $("#correctiveFields").hidden = !isCorrective;
  $("#estimateFields").hidden = !isEstimate;
  document.body.classList.toggle("simplified-document", isSimplified);
  $("#simplifiedRecipientControl").hidden = !isSimplified;
  $("#simplifiedLimit").hidden = !isSimplified;
  $("#dueDateField").hidden = isSimplified;
  $("#clientSectionTitle").hidden = isSimplified && !includesRecipient;
  $("#clientFields").hidden = isSimplified && !includesRecipient;
  $("#pClientParty").hidden = isSimplified && !includesRecipient;
  $("#partiesHead").classList.toggle(
    "single-party",
    isSimplified && !includesRecipient,
  );
  $("#includeSimplifiedRecipient").checked =
    state.pro.includeSimplifiedRecipient;
  const automaticNumber = state.pro.active && state.pro.automaticNumber;
  $("#autoNumber").checked = state.pro.automaticNumber;
  $("#invoiceNumber").readOnly = automaticNumber;
  $("#invoiceNumber").setAttribute(
    "aria-readonly",
    automaticNumber ? "true" : "false",
  );
  $("#hasPayment").checked = state.pro.hasPayment;
  $("#paymentFields").hidden = !state.pro.hasPayment;
  $("#partiesTitle").textContent = isSimplified
    ? "Datos del emisor"
    : "Emisor y destinatario";
  $("#documentDataTitle").textContent = isEstimate
    ? "Cabecera del presupuesto"
    : `Cabecera de ${TYPE_LABELS[type].toLowerCase()}`;
  $("#numberFieldLabel").textContent = isEstimate
    ? "Número de presupuesto"
    : `Número de ${TYPE_LABELS[type].toLowerCase()}`;
  $("#dateFieldLabel").textContent = isEstimate
    ? "Fecha del presupuesto"
    : "Fecha de emisión";
  $("#dueDateFieldLabel").textContent = isEstimate
    ? "Oferta válida hasta"
    : "Fecha de vencimiento";
  $("#notesFieldLabel").textContent = isEstimate
    ? "Condiciones del presupuesto"
    : "Notas y condiciones de pago";
  $("#estimateAcceptance").hidden = !isEstimate;
}

function update() {
  const text = invoiceText(),
    estimateLabels = estimateText(),
    type = currentType(),
    isEstimate = type === "estimate",
    totals = calculate();
  updateDocumentFields();
  $("#pIssuerLabel").textContent = text[4];
  $("#pClientLabel").textContent = text[5];
  $("#pConceptLabel").textContent = text[6];
  $("#pQuantityLabel").textContent = text[7];
  $("#pPriceLabel").textContent = text[8];
  $("#pLineTotalLabel").textContent = text[9];
  $("#pSubtotalLabel").textContent = text[10];
  $("#pDiscountLabel").textContent = text[11];
  $("#pGrandTotalLabel").textContent = text[9];
  $("#pNotesLabel").textContent = text[14];
  $("#freeWatermark").textContent = text[16];
  $("#pIssuerName").textContent = $("#issuerName").value || text[17];
  $("#pInvoiceNumber").textContent = $("#invoiceNumber").value;
  $("#pInvoiceDate").textContent =
    `${text[2]}: ${formatDate($("#invoiceDate").value)}${type !== "simplified" && $("#dueDate").value ? ` · ${isEstimate ? estimateLabels[0] : text[3]}: ${formatDate($("#dueDate").value)}` : ""}`;
  $("#pIssuer").textContent = party("issuer") || text[18];
  $("#pClient").textContent = party("client") || text[19];
  $("#pItems").innerHTML = totals.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.description) || "—"}${line.discount ? `<small class="line-tax">Dto. ${line.discount}% · IVA ${line.vat}%${line.irpf ? ` · Ret. ${line.irpf}%` : ""}</small>` : `<small class="line-tax">IVA ${line.vat}%${line.irpf ? ` · Ret. ${line.irpf}%` : ""}</small>`}</td><td>${line.quantity}</td><td>${money(line.price)}</td><td>${money(line.total)}</td></tr>`,
    )
    .join("");
  $("#pSubtotal").textContent = money(totals.subtotal);
  $("#pDiscount").textContent = `− ${money(totals.discount)}`;
  $("#pDiscountRow").hidden = !totals.discount;
  $("#pVatLabel").textContent = text[12];
  $("#pVat").textContent = money(totals.vat);
  $("#pIrpfLabel").textContent = text[13];
  $("#pIrpf").textContent = `− ${money(totals.irpf)}`;
  $("#pIrpfRow").hidden = !totals.irpf;
  $("#pTotal").textContent = money(totals.total);
  renderTaxBreakdown(totals.lines);
  $("#pNotes").textContent = $("#notes").value || text[15];
  $("#pAcceptanceLabel").textContent = estimateLabels[1];
  $("#pAcceptanceName").textContent = estimateLabels[2];
  $("#pAcceptanceDate").textContent = estimateLabels[3];
  const mention = $("#taxMention").value.trim();
  $("#pTaxMention").hidden = !mention;
  $("#pTaxMention").textContent = mention;
  const references = [];
  if (type === "corrective")
    references.push(
      `Rectifica la factura ${$("#originalInvoiceNumber").value || "—"}${$("#originalInvoiceDate").value ? ` de ${formatDate($("#originalInvoiceDate").value)}` : ""}. Motivo: ${$("#correctionReason").value || "sin indicar"}.`,
    );
  if (isEstimate) {
    if ($("#estimateStartDate").value)
      references.push(
        `Inicio estimado: ${formatDate($("#estimateStartDate").value)}.`,
      );
    if ($("#estimateDeliveryDate").value)
      references.push(
        `Entrega estimada: ${formatDate($("#estimateDeliveryDate").value)}.`,
      );
    if (+$("#estimateDeposit").value)
      references.push(`Anticipo solicitado: ${$("#estimateDeposit").value} %.`);
  }
  $("#pDocumentReference").hidden = !references.length;
  $("#pDocumentReference").textContent = references.join(" ");
  const payment = [];
  if ($("#documentStatus").value === "paid") payment.push("Estado: cobrada.");
  if ($("#paymentDate").value)
    payment.push(`Fecha de pago: ${formatDate($("#paymentDate").value)}.`);
  if ($("#paymentMethod").value.trim())
    payment.push(`Método: ${$("#paymentMethod").value.trim()}.`);
  if (+$("#amountPaid").value > 0) {
    payment.push(`Importe cobrado: ${money(+$("#amountPaid").value)}.`);
    const pending = Math.max(0, totals.total - +$("#amountPaid").value);
    if (pending) payment.push(`Pendiente: ${money(pending)}.`);
  }
  $("#pPaymentSummary").hidden =
    !state.pro.active || !state.pro.hasPayment || !payment.length || isEstimate;
  $("#pPaymentDetails").textContent = payment.join(" ");
  $("#euTaxHelp").hidden = !["intra-eu", "reverse-charge", "export"].includes(
    $("#taxTreatment").value,
  );
  applyProAppearance();
  state.meta.updatedAt = new Date().toISOString();
  saveDraft();
}

function snapshot(includeAssets = true) {
  const values = {};
  VALUE_IDS.forEach((id) => {
    if ($("#" + id)) values[id] = $("#" + id).value;
  });
  return {
    version: 5,
    values,
    items: state.items,
    pro: {
      documentType: state.pro.documentType,
      template: state.pro.template,
      invoiceLanguage: state.pro.invoiceLanguage,
      brandColor: state.pro.brandColor,
      includeSimplifiedRecipient: state.pro.includeSimplifiedRecipient,
      automaticNumber: state.pro.automaticNumber,
      hasPayment: state.pro.hasPayment,
      ...(includeAssets && state.pro.logo ? { logo: state.pro.logo } : {}),
    },
    meta: { ...state.meta },
  };
}
function saveDraft() {
  localStorage.setItem("hazlafactura", JSON.stringify(snapshot(false)));
}
function migrate(data) {
  if (!data) return data;
  data.version ||= 1;
  if (data.items)
    data.items = data.items.map((item) => ({
      description: item.description || "",
      quantity: +item.quantity || 0,
      price: +item.price || 0,
      vat: item.vat ?? +(data.values?.vat || 0),
      irpf: item.irpf ?? +(data.values?.irpf || 0),
      discount: item.discount ?? +(data.values?.discount || 0),
    }));
  data.meta ||= {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fingerprint: "",
  };
  data.pro ||= {};
  if (typeof data.pro.automaticNumber !== "boolean")
    data.pro.automaticNumber = true;
  if (typeof data.pro.hasPayment !== "boolean")
    data.pro.hasPayment = Boolean(
      data.values?.paymentDate ||
        data.values?.paymentMethod ||
        +data.values?.amountPaid,
    );
  return data;
}
function load(raw, migrateDraft = false) {
  const data = migrate(raw);
  if (!data) return;
  Object.entries(data.values || {}).forEach(([id, value]) => {
    if ($("#" + id)) $("#" + id).value = value;
  });
  if (
    migrateDraft &&
    data.pro?.documentType !== "estimate" &&
    /^HLF-\d{4}-\d+$/.test($("#invoiceNumber").value)
  )
    $("#invoiceNumber").value = $("#invoiceNumber").value.replace(
      /^HLF-/,
      "FAC-",
    );
  if (Array.isArray(data.items) && data.items.length) state.items = data.items;
  if (data.pro) {
    Object.assign(state.pro, data.pro);
    if (data.pro.logo)
      idbPut("assets", { key: "brand-logo", value: data.pro.logo }).catch(
        console.error,
      );
  }
  state.meta = data.meta;
  syncProInputs();
  renderItems();
  update();
}
function download(name, content, type = "application/json") {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 500);
}

function setProActive(active) {
  state.pro.active = active;
  document.body.classList.toggle("pro-active", active);
  $("#proControls").hidden = !active;
  $("#proDocumentFields").hidden = !active;
  $("#historyPanel").hidden = !active;
  if ($("#archiveDrawer")) $("#archiveDrawer").hidden = !active;
  if ($("#integratedProTools")) $("#integratedProTools").hidden = !active;
  if ($("#workspaceTools")) $("#workspaceTools").hidden = !active;
  document.querySelector(".pro-tools").hidden = !active;
  $("#documentToolbar").hidden = !active;
  $("#documentTypeControl").hidden = !active;
  $("#tutorialBtn").hidden = !active;
  $("#releaseLicenseBtn").hidden = !active;
  $("#proAccessBtn").textContent = active ? "Pro activo" : "Activar licencia";
  $("#proAccessBtn").disabled = active;
  $("#proStatus").textContent = active
    ? "Licencia activa en este navegador. Tus datos siguen siendo locales."
    : "Personalización, presupuestos, historial y numeración automática.";
  $("#freeWatermark").hidden = active;
  if (active) {
    syncProInputs();
    renderHistory();
    checkBackupReminder();
  }
}
function syncProInputs() {
  if (!state.pro.active) return;
  $("#documentType").value = state.pro.documentType;
  $("#template").value = state.pro.template;
  $("#invoiceLanguage").value = state.pro.invoiceLanguage || "es";
  $("#brandColor").value = state.pro.brandColor;
  $("#autoNumber").checked = state.pro.automaticNumber;
  $("#hasPayment").checked = state.pro.hasPayment;
}

async function validateLicense() {
  const key = $("#licenseKey").value.trim(),
    message = $("#licenseMessage"),
    button = $("#validateLicenseBtn");
  if (!key) {
    message.textContent = "Introduce una clave de licencia.";
    return;
  }
  button.disabled = true;
  button.textContent = "Validando…";
  message.textContent = "Conectando con Lemon Squeezy…";
  try {
    const storedKey = localStorage.getItem("hlf-pro-license"),
      storedInstance = localStorage.getItem("hlf-pro-instance"),
      reuse = storedKey === key && storedInstance,
      body = new URLSearchParams({ license_key: key });
    if (reuse) body.set("instance_id", storedInstance);
    else
      body.set(
        "instance_name",
        `Haz la Factura · ${navigator.platform || "navegador"}`,
      );
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(
      `${LICENSE_API}/${reuse ? "validate" : "activate"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    const data = await response.json(),
      product = String(data.meta?.product_name || "").toLowerCase(),
      accepted = reuse ? data.valid : data.activated;
    if (!response.ok || !accepted || !product.includes("haz la factura"))
      throw new Error(
        data.error || "La clave no corresponde a Haz la Factura Pro.",
      );
    localStorage.setItem("hlf-pro-license", key);
    if (data.instance?.id)
      localStorage.setItem("hlf-pro-instance", data.instance.id);
    localStorage.setItem("hlf-pro-license-check", String(Date.now()));
    setProActive(true);
    $("#licenseDialog").close();
    update();
    $("#tutorialDialog").showModal();
  } catch (error) {
    message.textContent =
      error.name === "AbortError"
        ? "La validación está tardando demasiado."
        : error.message || "No se pudo validar la licencia.";
  } finally {
    button.disabled = false;
    button.textContent = "Validar y activar";
  }
}
async function restoreLicense() {
  const key = localStorage.getItem("hlf-pro-license"),
    instance = localStorage.getItem("hlf-pro-instance");
  if (!key || !instance) return;
  const last = +localStorage.getItem("hlf-pro-license-check") || 0;
  if (Date.now() - last < 7 * 864e5) {
    setProActive(true);
    update();
    return;
  }
  try {
    const body = new URLSearchParams({
        license_key: key,
        instance_id: instance,
      }),
      response = await fetch(`${LICENSE_API}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
      data = await response.json();
    if (
      data.valid &&
      String(data.meta?.product_name || "")
        .toLowerCase()
        .includes("haz la factura")
    ) {
      localStorage.setItem("hlf-pro-license-check", String(Date.now()));
      setProActive(true);
      update();
    } else clearLocalLicense();
  } catch {
    setProActive(true);
    update();
  }
}
function clearLocalLicense() {
  ["hlf-pro-license", "hlf-pro-instance", "hlf-pro-license-check"].forEach(
    (key) => localStorage.removeItem(key),
  );
}
async function releaseLicense() {
  if (
    !confirm(
      "¿Liberar la licencia de este navegador? Tus documentos locales no se borrarán.",
    )
  )
    return;
  const key = localStorage.getItem("hlf-pro-license"),
    instance = localStorage.getItem("hlf-pro-instance"),
    button = $("#releaseLicenseBtn");
  if (!key || !instance) {
    clearLocalLicense();
    setProActive(false);
    update();
    return;
  }
  button.disabled = true;
  button.textContent = "Liberando…";
  try {
    const body = new URLSearchParams({
        license_key: key,
        instance_id: instance,
      }),
      response = await fetch(`${LICENSE_API}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
      data = await response.json();
    if (!response.ok || !data.deactivated)
      throw new Error(data.error || "No se pudo liberar la licencia.");
    clearLocalLicense();
    setProActive(false);
    update();
    alert("Licencia liberada.");
  } catch (error) {
    alert(error.message || "No se pudo liberar la licencia.");
  } finally {
    button.disabled = false;
    button.textContent = "Liberar licencia";
  }
}

function getHistory() {
  return historyCache;
}
function setHistory(list) {
  historyCache = [...list].sort(
    (a, b) => new Date(b.meta.updatedAt) - new Date(a.meta.updatedAt),
  );
  if (!databaseAvailable) {
    localStorage.setItem("hlf-pro-history", JSON.stringify(historyCache));
    return Promise.resolve();
  }
  return replaceDocuments(historyCache).catch((error) => {
    console.error("No se pudo guardar el archivo local.", error);
    alert(
      "No se ha podido guardar el archivo local. Exporta una copia antes de continuar.",
    );
  });
}
function effectiveStatus(doc) {
  const status = doc.values.documentStatus || "draft",
    due = doc.values.dueDate;
  return !["paid", "cancelled", "rectified"].includes(status) &&
    due &&
    due < new Date().toISOString().slice(0, 10)
    ? "overdue"
    : status;
}
function overdueDays(doc) {
  if (effectiveStatus(doc) !== "overdue" || !doc.values.dueDate) return 0;
  const due = new Date(`${doc.values.dueDate}T12:00:00`),
    today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 864e5));
}
function collectionText(doc, formal = false) {
  const total = calculateDocument(doc),
    number = doc.values.invoiceNumber,
    due = doc.values.dueDate || "sin fecha indicada",
    client = doc.values.clientName || "cliente";
  return formal
    ? `Asunto: Requerimiento de pago de la factura ${number}\n\nA la atención de ${client}: la factura ${number}, por ${moneyFor(doc, total)}, venció el ${due} y continúa pendiente. Solicitamos su abono y confirmación de pago. Este mensaje no sustituye asesoramiento jurídico.`
    : `Hola, te escribo por la factura ${number}, por ${moneyFor(doc, total)}, con vencimiento ${due}. ¿Puedes confirmar que está aprobada y la fecha prevista de pago? Adjunto de nuevo la factura. Gracias.`;
}
function calculateDocument(doc) {
  return (doc.items || []).reduce((sum, item) => {
    const gross = (+item.quantity || 0) * (+item.price || 0),
      base = gross * (1 - (+item.discount || 0) / 100);
    return sum + base * (1 + (+item.vat || 0) / 100 - (+item.irpf || 0) / 100);
  }, 0);
}
function moneyFor(doc, value) {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: doc.values.currency || "EUR",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${doc.values.currency || "EUR"}`;
  }
}
function renderHistoryLegacy() {
  let list = getHistory(),
    query = $("#historySearch")?.value.toLowerCase() || "",
    type = $("#historyTypeFilter")?.value || "",
    status = $("#historyStatusFilter")?.value || "";
  list = list.filter(
    (doc) =>
      (!query ||
        `${doc.values.invoiceNumber} ${doc.values.clientName}`
          .toLowerCase()
          .includes(query)) &&
      (!type || doc.pro.documentType === type) &&
      (!status || effectiveStatus(doc) === status),
  );
  $("#historyList").innerHTML = list.length
    ? list
        .map((doc) => {
          const originalIndex = getHistory().findIndex(
              (x) => x.meta.id === doc.meta.id,
            ),
            total = calculateDocument(doc),
            paid = +doc.values.amountPaid || 0,
            pending = Math.max(0, total - paid),
            statusValue = effectiveStatus(doc),
            delay = overdueDays(doc),
            modified = doc.meta?.updatedAt
              ? new Intl.DateTimeFormat("es", { dateStyle: "short" }).format(
                  new Date(doc.meta.updatedAt),
                )
              : "";
          return `<div class="history-row extended"><span><strong>${escapeHtml(doc.values.invoiceNumber)}</strong> · ${TYPE_LABELS[doc.pro.documentType] || "Factura"} · ${escapeHtml(doc.values.clientName || "Sin cliente")}<small>${STATUS_LABELS[statusValue]}${delay ? ` (${delay} ${delay === 1 ? "día" : "días"} de retraso)` : ""} · ${moneyFor(doc, total)}${pending ? ` · Pendiente ${moneyFor(doc, pending)}` : ""}${modified ? ` · Modificado ${modified}` : ""}</small></span><button class="secondary" data-load-history="${originalIndex}">Abrir</button><button class="secondary" data-reminder-history="${originalIndex}">Recordar</button><button class="danger-text" data-delete-history="${originalIndex}">Eliminar</button></div>`;
        })
        .join("")
    : '<p class="history-empty">No hay documentos que coincidan.</p>';
  $$("[data-load-history]").forEach(
    (button) =>
      (button.onclick = () => load(getHistory()[+button.dataset.loadHistory])),
  );
  $$("[data-delete-history]").forEach(
    (button) =>
      (button.onclick = () => {
        const list = getHistory();
        list.splice(+button.dataset.deleteHistory, 1);
        setHistory(list);
        renderHistory();
      }),
  );
  $$("[data-reminder-history]").forEach(
    (button) =>
      (button.onclick = async () => {
        const doc = getHistory()[+button.dataset.reminderHistory],
          formal = confirm(
            "Aceptar: requerimiento formal. Cancelar: recordatorio amistoso.",
          );
        const text = collectionText(doc, formal);
        await navigator.clipboard.writeText(text);
        alert("Texto copiado. Revísalo antes de enviarlo.");
      }),
  );
}
function renderHistory() {
  let list = getHistory(),
    query = $("#historySearch")?.value.toLowerCase() || "",
    type = $("#historyTypeFilter")?.value || "",
    status = $("#historyStatusFilter")?.value || "";
  list = list.filter(
    (doc) =>
      (!query ||
        `${doc.values.invoiceNumber} ${doc.values.clientName}`
          .toLowerCase()
          .includes(query)) &&
      (!type || doc.pro.documentType === type) &&
      (!status || effectiveStatus(doc) === status),
  );
  const historyValues = {
    number: (doc) => doc.values.invoiceNumber || "",
    type: (doc) => TYPE_LABELS[doc.pro.documentType] || "Factura",
    status: (doc) => STATUS_LABELS[effectiveStatus(doc)] || "",
    client: (doc) => doc.values.clientName || "",
  };
  list.sort((a, b) => {
    const comparison = historyValues[historySort.field](a).localeCompare(
      historyValues[historySort.field](b),
      "es",
      { numeric: true, sensitivity: "base" },
    );
    return historySort.direction === "asc" ? comparison : -comparison;
  });
  const sortHeading = (field, label) => {
    const active = historySort.field === field,
      arrow = active ? (historySort.direction === "asc" ? " ↑" : " ↓") : "";
    return `<button type="button" data-history-sort="${field}" aria-label="Ordenar por ${label}" aria-pressed="${active}">${label}${arrow}</button>`;
  };
  $("#historyList").innerHTML = list.length
    ? `<div class="history-table-wrap"><table class="history-table"><thead><tr><th>${sortHeading("number", "Número")}</th><th>${sortHeading("type", "Tipo")}</th><th>${sortHeading("status", "Estado")}</th><th>${sortHeading("client", "Cliente")}</th><th>Editar</th><th>Convertir</th><th>Eliminar</th></tr></thead><tbody>${list
        .map((doc) => {
          const id = escapeHtml(doc.meta.id),
            statusValue = effectiveStatus(doc),
            statusOptions = Object.entries(STATUS_LABELS)
              .map(
                ([value, label]) =>
                  `<option value="${value}"${value === statusValue ? " selected" : ""}>${label}</option>`,
              )
              .join("");
          return `<tr><td><strong>${escapeHtml(doc.values.invoiceNumber || "Sin número")}</strong></td><td>${escapeHtml(TYPE_LABELS[doc.pro.documentType] || "Factura")}</td><td><select class="history-status" data-history-status="${id}" aria-label="Estado de ${escapeHtml(doc.values.invoiceNumber || "documento")}">${statusOptions}</select></td><td>${escapeHtml(doc.values.clientName || "Sin cliente")}</td><td><button class="secondary compact" data-load-history-id="${id}">Editar</button></td><td>${doc.pro.documentType === "estimate" ? `<button class="secondary compact" data-convert-history="${id}">Convertir en factura</button>` : ""}</td><td><button class="danger-text compact" data-delete-history-id="${id}">Eliminar</button></td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : '<p class="history-empty">No hay documentos que coincidan.</p>';
  $$('[data-history-sort]').forEach((button) => {
    button.onclick = () => {
      const field = button.dataset.historySort;
      historySort = {
        field,
        direction:
          historySort.field === field && historySort.direction === "asc"
            ? "desc"
            : "asc",
      };
      renderHistory();
    };
  });
  $$('[data-load-history-id]').forEach((button) => {
    button.onclick = () =>
      load(
        getHistory().find(
          (doc) => doc.meta.id === button.dataset.loadHistoryId,
        ),
      );
  });
  $$('[data-delete-history-id]').forEach((button) => {
    button.onclick = () => {
      const documents = getHistory(),
        index = documents.findIndex(
          (doc) => doc.meta.id === button.dataset.deleteHistoryId,
        );
      if (index < 0) return;
      documents.splice(index, 1);
      setHistory(documents);
      renderHistory();
    };
  });
  $$('[data-history-status]').forEach((select) => {
    select.onchange = () => {
      const documents = getHistory(),
        doc = documents.find(
          (item) => item.meta.id === select.dataset.historyStatus,
        );
      if (!doc) return;
      doc.values.documentStatus = select.value;
      doc.meta.updatedAt = new Date().toISOString();
      if (state.meta.id === doc.meta.id) $("#documentStatus").value = select.value;
      setHistory(documents);
      renderHistory();
    };
  });
  $$('[data-convert-history]').forEach((button) => {
    button.onclick = () => {
      const doc = getHistory().find(
        (item) => item.meta.id === button.dataset.convertHistory,
      );
      if (!doc) return;
      load(doc);
      convertEstimate();
    };
  });
}

function saveToHistory(options = {}) {
  const list = getHistory(),
    doc = snapshot(false),
    existing = list.findIndex((x) => x.meta.id === doc.meta.id),
    duplicate = list.find(
      (x) =>
        x.meta.id !== doc.meta.id &&
        x.values.invoiceNumber === doc.values.invoiceNumber,
    ),
    firstIssue = !doc.meta.fingerprint;
  if (
    duplicate &&
    !confirm(`Ya existe ${doc.values.invoiceNumber}. ¿Guardar de todos modos?`)
  )
    return false;
  if (options.issue) {
    const selectedStatus = options.status || "issued";
    doc.values.documentStatus = selectedStatus;
    $("#documentStatus").value = selectedStatus;
    doc.meta.fingerprint = hash(
      JSON.stringify({ values: doc.values, items: doc.items }),
    );
    state.meta.fingerprint = doc.meta.fingerprint;
  }
  if (existing >= 0) list[existing] = doc;
  else list.unshift(doc);
  saveCompanyProfile();
  setHistory(list);
  if (options.advanceNumber && $("#autoNumber").checked && firstIssue)
    commitNumber(currentType());
  renderHistory();
  return true;
}

function saveCompanyProfile() {
  if (!state.pro.active || !$("#issuerName").value.trim()) return;
  const profile = {};
  ["Name", "Tax", "Address", "Country", "Email"].forEach((suffix) => {
    profile[`issuer${suffix}`] = $("#issuer" + suffix).value;
  });
  localStorage.setItem(COMPANY_PROFILE_KEY, JSON.stringify(profile));
}

function hydrateCompanyProfile() {
  if (!state.pro.active) return;
  try {
    const profile = JSON.parse(localStorage.getItem(COMPANY_PROFILE_KEY));
    if (!profile) return;
    Object.entries(profile).forEach(([id, value]) => {
      if ($("#" + id) && !$("#" + id).value.trim()) $("#" + id).value = value;
    });
  } catch {
    localStorage.removeItem(COMPANY_PROFILE_KEY);
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function deriveBackupKey(password, salt, usage) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}
async function encryptBackup(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await deriveBackupKey(password, salt, "encrypt"),
    encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(data)),
    );
  return {
    product: "Haz la Factura",
    encrypted: true,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 250000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
}
async function decryptBackup(envelope, password) {
  const salt = base64ToBytes(envelope.salt),
    iv = base64ToBytes(envelope.iv),
    key = await deriveBackupKey(password, salt, "decrypt"),
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(envelope.data),
    );
  return JSON.parse(new TextDecoder().decode(decrypted));
}
async function backupAll() {
  const data = {
    product: "Haz la Factura",
    version: 1,
    exportedAt: new Date().toISOString(),
    draft: snapshot(),
    history: getHistory(),
    sequences: Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith("hlf-sequence-"))
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  };
  const password = prompt(
    "Contraseña opcional para cifrar la copia. Déjala vacía para exportarla sin cifrar.",
  );
  if (password === null) return;
  const encrypted = Boolean(password),
    output = encrypted ? await encryptBackup(data, password) : data;
  download(
    `haz-la-factura-copia-${new Date().toISOString().slice(0, 10)}${encrypted ? ".cifrada" : ""}.json`,
    JSON.stringify(output, null, encrypted ? 0 : 2),
  );
  localStorage.setItem("hlf-last-full-backup", String(Date.now()));
  checkBackupReminder();
}
async function restoreAll(data) {
  if (data.encrypted) {
    const password = prompt("Introduce la contraseña de esta copia cifrada.");
    if (!password)
      throw new Error("La copia está cifrada y necesita su contraseña.");
    try {
      data = await decryptBackup(data, password);
    } catch {
      throw new Error("La contraseña no es correcta o la copia está dañada.");
    }
  }
  if (data.product !== "Haz la Factura" || !Array.isArray(data.history))
    throw new Error("No es una copia completa válida.");
  const current = getHistory(),
    byId = new Map(current.map((doc) => [doc.meta.id, doc])),
    numbers = new Set(current.map((doc) => doc.values.invoiceNumber));
  let skipped = 0;
  data.history.map(migrate).forEach((doc) => {
    if (!byId.has(doc.meta.id) && numbers.has(doc.values.invoiceNumber)) {
      skipped++;
      return;
    }
    byId.set(doc.meta.id, doc);
    numbers.add(doc.values.invoiceNumber);
  });
  await setHistory([...byId.values()]);
  Object.entries(data.sequences || {}).forEach(([key, value]) => {
    if (key.startsWith("hlf-sequence-")) localStorage.setItem(key, value);
  });
  if (data.draft?.pro?.logo) {
    await idbPut("assets", { key: "brand-logo", value: data.draft.pro.logo });
    state.pro.logo = data.draft.pro.logo;
  }
  if (
    data.draft &&
    confirm("¿También quieres abrir el borrador incluido en la copia?")
  )
    load(data.draft);
  renderHistory();
  alert(
    `Archivo restaurado.${skipped ? ` Se omitieron ${skipped} documentos con numeración duplicada.` : ""}`,
  );
}
function checkBackupReminder() {
  $("#backupReminder").hidden =
    Date.now() - (+localStorage.getItem("hlf-last-full-backup") || 0) <
    30 * 864e5;
}
async function updateStorageStatus() {
  if (!navigator.storage) return;
  const estimate = await navigator.storage.estimate(),
    persisted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : false,
    used = estimate.usage || 0,
    quota = estimate.quota || 0,
    format = (bytes) =>
      bytes < 1048576
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / 1048576).toFixed(1)} MB`;
  $("#storageStatus").textContent =
    `${persisted ? "Almacenamiento persistente activo" : "Almacenamiento local estándar"} · ${format(used)} utilizados${quota ? ` de hasta ${format(quota)}` : ""}. Mantén siempre una copia externa.`;
}
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  if (navigator.storage.persisted && (await navigator.storage.persisted())) return;
  await navigator.storage.persist();
  await updateStorageStatus();
}

function validateDocument() {
  const errors = [],
    warnings = [],
    type = currentType(),
    totals = calculate(),
    hist = getHistory();
  if (!$("#issuerName").value.trim())
    errors.push("Falta el nombre o razón social del emisor.");
  if (!$("#issuerTax").value.trim())
    errors.push("Falta la identificación fiscal del emisor.");
  if (!$("#issuerAddress").value.trim())
    errors.push("Falta la dirección del emisor.");
  if (type !== "simplified" || state.pro.includeSimplifiedRecipient) {
    if (!$("#clientName").value.trim())
      errors.push("Falta el nombre o razón social del cliente.");
    if (!$("#clientTax").value.trim())
      warnings.push("No se ha indicado la identificación fiscal del cliente.");
    if (!$("#clientAddress").value.trim())
      warnings.push("No se ha indicado la dirección del cliente.");
  }
  if (!$("#invoiceNumber").value.trim())
    errors.push("Falta el número del documento.");
  if (!$("#invoiceDate").value) errors.push("Falta la fecha de emisión.");
  if (
    $("#dueDate").value &&
    $("#invoiceDate").value &&
    $("#dueDate").value < $("#invoiceDate").value
  )
    warnings.push("La fecha de vencimiento es anterior a la emisión.");
  state.items.forEach((item, i) => {
    if (!item.description.trim())
      errors.push(`El concepto ${i + 1} no tiene descripción.`);
    if (item.quantity <= 0)
      errors.push(`La cantidad del concepto ${i + 1} debe ser mayor que cero.`);
    if (item.price < 0)
      warnings.push(`El precio del concepto ${i + 1} es negativo.`);
  });
  if (totals.total < 0) warnings.push("El total del documento es negativo.");
  if ($("#taxTreatment").value !== "standard" && !$("#taxMention").value.trim())
    errors.push(
      "El tratamiento fiscal elegido necesita una mención explicativa.",
    );
  if (
    ["exempt", "not-subject", "reverse-charge", "intra-eu", "export"].includes(
      $("#taxTreatment").value,
    ) &&
    state.items.some((item) => +item.vat !== 0)
  )
    warnings.push(
      "Hay conceptos con IVA distinto de cero pese al tratamiento fiscal elegido.",
    );
  if (
    type === "corrective" &&
    (!$("#originalInvoiceNumber").value || !$("#correctionReason").value)
  )
    errors.push("La rectificativa necesita factura original y motivo.");
  if (type === "simplified" && totals.total > 400)
    warnings.push(
      "Una factura simplificada por encima de 400 € solo está permitida en determinados supuestos y actividades.",
    );
  if (
    hist.some(
      (doc) =>
        doc.meta.id !== state.meta.id &&
        doc.values.invoiceNumber === $("#invoiceNumber").value,
    )
  )
    warnings.push("Ese número ya existe en el historial local.");
  if (
    state.meta.fingerprint &&
    state.meta.fingerprint !==
      hash(JSON.stringify({ values: snapshot().values, items: state.items }))
  )
    warnings.push("El documento ha cambiado desde que se marcó como emitido.");
  return { errors, warnings };
}
function requestPrint() {
  const result = validateDocument();
  $("#validationResults").innerHTML =
    `${result.errors.length ? `<div class="validation-errors"><h3>Debes revisar</h3><ul>${result.errors.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : '<p class="validation-ok">No se han detectado campos obligatorios ausentes.</p>'}${result.warnings.length ? `<div class="validation-warnings"><h3>Advertencias</h3><ul>${result.warnings.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : ""}`;
  $("#confirmPrintBtn").disabled = result.errors.length > 0;
  $("#printStatusField").hidden = !state.pro.active;
  $("#saveDraftBtn").hidden = !state.pro.active;
  $("#printStatus").value = $("#documentStatus").value || "draft";
  $("#validationDialog").showModal();
  if (!state.pro.active && !result.errors.length && !result.warnings.length)
    confirmPrint();
}
function confirmPrint() {
  if (
    state.pro.active &&
    saveToHistory({
      issue: true,
      status: $("#printStatus").value,
      advanceNumber: true,
    }) === false
  )
    return;
  $("#validationDialog").close();
  window.print();
}
function saveIncompleteDraft() {
  if (!state.pro.active) return;
  $("#documentStatus").value = "draft";
  if (saveToHistory() === false) return;
  renderHistory();
  $("#validationDialog").close();
}

function setTreatment(value, force = false) {
  const mention = generatedTaxMention(value);
  if (
    force ||
    !$("#taxMention").value.trim() ||
    isGeneratedTaxMention($("#taxMention").value)
  )
    $("#taxMention").value = mention;
  if (
    ["exempt", "not-subject", "reverse-charge", "intra-eu", "export"].includes(
      value,
    )
  ) {
    $("#vat").value = 0;
    state.items.forEach((item) => (item.vat = 0));
    renderItems();
  }
  update();
}
function changeDocumentType(type) {
  if (type !== state.pro.documentType) {
    state.meta = {
      id: uid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fingerprint: "",
    };
  }
  state.pro.documentType = type;
  if (type === "simplified") {
    state.pro.includeSimplifiedRecipient = false;
    $("#dueDate").value = "";
  } else if (!$("#dueDate").value) {
    $("#dueDate").value = new Date(Date.now() + 30 * 864e5)
      .toISOString()
      .slice(0, 10);
  }
  const prefix = PREFIXES[type];
  $("#seriesPrefix").value = prefix;
  $("#invoiceNumber").value = nextNumber(type);
  $("#documentStatus").value = "draft";
  update();
}
function startNewDocument() {
  if (!confirm("¿Crear un documento nuevo? Los cambios no guardados se perderán."))
    return;
  state.meta = {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fingerprint: "",
  };
  state.pro.documentType = "invoice";
  state.pro.includeSimplifiedRecipient = false;
  state.pro.hasPayment = false;
  state.items = [newItem("", 1, 0, 21, 0, 0)];
  $("#seriesPrefix").value = "FAC";
  const today = new Date(),
    due = new Date(Date.now() + 30 * 864e5),
    values = {
      invoiceNumber: nextNumber("invoice"),
      invoiceDate: today.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      clientName: "",
      clientTax: "",
      clientAddress: "",
      clientCountry: "España",
      clientEmail: "",
      vat: "21",
      irpf: "0",
      taxTreatment: "standard",
      taxMention: "",
      notes: "",
      seriesPrefix: "FAC",
      documentStatus: "draft",
      originalInvoiceNumber: "",
      originalInvoiceDate: "",
      correctionReason: "",
      estimateStartDate: "",
      estimateDeliveryDate: "",
      estimateDeposit: "0",
      paymentDate: "",
      paymentMethod: "",
      amountPaid: "0",
    };
  Object.entries(values).forEach(([id, value]) => {
    if ($("#" + id)) $("#" + id).value = value;
  });
  $("#documentType").value = "invoice";
  renderItems();
  update();
}
function convertEstimate() {
  if (currentType() !== "estimate") return;
  const estimateNumber = $("#invoiceNumber").value;
  saveToHistory();
  state.meta = {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fingerprint: "",
  };
  changeDocumentType("invoice");
  $("#dueDate").value =
    currentType() === "simplified"
      ? ""
      : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  update();
  const list = getHistory(),
    savedEstimate = list.find(
      (doc) => doc.values.invoiceNumber === estimateNumber,
    );
  if (savedEstimate) {
    savedEstimate.values.documentStatus = "accepted";
    savedEstimate.meta.updatedAt = new Date().toISOString();
    setHistory(list);
    renderHistory();
  }
  alert(
    `Presupuesto ${estimateNumber} conservado y convertido en una nueva factura.`,
  );
}
const today = new Date(),
  due = new Date(Date.now() + 30 * 864e5);
$("#invoiceDate").value = today.toISOString().slice(0, 10);
$("#dueDate").value = due.toISOString().slice(0, 10);
$("#invoiceNumber").value = nextNumber();
VALUE_IDS.forEach((id) => {
  if ($("#" + id)) $("#" + id).addEventListener("input", update);
});
$("#addItem").onclick = () => {
  state.items.push(newItem());
  renderItems();
  update();
};
$("#printBtn").onclick = requestPrint;
$("#confirmPrintBtn").onclick = confirmPrint;
$("#saveDraftBtn").onclick = saveIncompleteDraft;
$("#autoNumber").onchange = () => {
  state.pro.automaticNumber = $("#autoNumber").checked;
  if (state.pro.automaticNumber)
    $("#invoiceNumber").value = nextNumber(currentType());
  update();
};
$("#hasPayment").onchange = () => {
  state.pro.hasPayment = $("#hasPayment").checked;
  update();
};
$("#exportBtn").onclick = () =>
  download(
    `${currentType() === "estimate" ? "presupuesto" : "factura"}-${$("#invoiceNumber").value}.json`,
    JSON.stringify(snapshot(), null, 2),
  );
$("#importFile").onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      load(JSON.parse(reader.result));
    } catch {
      alert("El archivo no es una copia válida de Haz la Factura.");
    }
  };
  reader.readAsText(file);
};
$("#newDocumentBtn").onclick = startNewDocument;
$("#proAccessBtn").onclick = () =>
  state.pro.active
    ? $("#proControls").scrollIntoView({ behavior: "smooth" })
    : $("#licenseDialog").showModal();
$("#proIntroLicenseBtn").onclick = () => $("#licenseDialog").showModal();
$("#validateLicenseBtn").addEventListener("click", validateLicense);
$("#releaseLicenseBtn").addEventListener("click", releaseLicense);
$("#licenseDialog form").addEventListener("submit", (event) => {
  if (event.submitter?.classList.contains("dialog-close")) return;
  event.preventDefault();
  validateLicense();
});
$("#documentType").onchange = (event) => changeDocumentType(event.target.value);
$("#includeSimplifiedRecipient").onchange = (event) => {
  state.pro.includeSimplifiedRecipient = event.target.checked;
  update();
};
$("#template").onchange = (event) => {
  state.pro.template = event.target.value;
  update();
};
$("#invoiceLanguage").onchange = (event) => {
  const previousMention = $("#taxMention").value;
  state.pro.invoiceLanguage = event.target.value;
  if (isGeneratedTaxMention(previousMention))
    $("#taxMention").value = generatedTaxMention($("#taxTreatment").value);
  update();
};
$("#brandColor").oninput = (event) => {
  state.pro.brandColor = event.target.value;
  update();
};
$("#brandLogo").onchange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 600000) {
    alert("El logo debe ocupar menos de 600 KB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    state.pro.logo = reader.result;
    try {
      await idbPut("assets", { key: "brand-logo", value: reader.result });
    } catch {
      alert("No se ha podido guardar el logo en el almacenamiento local.");
    }
    update();
  };
  reader.readAsDataURL(file);
};
$("#tutorialBtn").onclick = () => $("#tutorialDialog").showModal();
$("#convertEstimateBtn").onclick = convertEstimate;
$("#taxTreatment").onchange = (event) => setTreatment(event.target.value, true);
$("#seriesPrefix").onchange = () => {
  $("#invoiceNumber").value = nextNumber();
  update();
};
["historySearch", "historyTypeFilter", "historyStatusFilter"].forEach((id) =>
  $("#" + id).addEventListener("input", renderHistory),
);
$("#backupAllBtn").onclick = backupAll;
$("#restoreAllFile").onchange = (event) => {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await restoreAll(JSON.parse(reader.result));
    } catch (error) {
      alert(error.message);
    }
  };
  if (event.target.files[0]) reader.readAsText(event.target.files[0]);
};

async function initializeApp() {
  const historyPanel = $("#historyPanel");
  const editor = document.querySelector("#crear .editor");
  const toolbar = $("#documentToolbar");
  const proCard = document.querySelector(".pro-tools");
  const proControls = $("#proControls");
  const proFields = $("#proDocumentFields");
  if (historyPanel && editor && !$("#archiveDrawer")) {
    const drawer = document.createElement("details");
    drawer.id = "archiveDrawer";
    drawer.className = "archive-drawer";
    drawer.hidden = true;
    drawer.innerHTML = '<summary><span><small>ARCHIVO LOCAL</small><strong>Facturas y presupuestos guardados</strong></span><span class="drawer-action">Abrir archivo</span></summary>';
    drawer.append(historyPanel);
    drawer.addEventListener("toggle", () => {
      if (drawer.open) requestPersistentStorage().catch(console.warn);
    });
    editor.prepend(drawer);
  }
  if (proControls && proFields && proCard && !$("#integratedProTools")) {
    const integrated = document.createElement("details");
    integrated.id = "integratedProTools";
    integrated.className = "integrated-pro-tools form-accordion";
    integrated.hidden = true;
    integrated.open = true;
    integrated.innerHTML = '<summary><span class="accordion-title">Diseño del documento</span></summary><div class="accordion-content" id="designFields"></div>';
    if ($("#autoNumber")) proFields.prepend($("#autoNumber").closest("label"));
    if ($("#convertEstimateBtn")) proFields.append($("#convertEstimateBtn"));
    integrated.querySelector("#designFields").append(proControls);
    $("#headerProFields").append(proFields);
    $("#headerProFields")
      .closest(".form-accordion")
      .insertAdjacentElement("afterend", integrated);
    if (toolbar) proCard.insertAdjacentElement("beforebegin", toolbar);
  }
  const workspace = $("#crear");
  const archiveDrawer = $("#archiveDrawer");
  if (workspace && proCard && archiveDrawer && !$("#workspaceTools")) {
    const tools = document.createElement("div");
    tools.id = "workspaceTools";
    tools.className = "workspace-tools";
    tools.hidden = true;
    tools.append(proCard, archiveDrawer);
    workspace.insertAdjacentElement("beforebegin", tools);
  }
  try {
    await initializeLocalDatabase();
  } catch (error) {
    databaseAvailable = false;
    try {
      historyCache = JSON.parse(localStorage.getItem("hlf-pro-history")) || [];
    } catch {
      historyCache = [];
    }
    console.warn(
      "IndexedDB no está disponible; se mantiene el almacenamiento anterior.",
      error,
    );
  }
  const stored =
    localStorage.getItem("hazlafactura") ||
    localStorage.getItem("facturalista");
  if (stored) {
    try {
      load(JSON.parse(stored), true);
    } catch {
      renderItems();
      update();
    }
  } else {
    renderItems();
    update();
  }
  if (state.pro.logo) applyProAppearance();
  await restoreLicense();
  hydrateCompanyProfile();
  update();
  updateStorageStatus().catch(console.warn);
}
initializeApp();
