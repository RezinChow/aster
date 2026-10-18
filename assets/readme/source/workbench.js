const {
  Cam, clamp, disposer, facing, fit, mk, pointer, prism, proj, put,
  register, rings, solid, tdone, tset, tval, tween, unproj,
} = HL;

const CENTRES = [-49, 0, 49];
const REST = [0, 5, 2];
const TOP = [25, 31, 28];
const NAMES = ["plan", "execute", "verify"];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value, active = -1;
  const C = Cam(45, 0.5, 1.78);
  fit(C, [[-78, -37, -24], [78, 37, -24], [-78, 37, 78], [78, -37, 78]], 200, 166);
  const P = proj(C), front = facing(C);
  const scene = mk("g", {}, svg);

  function block(parent, footprint, bottom, top, radius = 2) {
    const [ring, inner] = rings(...footprint, radius, Math.min(0.7, radius / 2));
    const body = solid(parent);
    return {
      body,
      draw: (lift) => put(body, prism(P, front, ring, inner, bottom + lift, top + lift)),
    };
  }

  for (const [x, y] of [[-67, -26], [67, -26], [-67, 26], [67, 26]]) {
    block(scene, [x - 4, y - 4, x + 4, y + 4], -24, 0, 1.8).draw(0);
  }
  block(scene, [-78, -37, 78, 37], 0, 8, 5).draw(0);

  const stations = CENTRES.map((x, i) => {
    const group = mk("g", {}, scene);
    const parts = [
      block(group, [x - 21, -25, x + 21, 26], 8, 12, 3),
      block(group, [x - 17, -19, x + 17, -12], 12, 22, 1.6),
      block(group, [x - 11, -12, x + 11, 9], 12, TOP[i], 2.3),
      block(group, [x - 17, 9, x + 17, 16], 12, 22, 1.6),
      block(group, [x - 2, 16, x + 2, 29], 15, 18, 1.2),
      block(group, [x - 8, 26, x + 8, 30], 14, 20, 1.5),
    ];
    return { parts, lift: tween(REST[i]), drawn: NaN };
  });

  function draw(i, lift) {
    const station = stations[i];
    if (station.drawn === lift) return;
    station.parts.forEach((part) => part.draw(lift));
    station.drawn = lift;
  }
  stations.forEach((station, i) => draw(i, REST[i]));
  stations[0].parts[2].body.sil.classList.add("hi");

  const loop = register(stage, (_dt, now) => {
    let moving = false;
    stations.forEach((station, i) => {
      draw(i, tval(station.lift, now));
      if (!tdone(station.lift, now)) moving = true;
    });
    return moving;
  });
  bag.add(loop.unregister);

  function target(next) {
    const origin = next < 0 ? active : next;
    active = next;
    const now = performance.now();
    stations.forEach((station, i) => {
      const distance = Math.abs(i - origin);
      const falloff = [1, 0.32, 0.1][distance] ?? 0;
      const lift = next < 0 ? 0 : clamp(reach * falloff, 0, 34);
      tset(station.lift, REST[i] + lift, now, distance * 40);
      station.parts[2].body.sil.classList.toggle("hi", i === (next < 0 ? 0 : next));
    });
    read.textContent = next < 0 ? "rest" : NAMES[next];
    loop.wake();
  }

  function hit([sx, sy]) {
    let picked = -1, nearest = Infinity;
    CENTRES.forEach((x, i) => {
      const [wx, wy] = unproj(C, sx, sy, TOP[i] + REST[i]);
      const distance = (wx - x) ** 2 + wy ** 2;
      if (Math.abs(wx - x) <= 30 && Math.abs(wy) <= 36 && distance < nearest) {
        picked = i;
        nearest = distance;
      }
    });
    return picked;
  }

  read.textContent = "rest";
  bag.add(pointer(stage, {
    move: (point) => { const next = hit(point); if (next !== active) target(next); },
    leave: () => { if (active >= 0) target(-1); },
  }));
  bag.add(() => svg.replaceChildren());
  return {
    set: (next) => { reach = next; target(active); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "workbench",
  means: "One fixed workbench, three fixtures: point to plan, execute or verify; the base stays in place.",
  rules: [1, 2, 3, 6, 8],
  range: [14, 24, 34],
  tour: [[138, 115], [200, 129], [262, 169], null],
  mount,
});
