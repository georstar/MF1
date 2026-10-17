// Generates the dancing couple poses as pencil-style SVGs into static/couple/.
// Each figure is drawn facing right from a jointed skeleton; the groom is mirrored.
// Run: node scripts/draw-couple.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#1d1d1d';
const PAPER = '#f4efed';
const W = 360;
const H = 320;
const GROUND = 300;
const SCALE = 0.9;

const rad = (d) => (d * Math.PI) / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const unit = (a) => {
	const l = Math.hypot(a[0], a[1]) || 1;
	return [a[0] / l, a[1] / l];
};
// Angle 0 points down, 90 points forward (+x), 180 points up.
const step = (p, angle, len) => [p[0] + Math.sin(rad(angle)) * len, p[1] + Math.cos(rad(angle)) * len];
const rot = (p, deg, origin = [0, 0]) => {
	const c = Math.cos(rad(deg));
	const s = Math.sin(rad(deg));
	const x = p[0] - origin[0];
	const y = p[1] - origin[1];
	return [origin[0] + x * c - y * s, origin[1] + x * s + y * c];
};
const f = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f(p[0])},${f(p[1])}`;
const poly = (pts) => 'M' + pts.map(pt).join(' L') + ' Z';
// Smooth closed path through points (Catmull-Rom converted to cubic Béziers).
function smooth(pts, closed = true) {
	const n = pts.length;
	const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
	let d = `M${pt(pts[0])}`;
	const last = closed ? n : n - 1;
	for (let i = 0; i < last; i++) {
		const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
		const c1 = add(p1, mul(sub(p2, p0), 1 / 6));
		const c2 = sub(p2, mul(sub(p3, p1), 1 / 6));
		d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
	}
	return closed ? d + ' Z' : d;
}
// Outline around a polyline with a width per point.
function limb(points, widths) {
	const left = [];
	const right = [];
	points.forEach((p, i) => {
		const prev = points[Math.max(0, i - 1)];
		const next = points[Math.min(points.length - 1, i + 1)];
		const d = unit(sub(next, prev));
		const n = [-d[1], d[0]];
		left.push(add(p, mul(n, widths[i] / 2)));
		right.push(sub(p, mul(n, widths[i] / 2)));
	});
	return [...left, ...right.reverse()];
}
const path = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;
const line = (a, b, attrs = '') => `<path d="M${pt(a)} L${pt(b)}" ${attrs}/>`;

const OUTLINE = `fill="${PAPER}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const THIN = `fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"`;

// Shapes in local coordinates, x forward, y down.
const FOOT = [[-6, 3], [-8, 10], [-5, 15], [10, 15.5], [19, 15.2], [23, 14.8], [26.5, 13.6], [27.5, 11.4], [26, 9.6], [22, 8.4], [14, 6], [5, 2], [0, -1]];
const HAND = [[0, -5], [9, -6], [15, -3], [17, 2], [13, 6], [6, 6], [0, 5]];

function foot(ankle, raise) {
	return FOOT.map((p) => add(rot(p, raise), ankle));
}
function hand(wrist, angle) {
	const theta = Math.atan2(Math.cos(rad(angle)), Math.sin(rad(angle))) * (180 / Math.PI);
	return HAND.map((p) => add(rot(p, theta), wrist));
}
function toes(ankle, raise) {
	return [[19, 11.5], [22, 11], [24.5, 10.5]]
		.map((p) => {
			const a = add(rot(p, raise), ankle);
			const b = add(rot([p[0] - 1.5, p[1] + 3], raise), ankle);
			return line(a, b, THIN);
		})
		.join('');
}

function skeleton(body, pose) {
	const hip = [pose.shift ?? 0, 0];
	const u = unit(sub(step(hip, 180 - pose.lean, 1), hip));
	const shoulder = step(hip, 180 - pose.lean, body.torso);
	const neckTop = step(shoulder, 180 - pose.lean - pose.head, body.neck);
	const head = step(neckTop, 180 - pose.lean - pose.head, body.headR * 0.85);
	const legs = ['back', 'front'].map((k) => {
		const l = pose.legs[k];
		const hj = add(hip, [k === 'front' ? 3 : -3, 0]);
		const knee = step(hj, l.thigh, body.thigh);
		const ankle = step(knee, l.shin, body.shin);
		return { hip: hj, knee, ankle, raise: l.foot };
	});
	const arms = ['back', 'front'].map((k) => {
		const a = pose.arms[k];
		const sh = add(shoulder, k === 'back' ? [-4, 2] : [2, 3]);
		const elbow = step(sh, a.upper, body.upper);
		const wrist = step(elbow, a.fore, body.fore);
		return { shoulder: sh, elbow, wrist, fore: a.fore };
	});
	// Ground the figure: lowest foot point touches the ground line.
	const lowest = Math.max(...legs.flatMap((l) => foot(l.ankle, l.raise).map((p) => p[1])));
	return { hip, u, n: [-u[1], u[0]], shoulder, neckTop, head, legs: { back: legs[0], front: legs[1] }, arms: { back: arms[0], front: arms[1] }, dy: GROUND - lowest };
}

function headGroom(c, tilt) {
	const tf = (pts) => pts.map((p) => add(rot(p, tilt), c));
	const face = tf([[-15, -8], [-12, -19], [0, -23], [12, -19], [17, -10], [18, -4], [23, 3], [18, 6], [20, 9], [18, 11], [19, 14], [16, 19], [9, 23], [2, 21], [-6, 14], [-14, 6]]);
	const hair = tf([[-17, -2], [-18, -16], [-6, -27], [8, -28], [20, -22], [12, -21], [6, -18], [-2, -16], [-9, -9], [-11, 0]]);
	const strokes = [
		[[-14, -14], [-4, -24], [10, -26]],
		[[-10, -12], [0, -21], [14, -23]],
		[[-12, -6], [-6, -16], [4, -19]]
	].map((s) => path(smooth(tf(s), false), THIN)).join('');
	const ear = path(smooth(tf([[-4, -3], [-8, -4], [-9, 3], [-5, 5]]), false), THIN);
	return (
		path(smooth(face), OUTLINE) +
		path(smooth(hair), `fill="${PAPER}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`) +
		strokes + ear +
		line(...tf([[7, -9], [13, -8]]), `${THIN} stroke-width="1.4"`) +
		path(smooth(tf([[8, -4], [10, -5.5], [12, -4]]), false), THIN) +
		path(`M${pt(tf([[17, 10]])[0])} L${pt(tf([[19.5, 10]])[0])}`, THIN)
	);
}

function headBride(c, tilt) {
	const tf = (pts) => pts.map((p) => add(rot(p, tilt), c));
	const face = tf([[-14, -8], [-10, -19], [2, -22], [13, -17], [17, -9], [18, -3], [22, 3], [17, 5], [19, 8], [17, 10], [18, 13], [15, 18], [9, 22], [2, 20], [-6, 13], [-13, 5]]);
	const hair = tf([[-19, 14], [-21, -6], [-15, -21], [0, -27], [14, -23], [20, -14], [19, -7], [14, -8], [9, -9], [3, -8], [-1, -6], [-4, 2], [-7, 12]]);
	const fringe = [-1, 3, 7, 11, 15].map((x) => line(...tf([[x, -22], [x + 0.5, -9]]), `${THIN} stroke="${PAPER}" stroke-opacity=".5"`)).join('');
	const flower = [0, 72, 144, 216, 288]
		.map((a) => {
			const p = add(rot([0, -3.6], a), tf([[-9, -24]])[0]);
			return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3" ${OUTLINE} stroke-width="1"/>`;
		})
		.join('') + `<circle cx="${f(tf([[-9, -24]])[0][0])}" cy="${f(tf([[-9, -24]])[0][1])}" r="1.4" fill="${INK}"/>`;
	return (
		path(smooth(face), OUTLINE) +
		path(smooth(hair), `fill="#4a4544" stroke="none"`) +
		path(smooth(hair), `fill="${INK}" stroke="none" filter="url(#grain)"`) +
		path(smooth(hair), `fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"`) +
		fringe + flower +
		line(...tf([[8, -6], [13, -5.5]]), `${THIN} stroke-width="1.3"`) +
		path(smooth(tf([[9, -2], [11, -3.5], [13, -2]]), false), `${THIN} stroke-width="1.3"`) +
		`<circle cx="${f(tf([[17.6, 9]])[0][0])}" cy="${f(tf([[17.6, 9]])[0][1])}" r="1.3" fill="${INK}" opacity=".7"/>`
	);
}

function shadow(s) {
	const xs = [s.legs.back.ankle[0], s.legs.front.ankle[0]];
	const x0 = Math.min(...xs) - 18;
	const x1 = Math.max(...xs) + 34;
	const y = GROUND - s.dy + 1;
	return (
		`<ellipse cx="${f((x0 + x1) / 2)}" cy="${f(y)}" rx="${f((x1 - x0) / 2 + 6)}" ry="3.2" fill="${INK}" opacity=".22" filter="url(#blur)"/>` +
		path(`M${f(x0)},${f(y + 1)} L${f(x1)},${f(y + 0.4)}`, `${THIN} stroke-width="1.3" opacity=".55"`) +
		path(`M${f(x0 + 8)},${f(y + 2.6)} L${f(x1 - 10)},${f(y + 2.4)}`, `${THIN} opacity=".35"`)
	);
}

function groom(pose) {
	const body = { torso: 92, neck: 9, headR: 22, upper: 44, fore: 40, thigh: 62, shin: 60 };
	const s = skeleton(body, pose);
	const { hip, shoulder, n, u } = s;
	const down = [-u[0], -u[1]];
	const suit = (d) => path(d, `fill="${PAPER}" stroke="none"`) + path(d, `fill="#7d7776" stroke="none" filter="url(#grain)"`) + path(d, `fill="url(#hatch)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`);
	const leg = (l, w) => {
		const pts = limb([add(l.hip, [0, -6]), l.knee, l.ankle], [w, w - 3, w - 6]);
		return suit(poly(pts)) + path(poly(foot(l.ankle, l.raise)), OUTLINE) + toes(l.ankle, l.raise) +
			path(poly(limb([l.knee, l.ankle], [w - 3, w - 6])), `fill="url(#hatch2)" stroke="none" opacity=".6"`);
	};
	const arm = (a) =>
		suit(poly(limb([add(a.shoulder, mul(u, 4)), a.elbow, a.wrist], [19, 17, 15]))) +
		path(smooth(hand(a.wrist, a.fore)), OUTLINE) +
		line(...limb([a.wrist], [14]).slice(0, 2), `${THIN} stroke-width="2"`);
	const waist = lerp(hip, shoulder, 0.38);
	const jacket = [
		add(shoulder, mul(n, -23)), add(add(shoulder, mul(n, 4)), mul(u, 5)), add(shoulder, mul(n, 19)),
		add(waist, mul(n, 19)), add(add(hip, mul(n, 21)), mul(down, 20)),
		add(add(hip, mul(n, -23)), mul(down, 22)), add(waist, mul(n, -21))
	];
	const vTop = add(add(shoulder, mul(n, 5)), mul(u, 4));
	const vTip = add(lerp(hip, shoulder, 0.5), mul(n, 17));
	const shirt = [vTop, add(shoulder, mul(n, 17)), vTip];
	const tie = limb([add(add(shoulder, mul(n, 14)), mul(down, 2)), add(lerp(hip, shoulder, 0.42), mul(n, 18))], [4, 6]);
	const neck = poly(limb([s.shoulder, s.neckTop], [16, 15]));
	const pocket = line(add(add(hip, mul(n, 6)), mul(down, 2)), add(add(hip, mul(n, 18)), mul(down, 1)), `${THIN} stroke-width="1.3"`);
	return (
		shadow(s) +
		`<g opacity=".93">${arm(s.arms.back)}</g>` +
		leg(s.legs.back, 25) + leg(s.legs.front, 26) +
		path(neck, OUTLINE) +
		suit(smooth(jacket)) +
		path(poly(shirt), OUTLINE) + path(poly(tie), `fill="${INK}" stroke="${INK}" stroke-width="1"`) +
		line(vTop, vTip, `${THIN} stroke-width="1.5"`) + pocket +
		headGroom(s.head, pose.lean + pose.head) +
		arm(s.arms.front)
	);
}

function bride(pose) {
	const body = { torso: 84, neck: 9, headR: 20, upper: 40, fore: 36, thigh: 56, shin: 56 };
	const s = skeleton(body, pose);
	const { hip, shoulder, n, u } = s;
	const down = [-u[0], -u[1]];
	const waist = lerp(hip, shoulder, 0.32);
	const feet = (l) => path(poly(foot(l.ankle, l.raise)), OUTLINE) + toes(l.ankle, l.raise);
	const arm = (a) =>
		path(poly(limb([add(a.shoulder, mul(u, 3)), a.elbow, a.wrist], [14, 14, 24])), `${OUTLINE} stroke-width="1.5"`) +
		line(...limb([a.wrist], [24]).slice(0, 2), THIN) +
		path(smooth(hand(add(a.wrist, step([0, 0], a.fore, 2)), a.fore)), OUTLINE);

	// Skirt: from the waist to just above the ankles, flaring around the legs.
	const ankles = [s.legs.back.ankle, s.legs.front.ankle];
	const knees = [s.legs.back.knee, s.legs.front.knee];
	const hemY = Math.max(...ankles.map((a) => a[1])) - 7;
	const left = Math.min(...ankles.map((a) => a[0]), ...knees.map((k) => k[0])) - 20 + pose.sway;
	const right = Math.max(...ankles.map((a) => a[0]), ...knees.map((k) => k[0])) + 24 + pose.sway;
	const wl = add(waist, mul(n, -17));
	const wr = add(waist, mul(n, 16));
	const hem = [];
	const waves = 6;
	for (let i = 0; i <= waves; i++) {
		const x = right + ((left - right) * i) / waves;
		hem.push([x, hemY + (i % 2 ? -4 : 3) + (i === 0 || i === waves ? -5 : 0)]);
	}
	const skirt = [wl, add(lerp(wl, [left, hemY], 0.45), [-6 + pose.sway * 0.3, 0]), [left - 4, hemY - 6], ...[...hem].reverse(), [right + 4, hemY - 7], add(lerp(wr, [right, hemY], 0.5), [6 + pose.sway * 0.3, 0]), wr];
	const folds = [0.3, 0.55, 0.78]
		.map((t, i) => {
			const top = lerp(wl, wr, t);
			const bottom = [left + (right - left) * t + pose.sway * 0.5, hemY - 2 - (i % 2) * 3];
			return path(smooth([top, add(lerp(top, bottom, 0.5), [(i - 1) * 3, 0]), bottom], false), `${THIN} opacity=".75"`);
		})
		.join('');
	const ruffle = path(smooth(hem.slice().reverse().map((p) => add(p, [0, -6])), false), `${THIN} opacity=".5"`);
	const bodice = [
		add(shoulder, mul(n, -13)), add(add(shoulder, mul(n, 2)), mul(u, 4)), add(shoulder, mul(n, 13)),
		add(lerp(waist, shoulder, 0.5), mul(n, 17)), wr, add(add(waist, mul(down, 6)), mul(n, 2)), wl,
		add(lerp(waist, shoulder, 0.5), mul(n, -16))
	];
	const neckline = path(smooth([add(add(shoulder, mul(n, 2)), mul(down, 4)), add(add(shoulder, mul(n, 9)), mul(down, 12)), add(add(shoulder, mul(n, 15)), mul(down, 6))], false), THIN);
	const pearls = [0.15, 0.35, 0.55, 0.75, 0.9]
		.map((t) => {
			const p = lerp(add(add(shoulder, mul(n, 3)), mul(down, -1)), add(add(shoulder, mul(n, 15)), mul(down, 1)), t);
			const q = add(p, mul(down, 3 + Math.sin(t * Math.PI) * 4));
			return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="1.6" fill="${PAPER}" stroke="${INK}" stroke-width=".8"/>`;
		})
		.join('');
	const buttons = [0.2, 0.45, 0.7].map((t) => {
		const p = add(lerp(waist, shoulder, t * 0.7), mul(n, 6));
		return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.1" fill="${INK}"/>`;
	}).join('');
	// Veil: from the back of the head, flowing behind to below the waist.
	const hc = s.head;
	const veil = [
		add(hc, [-6, -20]), add(hc, [-24 - pose.veil, -4]), add(shoulder, [-34 - pose.veil, 18]),
		add(waist, [-30 - pose.veil * 1.4, 22]), add(waist, [-18 - pose.veil, 26]), add(waist, [-14, 4]),
		add(shoulder, [-18, 10]), add(hc, [-14, 4])
	];
	const veilFolds = path(smooth([add(hc, [-10, -12]), add(shoulder, [-26 - pose.veil, 14]), add(waist, [-24 - pose.veil * 1.2, 20])], false), `${THIN} opacity=".6"`);
	const neck = poly(limb([shoulder, s.neckTop], [12, 11]));
	return (
		shadow(s) +
		path(smooth(veil), `fill="#fbf8f7" fill-opacity=".85" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"`) + veilFolds +
		`<g opacity=".95">${arm(s.arms.back)}</g>` +
		feet(s.legs.back) + feet(s.legs.front) +
		path(smooth(skirt), `${OUTLINE} stroke-width="1.7"`) + folds + ruffle +
		path(neck, OUTLINE) +
		path(smooth(bodice), OUTLINE) + neckline + pearls + buttons +
		headBride(hc, pose.lean + pose.head) +
		arm(s.arms.front)
	);
}

// The dance: a playful twist, six poses looping.
const L = (thigh, shin, foot) => ({ thigh, shin, foot });
const A = (upper, fore) => ({ upper, fore });
const POSES = [
	{
		bride: { lean: 3, head: 4, shift: 0, sway: 0, veil: 0, legs: { back: L(-6, -16, 24), front: L(16, 0, 0) }, arms: { back: A(-14, 76), front: A(14, 96) } },
		groom: { lean: 5, head: 2, shift: 0, legs: { back: L(-8, -24, 28), front: L(22, -4, 0) }, arms: { back: A(-20, 70), front: A(18, 104) } }
	},
	{
		bride: { lean: 6, head: -3, shift: 4, sway: 6, veil: 4, legs: { back: L(-12, -22, 32), front: L(24, 4, 14) }, arms: { back: A(-24, 60), front: A(24, 124) } },
		groom: { lean: 8, head: 6, shift: 3, legs: { back: L(-4, -14, 8), front: L(34, 0, 22) }, arms: { back: A(-28, 54), front: A(36, 150) } }
	},
	{
		bride: { lean: 1, head: 6, shift: 2, sway: 2, veil: 8, legs: { back: L(4, -8, 6), front: L(8, -14, 28) }, arms: { back: A(-6, 92), front: A(4, 84) } },
		groom: { lean: 2, head: -2, shift: 0, legs: { back: L(14, -2, 0), front: L(8, -18, 30) }, arms: { back: A(-8, 96), front: A(6, 88) } }
	},
	{
		bride: { lean: -2, head: 2, shift: -3, sway: -6, veil: 5, legs: { back: L(18, 2, 12), front: L(-4, -16, 0) }, arms: { back: A(-30, 54), front: A(20, 118) } },
		groom: { lean: -2, head: 4, shift: -2, legs: { back: L(26, 0, 22), front: L(-6, -14, 0) }, arms: { back: A(-34, 50), front: A(26, 120) } }
	},
	{
		bride: { lean: 5, head: -4, shift: 2, sway: 4, veil: 1, legs: { back: L(-14, -28, 36), front: L(26, -4, 8) }, arms: { back: A(-18, 70), front: A(30, 138) } },
		groom: { lean: 6, head: 6, shift: 2, legs: { back: L(-12, -28, 36), front: L(28, -8, 10) }, arms: { back: A(-16, 74), front: A(40, 160) } }
	},
	{
		bride: { lean: 2, head: 3, shift: 0, sway: -2, veil: -2, legs: { back: L(0, -14, 18), front: L(16, 2, 0) }, arms: { back: A(-24, 62), front: A(10, 100) } },
		groom: { lean: 3, head: 0, shift: 0, legs: { back: L(0, -14, 18), front: L(16, 2, 0) }, arms: { back: A(-24, 60), front: A(12, 100) } }
	}
];

function defs(seed) {
	return `<defs>
<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 7}" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.25" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/></filter>
<filter id="blur"><feGaussianBlur stdDeviation="2.2"/></filter>
<pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="4" stroke="${INK}" stroke-width="1.1" opacity=".55"/></pattern>
<pattern id="hatch2" patternUnits="userSpaceOnUse" width="3.4" height="3.4" patternTransform="rotate(-50)"><line x1="0" y1="0" x2="0" y2="3.4" stroke="${INK}" stroke-width="1" opacity=".6"/></pattern>
</defs>`;
}

// Style presets get combined with overrides; keep the last value of a repeated attribute.
function dedupeAttrs(svg) {
	return svg.replace(/<(\w+)((?:\s+[\w:-]+="[^"]*")+)\s*(\/?)>/g, (_, tag, attrs, close) => {
		const map = new Map();
		for (const m of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) map.set(m[1], m[2]);
		return `<${tag} ${[...map].map(([k, v]) => `${k}="${v}"`).join(' ')}${close ? '/' : ''}>`;
	});
}

mkdirSync('static/couple', { recursive: true });
POSES.forEach((p, i) => {
	const b = skeleton({ torso: 84, neck: 9, headR: 20, upper: 40, fore: 36, thigh: 56, shin: 56 }, p.bride);
	const g = skeleton({ torso: 92, neck: 9, headR: 22, upper: 44, fore: 40, thigh: 62, shin: 60 }, p.groom);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Maria and Frank dancing">${defs(11 + i * 3)}
<g filter="url(#pencil)">
<g transform="translate(100 ${f(GROUND - SCALE * (GROUND - b.dy))}) scale(${SCALE})">${bride(p.bride)}</g>
<g transform="translate(262 ${f(GROUND - SCALE * (GROUND - g.dy))}) scale(${-SCALE} ${SCALE})">${groom(p.groom)}</g>
</g></svg>`;
	writeFileSync(`static/couple/pose-${i + 1}.svg`, dedupeAttrs(svg));
	console.log(`pose-${i + 1}.svg ${(svg.length / 1024).toFixed(1)} KB`);
});
