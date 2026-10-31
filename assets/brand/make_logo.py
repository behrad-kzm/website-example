"""Generate the colonAIz planet mark: a Goldberg sphere of matte hex panels, lit from above,
with space-blue light glowing through the gaps. Same construction as assets/planet.js."""
import math, sys

def norm(v):
    l = math.sqrt(sum(x * x for x in v)); return tuple(x / l for x in v)
def add(*vs): return tuple(sum(c) for c in zip(*vs))
def mul(v, k): return tuple(x * k for x in v)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t)
def mix(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
def hexc(c): return '#%02x%02x%02x' % c

def goldberg(freq):
    p = (1 + 5 ** 0.5) / 2
    V = [norm(v) for v in [(-1,p,0),(1,p,0),(-1,-p,0),(1,-p,0),(0,-1,p),(0,1,p),(0,-1,-p),(0,1,-p),(p,0,-1),(p,0,1),(-p,0,-1),(-p,0,1)]]
    F = [(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),
         (3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),(4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
    verts, key, faces = [], {}, []
    def vid(v):
        v = norm(v); k = tuple(round(x, 6) for x in v)
        if k not in key: key[k] = len(verts); verts.append(v)
        return key[k]
    for a, b, c in F:
        A, B, C = V[a], V[b], V[c]
        grid = {}
        for i in range(freq + 1):
            for j in range(freq + 1 - i):
                k = freq - i - j
                grid[i, j] = vid(add(mul(A, i), mul(B, j), mul(C, k)))
        for i in range(freq):
            for j in range(freq - i):
                faces.append((grid[i, j], grid[i + 1, j], grid[i, j + 1]))
                if i + j < freq - 1:
                    faces.append((grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]))
    centers = [norm(add(verts[a], verts[b], verts[c])) for a, b, c in faces]
    around = [[] for _ in verts]
    for f, (a, b, c) in enumerate(faces):
        for v in (a, b, c): around[v].append(f)
    cells = []
    for i, n in enumerate(verts):
        c0 = centers[around[i][0]]
        t = norm(add(c0, mul(n, -dot(c0, n)))); b = cross(n, t)
        corners = sorted((centers[f] for f in around[i]), key=lambda c: math.atan2(dot(c, b), dot(c, t)))
        cells.append((n, corners))
    return cells

def rotate(v, rx, ry):
    x, y, z = v
    y, z = y * math.cos(rx) - z * math.sin(rx), y * math.sin(rx) + z * math.cos(rx)
    x, z = x * math.cos(ry) + z * math.sin(ry), -x * math.sin(ry) + z * math.cos(ry)
    return (x, y, z)

def build(freq, inset, size, halo, rays):
    """A blue star jailed inside a hexagon shell: white-hot core, light pouring through the gaps,
    panels backlit at their edges, and (rays=True) beams escaping past the silhouette."""
    cx = cy = size / 2
    R = size * (0.36 if rays else 0.46)
    L = norm((0.15, 1.0, 0.35))             # faint overhead light on the panel tops
    LIT, DARK = (58, 60, 66), (9, 10, 13)    # matte panel lit / in shadow
    BACKLIT = (24, 38, 82)                   # panel faces near the core pick up a little blue
    polys = []
    for n, corners in goldberg(freq):
        n = rotate(n, 0.38, 0.22)
        if n[2] < -0.05: continue
        d = math.hypot(n[0], n[1])           # 0 at the centre of the disc, 1 at the limb
        heat = (1 - smooth(0.0, 0.95, d))    # how close this panel sits to the star
        k = inset - 0.1 * heat               # pressure from the star: panels near the core are forced apart
        pts = []
        for c in corners:
            c = rotate(c, 0.38, 0.22)
            q = norm(add(n, mul(add(c, mul(n, -1)), k)))
            pts.append((cx + q[0] * R, cy - q[1] * R))
        top = smooth(0.15, 0.85, dot(n, L)) * (0.35 + 0.65 * max(n[2], 0))
        fill = mix(mix(DARK, LIT, top * 0.7), BACKLIT, heat * 0.35)
        polys.append((n[2], pts, hexc(fill), heat))
    polys.sort(key=lambda p: p[0])

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">',
           '<title>colonAIz</title>', '<defs>',
           f'<clipPath id="disc"><circle cx="{cx}" cy="{cy}" r="{R:.2f}"/></clipPath>',
           # the jailed star: white-hot at the centre, space blue toward the shell
           f'<radialGradient id="star" cx="{cx}" cy="{cy}" r="{R:.2f}" gradientUnits="userSpaceOnUse">'
           '<stop offset="0" stop-color="#ffffff"/><stop offset="0.22" stop-color="#d6e4ff"/>'
           '<stop offset="0.42" stop-color="#6f9bff"/><stop offset="0.75" stop-color="#2f6bff"/>'
           '<stop offset="1" stop-color="#14307f"/></radialGradient>',
           f'<radialGradient id="edge" cx="{cx}" cy="{cy}" r="{R:.2f}" gradientUnits="userSpaceOnUse">'
           '<stop offset="0" stop-color="#e6eeff"/><stop offset="0.6" stop-color="#5b8cff"/>'
           '<stop offset="1" stop-color="#2f6bff"/></radialGradient>']
    if rays:
        out += [f'<radialGradient id="beam" cx="{cx}" cy="{cy}" r="{R * 1.9:.2f}" gradientUnits="userSpaceOnUse">'
                '<stop offset="0.45" stop-color="#bcd2ff" stop-opacity="0.95"/>'
                '<stop offset="0.6" stop-color="#5b8cff" stop-opacity="0.6"/>'
                '<stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>',
                f'<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{size * 0.006:.2f}"/></filter>']
    if halo:
        out.append(f'<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{size * 0.045:.2f}"/></filter>')
    out.append('</defs>')

    if halo:
        out.append(f'<circle cx="{cx}" cy="{cy}" r="{R:.2f}" fill="#2f6bff" opacity="0.55" filter="url(#glow)"/>')
    if rays:
        # Beams escaping through gaps along the rim: tapered wedges from the core, uneven lengths and widths
        beams = [(8, 1.85, 2.6), (37, 1.45, 1.6), (63, 1.7, 2.2), (96, 1.35, 1.4), (124, 1.9, 2.8), (151, 1.5, 1.8),
                 (188, 1.75, 2.4), (214, 1.4, 1.5), (243, 1.95, 3.0), (271, 1.55, 1.7), (302, 1.8, 2.5), (333, 1.45, 1.6)]
        out.append('<g filter="url(#soft)">')
        for deg, length, width in beams:
            a, w = math.radians(deg), math.radians(width)
            tip = (cx + math.cos(a) * R * length, cy - math.sin(a) * R * length)
            l = (cx + math.cos(a - w) * R * 1.02, cy - math.sin(a - w) * R * 1.02)
            r = (cx + math.cos(a + w) * R * 1.02, cy - math.sin(a + w) * R * 1.02)
            out.append(f'<polygon points="{cx},{cy} {l[0]:.2f},{l[1]:.2f} {tip[0]:.2f},{tip[1]:.2f} {r[0]:.2f},{r[1]:.2f}" fill="url(#beam)"/>')
        out.append('</g>')

    out.append(f'<g clip-path="url(#disc)"><circle cx="{cx}" cy="{cy}" r="{R:.2f}" fill="url(#star)"/>')
    sw = size * (0.005 if size >= 128 else 0.012)
    for _, pts, fill, heat in polys:
        out.append('<polygon points="' + ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts) +
                   f'" fill="{fill}" stroke="url(#edge)" stroke-opacity="{0.15 + 0.7 * heat:.2f}" stroke-width="{sw:.2f}" stroke-linejoin="round"/>')
    out.append('</g>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    outdir = sys.argv[1]
    open(f'{outdir}/logo.svg', 'w').write(build(freq=3, inset=0.8, size=512, halo=True, rays=True))
    open(f'{outdir}/favicon.svg', 'w').write(build(freq=2, inset=0.74, size=64, halo=False, rays=False))
    print('written')
