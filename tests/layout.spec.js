// The inset rule (docs/mentality/website.md, "Layout rule: insets"): inside every card, the content starts
// as far from the top edge as it is from the leading edge, and cards side by side start their content on
// the same line.
const { test, expect } = require('@playwright/test');

// For each card: the gap from its top edge to its first child, and from its leading edge to that child
const insets = (page) => page.evaluate(() => [...document.querySelectorAll('.cz-card')].map((card) => {
  const box = card.getBoundingClientRect();
  const first = card.firstElementChild.getBoundingClientRect();
  const section = card.closest('section');
  return {
    card: `${section ? section.id : ''} "${card.textContent.trim().slice(0, 24)}"`,
    top: Math.round(first.top - box.top),
    leading: Math.round(first.left - box.left),
  };
}));

for (const [name, width] of [['desktop', 1440], ['phone', 390]]) {
  test(`every card's content is as far from the top as from the leading edge (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/');
    const cards = await insets(page);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(c.top, c.card).toBe(c.leading);
  });
}

test('the two product panes start their names and their descriptions on the same lines', async ({ page }) => {
  await page.goto('/');
  const tops = await page.evaluate(() => [...document.querySelectorAll('.products .cz-card')].map((card) => ({
    name: Math.round(card.querySelector('h3').getBoundingClientRect().top),
    description: Math.round(card.querySelector('.cz-card__body').getBoundingClientRect().top),
  })));
  expect(tops).toHaveLength(2);
  expect(tops[0].name).toBe(tops[1].name);
  expect(tops[0].description).toBe(tops[1].description);
});
