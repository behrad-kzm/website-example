# Badge

Badges label an item's state or tier in one or two words. They are content, so they are tinted fills, not glass.

- Capsule (`radius-full`), 22px tall, type 12/500.
- Neutral: `button-hover-bg` fill, `fg-200` text.
- Semantic: the colour at full value as text over its `-subtle` token (15% alpha): `green` Installed or success, `yellow` Pro or warning, `blue` Beta or info, `red` Deprecated or error.
- State must also be in the word itself; colour alone never carries meaning.
