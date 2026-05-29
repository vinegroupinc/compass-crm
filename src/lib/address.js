// address.js — Aggressive normalization so "1531 W 84th St Los Angeles, CA 90047"
// and "1531 West 84th Street" match as the same property.
//
// Strategy: strip city/state/zip, expand directional and street-type
// abbreviations, drop punctuation, lowercase, collapse whitespace. The result
// is used ONLY for matching — the original string is what we store and display.

// Street-type abbreviations (both directions covered by walking the keys)
const STREET_TYPES = {
  street: 'street',  st: 'street',
  avenue: 'avenue',  ave: 'avenue',
  boulevard: 'boulevard', blvd: 'boulevard',
  road: 'road',      rd: 'road',
  drive: 'drive',    dr: 'drive',
  lane: 'lane',      ln: 'lane',
  court: 'court',    ct: 'court',
  place: 'place',    pl: 'place',
  parkway: 'parkway', pkwy: 'parkway',
  highway: 'highway', hwy: 'highway',
  way: 'way',        wy: 'way',
  terrace: 'terrace', ter: 'terrace',
  circle: 'circle',  cir: 'circle',
  square: 'square',  sq: 'square',
  trail: 'trail',    trl: 'trail',
  alley: 'alley',    aly: 'alley',
}

const DIRECTIONS = {
  north: 'north', n: 'north',
  south: 'south', s: 'south',
  east: 'east',   e: 'east',
  west: 'west',   w: 'west',
  northeast: 'northeast', ne: 'northeast',
  northwest: 'northwest', nw: 'northwest',
  southeast: 'southeast', se: 'southeast',
  southwest: 'southwest', sw: 'southwest',
}

// US state abbreviations and full names to strip.
const STATES = new Set([
  'al','alabama','ak','alaska','az','arizona','ar','arkansas','ca','california',
  'co','colorado','ct','connecticut','de','delaware','fl','florida','ga','georgia',
  'hi','hawaii','id','idaho','il','illinois','in','indiana','ia','iowa','ks','kansas',
  'ky','kentucky','la','louisiana','me','maine','md','maryland','ma','massachusetts',
  'mi','michigan','mn','minnesota','ms','mississippi','mo','missouri','mt','montana',
  'ne','nebraska','nv','nevada','nh','newhampshire','nj','newjersey','nm','newmexico',
  'ny','newyork','nc','northcarolina','nd','northdakota','oh','ohio','ok','oklahoma',
  'or','oregon','pa','pennsylvania','ri','rhodeisland','sc','southcarolina',
  'sd','southdakota','tn','tennessee','tx','texas','ut','utah','vt','vermont',
  'va','virginia','wa','washington','wv','westvirginia','wi','wisconsin','wy','wyoming',
  'dc',
])

// Returns a normalized key for matching. Returns '' for empty input.
export function normalizeAddress(input) {
  if (!input) return ''
  let s = String(input).toLowerCase().trim()

  // Strip punctuation, replace with spaces
  s = s.replace(/[.,#]/g, ' ')

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()

  // Tokenize
  let tokens = s.split(' ').filter(Boolean)

  // Strip 5-digit and 5+4 ZIP codes wherever they sit
  tokens = tokens.filter((t) => !/^\d{5}(-?\d{4})?$/.test(t))

  // Strip state names/abbreviations
  tokens = tokens.filter((t) => !STATES.has(t))

  // Expand directions and street types token-by-token
  tokens = tokens.map((t) => {
    if (DIRECTIONS[t]) return DIRECTIONS[t]
    if (STREET_TYPES[t]) return STREET_TYPES[t]
    return t
  })

  // Truncate at the LAST street type — anything after that is almost always
  // the city/state/zip remainder (which we ignore for matching, per spec).
  // "1531 west 84th street los angeles" → "1531 west 84th street"
  const streetTypeValues = new Set(Object.values(STREET_TYPES))
  let lastStreetIdx = -1
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (streetTypeValues.has(tokens[i])) { lastStreetIdx = i; break }
  }
  if (lastStreetIdx >= 0) {
    tokens = tokens.slice(0, lastStreetIdx + 1)
  }

  // Final collapse
  return tokens.join(' ').replace(/\s+/g, ' ').trim()
}

// Convenience: do two addresses normalize to the same key?
export function addressesMatch(a, b) {
  const na = normalizeAddress(a)
  const nb = normalizeAddress(b)
  if (!na || !nb) return false
  return na === nb
}
