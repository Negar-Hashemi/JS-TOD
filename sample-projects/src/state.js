// A tiny shared state module to intentionally create order dependencies.
let store = {
  flag: false,
  counter: 0,
  name: null,
};

function get() { return store; }
function reset() { store = { flag: false, counter: 0, name: null }; }
function setFlag(v) { store.flag = !!v; }
function inc() { store.counter += 1; }
function setName(n) { store.name = n; }

module.exports = { get, reset, setFlag, inc, setName };
