// Bank Queue Manager
// The queue is stored in two arrays of fixed size (a circular queue):
//   names[]   holds the customer names
//   tickets[] holds the ticket numbers
// Three variables keep track of the queue:
//   front = index of the customer at the front (next to be served)
//   rear  = index of the customer at the rear (last to join)
//   count = number of customers waiting
// When front or rear reaches the end of the arrays it wraps back to 0.

const CAPACITY = 10;
const MAX_HISTORY = 20;
const STORE_KEY = "queue-manager-v1";
const SAMPLE = ["Ama", "Kwame", "Esi", "Kofi"];

let names, tickets, front, rear, count;
let nextTicket;
let nowServing;     // null, or { name, ticket }
let served;         // history of served customers (oldest first)

// ---------- Queue operations ----------
function resetQueue() {
  names = new Array(CAPACITY).fill("");
  tickets = new Array(CAPACITY).fill(0);
  front = 0;
  rear = -1;
  count = 0;
}

function isEmpty() { return count === 0; }
function isFull()  { return count === CAPACITY; }

// Enqueue: add a customer at the rear. Returns the ticket number, or 0 if the queue is full.
function enqueue(name) {
  if (isFull()) return 0;
  rear = (rear + 1) % CAPACITY;
  names[rear] = name;
  tickets[rear] = nextTicket;
  count++;
  return nextTicket++;
}

// Dequeue: remove the customer at the front. Returns the customer, or null if the queue is empty.
function dequeue() {
  if (isEmpty()) return null;
  const customer = { name: names[front], ticket: tickets[front] };
  names[front] = "";
  tickets[front] = 0;
  front = (front + 1) % CAPACITY;
  count--;
  return customer;
}

// Peek: look at the front customer without removing them.
function peek() {
  if (isEmpty()) return null;
  return { name: names[front], ticket: tickets[front] };
}

// Read the queue in order, from front to rear.
function queueToList() {
  const list = [];
  for (let k = 0; k < count; k++) {
    const i = (front + k) % CAPACITY;
    list.push({ name: names[i], ticket: tickets[i] });
  }
  return list;
}

function loadSample() {
  resetQueue();
  nextTicket = 1;
  nowServing = null;
  served = [];
  for (let i = 0; i < SAMPLE.length; i++) enqueue(SAMPLE[i]);
}

// ---------- Saving ----------
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ names, tickets, front, rear, count, nextTicket, nowServing, served }));
  } catch (e) { /* storage not available, app still works */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const ints = (...v) => v.every(Number.isInteger);
    const valid =
      Array.isArray(d.names) && d.names.length === CAPACITY &&
      Array.isArray(d.tickets) && d.tickets.length === CAPACITY &&
      d.tickets.every(Number.isInteger) &&
      ints(d.front, d.rear, d.count, d.nextTicket) &&
      d.front >= 0 && d.front < CAPACITY && d.rear >= -1 && d.rear < CAPACITY &&
      d.count >= 0 && d.count <= CAPACITY && d.nextTicket >= 1 &&
      Array.isArray(d.served) && d.served.length <= MAX_HISTORY &&
      (d.nowServing === null || (d.nowServing && typeof d.nowServing.name === "string" && Number.isInteger(d.nowServing.ticket)));
    if (!valid) return false;
    names = d.names.map(String);
    tickets = d.tickets.slice();
    front = d.front; rear = d.rear; count = d.count;
    nextTicket = d.nextTicket;
    nowServing = d.nowServing ? { name: d.nowServing.name, ticket: d.nowServing.ticket } : null;
    served = d.served.map(String);
    return true;
  } catch (e) { return false; }
}

// ---------- Display ----------
const $ = id => document.getElementById(id);

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderServing() {
  if (nowServing) {
    $("serving-ticket").textContent = "Ticket " + nowServing.ticket;
    $("serving-name").textContent = nowServing.name;
  } else {
    $("serving-ticket").textContent = "-";
    $("serving-name").textContent = "Nobody yet";
  }
  $("next-btn").disabled = isEmpty();
}

function renderQueue() {
  const list = $("queue-list");
  list.textContent = "";
  const front_ = peek();
  $("status").textContent = count + " of " + CAPACITY + " places used." +
    (front_ ? " Next in line: " + front_.name + " (ticket " + front_.ticket + ")." : "");

  if (isEmpty()) {
    list.appendChild(make("li", "empty", "Nobody is waiting."));
    return;
  }

  const waiting = queueToList();
  for (let k = 0; k < waiting.length; k++) {
    const li = make("li", "queue-item");
    li.appendChild(make("span", "q-pos", String(k + 1)));
    li.appendChild(make("span", "q-ticket", "Ticket " + waiting[k].ticket));
    li.appendChild(make("span", "q-name", waiting[k].name));

    const tags = [];
    if (k === 0) tags.push("Front");
    if (k === waiting.length - 1) tags.push("Rear");
    if (tags.length) li.appendChild(make("span", "q-tag", tags.join(" and ")));

    li.appendChild(make("span", "q-ahead", k === 0 ? "next" : k + (k === 1 ? " person ahead" : " people ahead")));
    list.appendChild(li);
  }
}

function renderServed() {
  const list = $("served-list");
  list.textContent = "";
  if (served.length === 0) {
    list.appendChild(make("li", "none", "No customers served yet."));
    return;
  }
  // newest first, show the last 5
  for (let i = served.length - 1; i >= 0 && i >= served.length - 5; i--) {
    list.appendChild(make("li", "", served[i]));
  }
}

function update(message) {
  save();
  renderServing();
  renderQueue();
  renderServed();
  if (message !== undefined) $("message").textContent = message;
}

// ---------- Events ----------
$("add-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("name-input");
  const name = input.value.trim();

  if (name === "") {
    $("message").textContent = "Please enter the customer's name.";
    input.focus();
    return;
  }
  if (isFull()) {
    $("message").textContent = "The queue is full (" + CAPACITY + " customers). Serve someone before issuing another ticket.";
    return;
  }

  const ticket = enqueue(name);
  input.value = "";
  update("Ticket " + ticket + " issued to " + name + ".");
  input.focus();
});

$("next-btn").addEventListener("click", () => {
  const customer = dequeue();
  if (customer === null) {
    update("No customers are waiting.");
    return;
  }
  nowServing = customer;
  served.push("Ticket " + customer.ticket + ": " + customer.name);
  if (served.length > MAX_HISTORY) served.shift();
  update("Now serving ticket " + customer.ticket + ": " + customer.name + ".");
});

$("sample-btn").addEventListener("click", () => {
  loadSample();
  update("Sample queue restored.");
});

$("clear-btn").addEventListener("click", () => {
  resetQueue();
  nextTicket = 1;
  nowServing = null;
  served = [];
  update("The queue has been cleared. Ticket numbers start again from 1.");
});

// ---------- Start ----------
if (!load()) loadSample();
update("");
