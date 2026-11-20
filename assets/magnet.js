// The page's magnetic sections (scroll snap on <html>) and the scripts that need them off for a while.
// Several parts of the page switch them off while the scroll is inside their stretch: "What we do",
// the Star Track takeover, "How it works". Each says so here under its own name, and the magnet is on
// only while nobody needs it off, so one script cannot switch it back on under another.
const holders = new Set();

export function holdMagnet(who, off) {
  if (off) holders.add(who); else holders.delete(who);
  document.documentElement.style.scrollSnapType = holders.size ? 'none' : '';
}
