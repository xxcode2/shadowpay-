// Stub for node-localstorage
// Privacy Cash SDK uses it only in Node.js backend
// In browser, it's not actually used
export class LocalStorage {}

// ✅ STUB FOR PATH MODULE
// Privacy Cash SDK tries to use path.join() in browser
// We mock it here to prevent "Path must be a string" error
export const join = (...args) => args[args.length - 1] || ''
export const resolve = (...args) => args[args.length - 1] || ''
export const dirname = (p) => p || ''
export const basename = (p) => p || ''
export const extname = (p) => ''
export const sep = '/'
export const delimiter = ':'

export default { 
  LocalStorage,
  // ✅ Export path stubs as default
  join,
  resolve,
  dirname,
  basename,
  extname,
  sep,
  delimiter,
}
