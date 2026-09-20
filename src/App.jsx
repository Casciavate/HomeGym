import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import AuthGate from "./AuthGate.jsx";
import * as db from "./lib/db.js";
import seedHistoryData from "../supabase/seed-history.json";

/* The one real account this training log belongs to. seed-history.json is
   Sandro's actual personal training data — it is only ever imported into
   this account. Any other Google account that signs in starts empty. */
const OWNER_EMAIL = "sandrocasciani1@gmail.com";

/* ------------------------------------------------------------------ */
/*  Design tokens — "Pine & Amber" training journal                    */
/* ------------------------------------------------------------------ */
const C = {
  ink: "#1C2B2A",      // deep pine — text, diagram slates
  paper: "#EDF2EE",    // pale sage — app background
  card: "#FFFFFF",
  line: "#D7E0D9",
  accent: "#F2A03D",   // amber — actions, motion arrows
  accentDark: "#C97E1F",
  done: "#2F7E6D",     // teal — completed
  doneSoft: "#E2F0EB",
  caution: "#C4553B",
  cautionSoft: "#F9E9E4",
  mute: "#5E6F6B",
  amberSoft: "#FBEEDB",
};

const font = {
  display: "'Sora','Avenir Next',system-ui,sans-serif",
  body: "'Inter',system-ui,-apple-system,sans-serif",
};

/* ------------------------------------------------------------------ */
/*  Movement diagrams — schematic stick figures, start → end           */
/*  (dark slate mini-cards, amber arrow = direction of effort)         */
/* ------------------------------------------------------------------ */
/* Slate: framed two-panel movement diagram (1 START -> 2 FINISH) */
function Slate({ children, label }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.ink }}>
      <svg viewBox="0 0 240 122" className="w-full" style={{ display: "block" }}>
        <rect x="6" y="16" width="106" height="98" rx="8" fill="none" stroke="#3A4F4A" strokeWidth="1.5" />
        <rect x="128" y="16" width="106" height="98" rx="8" fill="none" stroke="#3A4F4A" strokeWidth="1.5" />
        <text x="12" y="11" fontSize="9" fill="#8FA79E" fontFamily="sans-serif">1 · START</text>
        <text x="134" y="11" fontSize="9" fill={C.accent} fontFamily="sans-serif">2 · FINISH</text>
        <path d="M114 64 L126 64 M121 59 L126 64 L121 69" stroke={C.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {children}
      </svg>
      <div className="px-3 py-2 text-xs" style={{ color: "#B9CCC4", fontFamily: font.body }}>{label}</div>
    </div>
  );
}
const S = { stroke: "#D9E6DF", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" }; // body
const M = { stroke: "#5E756E", strokeWidth: 2.5, strokeLinecap: "round", fill: "none" };                        // machine
const A = { stroke: C.accent, strokeWidth: 2.5, strokeLinecap: "round", fill: "none" };                         // key cue
const Head = ({ x, y }) => <circle cx={x} cy={y} r={6} {...S} />;
const DB = ({ x, y }) => (
  <g>
    <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="#8FA79E" strokeWidth="3" />
    <rect x={x - 7} y={y - 4} width={3.5} height={8} fill="#8FA79E" />
    <rect x={x + 3.5} y={y - 4} width={3.5} height={8} fill="#8FA79E" />
  </g>
);
const Stack = ({ x, y }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={x} y={y + i * 8} width={12} height={6} rx={1} fill="#3A4F4A" />)}
  </g>
);

const DIAGRAMS = {
  latpulldown: (
    <Slate label="Seated, thighs snug under the pad. Pull the bar from overhead down to your upper chest, elbows driving down and back — then 3 s back up.">
      {/* start: arms up to high bar */}
      <Stack x={96} y={44} /><path d="M18 26 L96 26 M58 26 L58 32" {...M} />
      <path d="M36 32 L80 32" {...S} />
      <Head x={58} y={52} /><path d="M58 58 L58 84" {...S} />
      <path d="M58 60 L40 34 M58 60 L76 34" {...S} />
      <path d="M42 88 L74 88" {...M} />
      <path d="M58 84 L48 90 L48 106 M58 84 L68 90 L68 106" {...S} />
      {/* finish: bar at chest, elbows down */}
      <Stack x={218} y={30} /><path d="M140 26 L218 26 M180 26 L180 58" {...M} />
      <Head x={180} y={44} /><path d="M180 50 L180 84" {...S} />
      <path d="M156 60 L204 60" {...S} />
      <path d="M180 52 L162 60 M180 52 L198 60" {...S} />
      <path d="M172 68 L167 73 M188 68 L193 73" {...A} />
      <path d="M164 88 L196 88" {...M} />
      <path d="M180 84 L170 90 L170 106 M180 84 L190 90 L190 106" {...S} />
    </Slate>
  ),
  row: (
    <Slate label="Sit tall on the machine, chest up, feet braced. Pull the handles to your lower ribs and squeeze the shoulder blades together for 1 s (amber marks) — no shrugging, no rocking.">
      {/* start: arms extended toward handle */}
      <path d="M16 60 L16 100" {...M} /><path d="M18 74 L42 74" {...M} />
      <path d="M46 68 L46 82" {...S} />
      <Head x={76} y={44} /><path d="M76 50 L76 86" {...S} />
      <path d="M76 56 L48 74" {...S} />
      <path d="M60 96 L98 96" {...M} /><path d="M76 86 L62 92 L26 92" {...S} />
      {/* finish: handle at ribs, blades squeezed */}
      <path d="M138 60 L138 100" {...M} /><path d="M140 74 L166 74" {...M} />
      <Head x={198} y={44} /><path d="M198 50 L198 86" {...S} />
      <path d="M198 56 L210 70 L190 74" {...S} />
      <path d="M203 62 L209 58 M203 70 L210 72" {...A} />
      <path d="M182 96 L220 96" {...M} /><path d="M198 86 L184 92 L148 92" {...S} />
    </Slate>
  ),
  rearfly: (
    <Slate label="Hinge forward with a flat back, eyes on the floor, dumbbells hanging. Raise both arms out to the sides like wings — only to shoulder height — then lower slowly.">
      {/* start: hinged, DBs hang */}
      <path d="M20 106 L100 106" {...M} />
      <Head x={42} y={46} /><path d="M48 50 L68 64 L64 106 M68 64 L76 106" {...S} />
      <path d="M52 54 L50 76 M58 58 L56 78" {...S} />
      <DB x={50} y={80} /><DB x={56} y={82} />
      {/* finish: arms out like wings */}
      <path d="M142 106 L222 106" {...M} />
      <Head x={164} y={46} /><path d="M170 50 L190 64 L186 106 M190 64 L198 106" {...S} />
      <path d="M174 54 L150 44 M178 56 L204 46" {...S} />
      <DB x={147} y={42} /><DB x={207} y={44} />
    </Slate>
  ),
  curl: (
    <Slate label="Stand tall, elbows pinned to your ribs (amber dots). Curl the dumbbells up, squeeze, then lower over 2–3 s. If your hips swing, the weight is too heavy.">
      {/* start: DBs at sides */}
      <path d="M20 106 L100 106" {...M} />
      <Head x={58} y={34} /><path d="M58 40 L58 76 M58 76 L48 106 M58 76 L68 106" {...S} />
      <path d="M58 46 L50 70 M58 46 L66 70" {...S} />
      <DB x={49} y={74} /><DB x={67} y={74} />
      {/* finish: curled up, elbows pinned */}
      <path d="M142 106 L222 106" {...M} />
      <Head x={180} y={34} /><path d="M180 40 L180 76 M180 76 L170 106 M180 76 L190 106" {...S} />
      <path d="M180 46 L172 60 L174 44 M180 46 L188 60 L186 44" {...S} />
      <circle cx={172} cy={60} r={2.5} fill={C.accent} /><circle cx={188} cy={60} r={2.5} fill={C.accent} />
      <DB x={174} y={40} /><DB x={186} y={40} />
    </Slate>
  ),
  yraise: (
    <Slate label="Lie face-down on the mat, arms overhead in a Y, thumbs up, chin gently tucked. Lift the arms just a few centimetres by squeezing the lower shoulder blades — hold 1–2 s.">
      {/* start: prone, arms on floor */}
      <path d="M14 98 L104 98" {...M} />
      <Head x={78} y={90} /><path d="M72 92 L30 94" {...S} />
      <path d="M70 88 L52 84 M70 92 L50 92" {...S} />
      {/* finish: arms lifted in Y */}
      <path d="M136 98 L226 98" {...M} />
      <Head x={200} y={90} /><path d="M194 92 L152 94" {...S} />
      <path d="M192 88 L174 74 M192 90 L170 80" {...S} />
      <path d="M182 84 Q186 76 192 74" {...A} />
    </Slate>
  ),
  deadbug: (
    <Slate label="On your back, arms straight up, knees stacked over hips at 90°. Press the lower back into the mat and keep it there while the opposite arm and leg lower slowly. Exhale down.">
      {/* start: arms up, knees at 90 */}
      <path d="M14 100 L104 100" {...M} />
      <Head x={30} y={92} /><path d="M36 94 L82 94" {...S} />
      <path d="M46 92 L46 68 M68 92 L68 74 L82 66" {...S} />
      {/* finish: opposite arm & leg lowered */}
      <path d="M136 100 L226 100" {...M} />
      <Head x={152} y={92} /><path d="M158 94 L204 94" {...S} />
      <path d="M168 92 L186 78 M204 94 L222 88" {...S} />
      <path d="M158 84 L150 78" {...A} />
    </Slate>
  ),
  chestpress: (
    <Slate label="Seat set so the handles sit at mid-chest. Pull the shoulder blades back and down INTO the pad (amber marks) and keep them pinned while you press — don't let the shoulders roll forward at the end.">
      {/* start: hands at chest, blades pinned to pad */}
      <path d="M40 34 L40 96 M32 96 L70 96" {...M} />
      <Head x={52} y={38} /><path d="M52 44 L52 78 M52 78 L68 92" {...S} />
      <path d="M52 50 L64 54 M52 54 L64 60" {...S} />
      <path d="M68 48 L68 66" {...S} />
      <path d="M45 52 L40 56 M45 62 L40 66" {...A} />
      {/* finish: arms extended, blades still pinned */}
      <path d="M162 34 L162 96 M154 96 L192 96" {...M} />
      <Head x={174} y={38} /><path d="M174 44 L174 78 M174 78 L190 92" {...S} />
      <path d="M174 50 L206 52 M174 54 L206 58" {...S} />
      <path d="M210 46 L210 64" {...S} />
      <path d="M167 52 L162 56 M167 62 L162 66" {...A} />
    </Slate>
  ),
  legpress: (
    <Slate label="Feet shoulder-width in the middle of the plate. Lower until the knees reach ~90° (or just before the lower back curls off the pad), then push through the whole foot — never slam into a locked knee.">
      {/* start: knees bent ~90 */}
      <path d="M18 50 L44 82 M22 46 L48 78" {...M} />
      <Head x={34} y={56} /><path d="M38 60 L52 76" {...S} />
      <path d="M52 76 L72 62 L80 78" {...M} strokeWidth="0" />
      <path d="M52 76 L70 64 L78 80" {...S} />
      <path d="M84 52 L92 92" {...M} />
      {/* finish: legs extended, knees soft */}
      <path d="M140 50 L166 82 M144 46 L170 78" {...M} />
      <Head x={156} y={56} /><path d="M160 60 L174 76" {...S} />
      <path d="M174 76 L192 68 L206 62" {...S} />
      <path d="M210 46 L218 86" {...M} />
    </Slate>
  ),
  shoulderpress: (
    <Slate label="Handles start at about ear height. Ribs down, back on the pad, no shrugging — press only through the range that is completely pain-free.">
      {/* start: hands at ear height */}
      <path d="M44 30 L44 96 M34 96 L72 96" {...M} />
      <Head x={56} y={40} /><path d="M56 46 L56 80 M56 80 L70 94" {...S} />
      <path d="M56 50 L46 40 M56 50 L66 40" {...S} />
      <circle cx={46} cy={37} r={4} {...S} /><circle cx={66} cy={37} r={4} {...S} />
      {/* finish: pressed up, shoulders down */}
      <path d="M166 30 L166 96 M156 96 L194 96" {...M} />
      <Head x={178} y={46} /><path d="M178 52 L178 84 M178 84 L192 96" {...S} />
      <path d="M178 56 L170 32 M178 56 L186 32" {...S} />
      <circle cx={170} cy={28} r={4} {...S} /><circle cx={186} cy={28} r={4} {...S} />
      <path d="M170 60 L165 64 M186 60 L191 64" {...A} />
    </Slate>
  ),
  rdl: (
    <Slate label="Stand tall, dumbbells against the thighs, soft knees. Push the hips straight back so the dumbbells slide close down the legs. Stop at mid-shin — the amber line is your flat back; it never rounds.">
      {/* start: standing tall */}
      <path d="M20 106 L100 106" {...M} />
      <Head x={58} y={32} /><path d="M58 38 L58 76 M58 76 L50 106 M58 76 L66 106" {...S} />
      <path d="M58 44 L52 68 M58 44 L64 68" {...S} />
      <DB x={51} y={72} /><DB x={65} y={72} />
      {/* finish: hinged, flat back, DBs mid-shin */}
      <path d="M142 106 L222 106" {...M} />
      <Head x={202} y={52} /><path d="M196 56 L172 68 M172 68 L168 106 M172 68 L180 106" {...S} />
      <path d="M196 60 L188 86" {...S} />
      <DB x={186} y={90} />
      <path d="M198 50 L174 64" {...A} />
    </Slate>
  ),
  sideplank: (
    <Slate label="Elbow directly under the shoulder, hips lifted. Aim for one straight line from ear to ankle (amber guide). Start from the knees if the full version is too much — breathe throughout.">
      {/* start: from knees */}
      <path d="M14 104 L104 104" {...M} />
      <Head x={34} y={80} /><path d="M40 84 L70 96 L88 102" {...S} />
      <path d="M44 86 L44 104" {...S} />
      {/* finish: full side plank, straight line */}
      <path d="M136 104 L226 104" {...M} />
      <Head x={156} y={70} /><path d="M162 74 L214 100" {...S} />
      <path d="M168 78 L168 104" {...S} />
      <path d="M154 64 L220 96" {...A} strokeDasharray="4 4" />
    </Slate>
  ),
  lateralraise: (
    <Slate label="Stand tall, soft elbows. Raise the dumbbells out to the sides to shoulder height only — no higher — and lower under control.">
      <path d="M20 106 L100 106" {...M} />
      <Head x={58} y={34} /><path d="M58 40 L58 76 M58 76 L48 106 M58 76 L68 106" {...S} />
      <path d="M58 46 L52 70 M58 46 L64 70" {...S} />
      <DB x={51} y={74} /><DB x={65} y={74} />
      <path d="M142 106 L222 106" {...M} />
      <Head x={180} y={34} /><path d="M180 40 L180 76 M180 76 L170 106 M180 76 L190 106" {...S} />
      <path d="M180 46 L154 48 M180 46 L206 48" {...S} />
      <DB x={149} y={48} /><DB x={211} y={48} />
    </Slate>
  ),
  dbrow: (
    <Slate label="One knee and hand on the bench, back flat like a table, eyes down. Pull the dumbbell to your hip, elbow leading; squeeze the shoulder blade 1 s, lower slowly.">
      <path d="M24 84 L92 84 M30 84 L30 104 M86 84 L86 104" {...M} />
      <Head x={36} y={50} /><path d="M42 54 L74 58" {...S} />
      <path d="M46 56 L44 84 M70 58 L74 84" {...S} />
      <path d="M74 58 L92 76 L92 104" {...S} />
      <path d="M58 58 L58 76" {...S} /><DB x={58} y={80} />
      <path d="M146 84 L214 84 M152 84 L152 104 M208 84 L208 104" {...M} />
      <Head x={158} y={50} /><path d="M164 54 L196 58" {...S} />
      <path d="M168 56 L166 84 M192 58 L196 84" {...S} />
      <path d="M196 58 L214 76 L214 104" {...S} />
      <path d="M180 58 L186 66" {...S} /><DB x={187} y={70} />
      <path d="M176 52 L171 47 M184 54 L189 49" {...A} />
    </Slate>
  ),
  goblet: (
    <Slate label="Dumbbell held upright against the chest, elbows tucked. Sit down between your heels, chest proud, heels planted — then push the floor away to stand.">
      <path d="M20 106 L100 106" {...M} />
      <Head x={58} y={30} /><path d="M58 36 L58 74 M58 74 L50 106 M58 74 L66 106" {...S} />
      <path d="M58 44 L52 52 M58 44 L64 52" {...S} /><DB x={58} y={54} />
      <path d="M142 106 L222 106" {...M} />
      <Head x={176} y={54} /><path d="M176 60 L184 80" {...S} />
      <path d="M184 80 L200 86 L198 106 M184 80 L188 106" {...S} />
      <path d="M178 64 L174 72" {...S} /><DB x={180} y={70} />
      <path d="M172 50 L182 78" {...A} strokeDasharray="4 4" />
    </Slate>
  ),
  legext: (
    <Slate label="Knees lined up with the machine's pivot, shin pad just above the ankles. Straighten the knees to lift the pad, pause 1 s at the top, lower over 2–3 s.">
      <path d="M36 40 L36 88 M36 78 L72 78 M36 88 L30 104" {...M} />
      <Head x={48} y={42} /><path d="M48 48 L48 78" {...S} />
      <path d="M48 78 L70 74 L74 96" {...S} /><circle cx={76} cy={99} r={5} {...M} />
      <path d="M158 40 L158 88 M158 78 L194 78 M158 88 L152 104" {...M} />
      <Head x={170} y={42} /><path d="M170 48 L170 78" {...S} />
      <path d="M170 78 L192 74 L214 68" {...S} /><circle cx={218} cy={68} r={5} {...M} />
      <path d="M204 80 L212 72" {...A} />
    </Slate>
  ),
  legcurl: (
    <Slate label="Same seat as the extension, pad behind the ankles. Curl the pad down and under you by bending the knees; return slowly — don't let the stack slam.">
      <path d="M36 40 L36 88 M36 78 L72 78" {...M} />
      <Head x={48} y={42} /><path d="M48 48 L48 78" {...S} />
      <path d="M48 78 L70 74 L94 70" {...S} /><circle cx={98} cy={70} r={5} {...M} />
      <path d="M158 40 L158 88 M158 78 L194 78" {...M} />
      <Head x={170} y={42} /><path d="M170 48 L170 78" {...S} />
      <path d="M170 78 L192 74 L196 96" {...S} /><circle cx={198} cy={100} r={5} {...M} />
      <path d="M210 76 Q212 88 202 96" {...A} />
    </Slate>
  ),
  rower: (
    <Slate label="Order every stroke: legs push → body leans back slightly → arms pull the handle to the lower ribs. Reverse on the way forward. Long spine, no slouching at the catch.">
      {/* start: the catch — knees bent, arms forward */}
      <path d="M14 98 L104 98 M20 92 L98 92" {...M} />
      <Head x={62} y={58} /><path d="M60 64 L52 84" {...S} />
      <path d="M58 68 L36 76" {...S} />
      <path d="M52 84 L38 70 L26 84" {...S} /><path d="M22 78 L22 92" {...M} />
      {/* finish: legs long, lean back, handle at ribs */}
      <path d="M136 98 L226 98 M142 92 L220 92" {...M} />
      <Head x={168} y={56} /><path d="M170 62 L178 84" {...S} />
      <path d="M172 66 L186 76 L172 78" {...S} />
      <path d="M178 84 L200 86 L216 84" {...S} /><path d="M144 78 L144 92" {...M} />
    </Slate>
  ),
  bike: (
    <Slate label="Saddle height: a slight knee bend at the bottom of the pedal stroke. Sit tall with a long spine — don't collapse onto the handlebars. 'Brisk' = you can speak in short phrases, not full sentences.">
      {/* start: slumped (what to avoid is the contrast) -> shown upright small vs tall */}
      <circle cx={36} cy={94} r={12} {...M} /><circle cx={84} cy={94} r={12} {...M} />
      <path d="M36 94 L58 70 L84 94 M58 70 L58 62 M50 62 L66 62" {...M} />
      <Head x={70} y={44} /><path d="M68 50 L60 66 M60 66 L52 78" {...S} />
      <path d="M66 54 L54 60" {...S} />
      <circle cx={158} cy={94} r={12} {...M} /><circle cx={206} cy={94} r={12} {...M} />
      <path d="M158 94 L180 70 L206 94 M180 70 L180 62 M172 62 L188 62" {...M} />
      <Head x={186} y={38} /><path d="M186 44 L182 66 M182 66 L174 78" {...S} />
      <path d="M186 50 L176 60" {...S} />
      <path d="M190 34 L190 50" {...A} strokeDasharray="4 4" />
    </Slate>
  ),
};

/* ------------------------------------------------------------------ */
/*  The program                                                        */
/* ------------------------------------------------------------------ */
const PHASES = [
  {
    name: "Phase 1 · Foundation & posture",
    span: "Months 1–2 (sessions 1–16)",
    focus: "Learn the movements, wake up the mid-back, build the habit. Effort ~RPE 6–7 (you could always do 3–4 more reps).",
    rules: [
      "Same weight both weekly sessions until every set hits the top of the rep range with clean form.",
      "Then add the smallest increment (1–2 kg dumbbells, one pin on machines) and work back up.",
      "Never chase reps at the cost of the posture cues — a shorter, cleaner set wins.",
    ],
  },
  {
    name: "Phase 2 · Hypertrophy",
    span: "Months 3–4 (sessions 17–32)",
    focus: "Build muscle, especially back, shoulders and arms. Effort ~RPE 7–8 (1–3 reps left in the tank). Rows and pulldowns get a 4th set.",
    rules: [
      "Double progression: hit top of rep range on all sets two sessions in a row → add weight.",
      "Rest stays 60–90 s to keep sessions inside 45 min.",
      "If left shoulder/neck feels cranky, drop shoulder-press weight 20% that day rather than skipping.",
    ],
  },
  {
    name: "Phase 3 · Intensification",
    span: "Months 5–6 (sessions 33–48)",
    focus: "Heavier main lifts (8–10 reps) while rear-delt/posture work stays higher-rep. Effort ~RPE 8. Cardio finishers get slightly harder intervals.",
    rules: [
      "Main presses, rows, pulldown, leg press: 8–10 reps, add weight when 3×10 is clean.",
      "Rear-delt fly, Y-raise, curls stay 12–15 / 10–12 for quality contractions.",
      "Deload on week 24: halve the sets, keep the weights, then reassess goals.",
    ],
  },
];

// setsByPhase / repsByPhase indexed by phase 0..2
const EXERCISES = {
  A: [
    {
      id: "latpulldown", name: "Lat pulldown (your 'shoulder pull' machine)", machine: true,
      target: "Lats, upper back, biceps (assist)",
      why: "Builds the width and pulling strength that anchors your shoulders down and back — directly attacks the rounded-shoulder pattern and feeds the visible-back goal.",
      setsByPhase: [3, 4, 4], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "Roughly 25–35 kg on the stack — treat this as a placeholder and find a weight that feels ~RPE 6–7 in set 1.",
      rest: "90 s",
      cues: [
        "Set the thigh pad so your legs are snug and you can't lift off the seat.",
        "With the bar attachment: grip slightly wider than shoulders, palms forward. If only the rope is hooked on (as in your photo), grab both rope ends, palms facing each other.",
        "Lift your chest, then pull the bar to your upper chest by driving elbows down and back.",
        "Squeeze shoulder blades down and together for a beat at the bottom.",
        "Return over ~3 seconds; keep only a slight backward lean throughout.",
      ],
      caution: "Never pull behind the neck. If your left neck/shoulder feels stiff that day, keep the grip a little narrower and stop the pull at chin height.",
      demo: "Search “lat pulldown form” on YouTube",
      dia: "latpulldown",
    },
    {
      id: "dbrow", name: "One-arm dumbbell row", machine: false,
      target: "Rhomboids, mid-traps, lats, rear shoulders",
      why: "Your #1 posture exercise (replacing the row machine your gym doesn't have) — it strengthens exactly the muscles that pull a rounded upper back upright, one side at a time with the spine fully supported.",
      setsByPhase: [3, 4, 4], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "10–14 kg — find ~RPE 6–7; the shoulder-blade squeeze matters more than the number.",
      rest: "60–90 s (after both sides)",
      cues: [
        "Left knee and left hand on a flat bench (or brace on the chest-press seat), right foot on the floor.",
        "Back flat like a table, neck in line — eyes on the floor just ahead of you.",
        "Dumbbell hangs straight down from the working arm.",
        "Pull it up toward your hip, elbow leading, and squeeze the shoulder blade toward your spine for 1 s.",
        "Lower over 2–3 s. All reps on one side, then switch.",
      ],
      caution: "Don't twist the torso to hoist the weight, and keep the neck long — craning your head up aggravates the stiff left side. Rowing with the left arm, go one step lighter if the shoulder complains.",
      demo: "Search “one arm dumbbell row form” on YouTube",
      dia: "dbrow",
    },
    {
      id: "rearfly", name: "Dumbbell rear-delt fly", machine: false,
      target: "Rear delts, upper-back stabilisers",
      why: "Rear delts are almost always the weak link in a rounded-shoulder posture, and building them adds visible 3-D shape to your shoulders.",
      setsByPhase: [3, 3, 3], repsByPhase: ["12–15", "12–15", "12–15"],
      start: "4–6 kg per hand — genuinely light; this one is easy to cheat.",
      rest: "60 s",
      cues: [
        "Sit on the end of a bench (or stand), hinge forward with a flat back.",
        "Let the dumbbells hang under your chest, slight elbow bend.",
        "Raise both arms out to the sides like wings, to shoulder height only.",
        "Lower under control — no swinging, no bouncing at the bottom.",
      ],
      caution: "Look at the floor to keep your neck neutral — craning your head up strains the stiff side. If your lower back rounds, sit and brace your chest on your thighs.",
      demo: "Search “bent over rear delt fly dumbbell” on YouTube",
      dia: "rearfly",
    },
    {
      id: "curl", name: "Dumbbell biceps curl", machine: false,
      target: "Biceps",
      why: "Direct work for your arm-size goal. Pulling days pre-fatigue the biceps, so curls slot in perfectly here.",
      setsByPhase: [3, 3, 3], repsByPhase: ["10–12", "10–12", "10–12"],
      start: "6–8 kg per hand.",
      rest: "60–75 s",
      cues: [
        "Stand tall, dumbbells at your sides, palms forward.",
        "Pin your elbows to your ribs — they don't drift forward.",
        "Curl up, squeeze at the top, lower over ~2–3 seconds.",
        "If you have to swing your hips, the weight is too heavy.",
      ],
      demo: "Search “dumbbell biceps curl form” on YouTube",
      dia: "curl",
    },
    {
      id: "yraise", name: "Prone Y-raise (mat)", machine: false,
      target: "Lower traps — the posture muscles",
      why: "Lower traps rotate the shoulder blades into a healthy position. Tiny movement, outsized effect on kyphotic rounding.",
      setsByPhase: [2, 2, 2], repsByPhase: ["10", "10–12", "10–12"],
      start: "Bodyweight or 1 kg plates — this should burn, not strain.",
      rest: "45 s",
      cues: [
        "Lie face-down on the mat, arms overhead in a Y, thumbs pointing up.",
        "Tuck your chin slightly (double-chin), forehead near the mat.",
        "Lift both arms a few centimetres by squeezing the lower shoulder blades.",
        "Hold 1–2 seconds, lower slowly. Small and strict beats big and sloppy.",
      ],
      demo: "Search “prone Y raise lower trap” on YouTube",
      dia: "yraise",
    },
    {
      id: "deadbug", name: "Finisher · Dead bug", machine: false, finisher: true,
      target: "Deep core",
      why: "Trains the core to hold a neutral spine — supports every other lift and the belly-fat goal (paired with the cardio).",
      setsByPhase: [2, 2, 3], repsByPhase: ["8/side", "10/side", "10/side"],
      start: "Bodyweight.",
      rest: "45 s",
      cues: [
        "Lie on your back, arms up, knees over hips at 90°.",
        "Press your lower back gently into the mat and keep it there.",
        "Lower your right arm and left leg slowly toward the floor; return; switch.",
        "Exhale as the limbs lower. If your back arches off the mat, shorten the range.",
      ],
      demo: "Search “dead bug exercise form” on YouTube",
      dia: "deadbug",
    },
    {
      id: "rowerfin", name: "Finisher · Rowing machine (optional)", machine: true, finisher: true,
      target: "Conditioning + more posture-friendly pulling",
      why: "8 minutes easy-moderate rowing burns calories and rehearses the same 'legs–lean–pull, blades back' pattern the whole session is built on.",
      setsByPhase: [1, 1, 1], repsByPhase: ["8 min easy", "8–10 min", "10 min w/ 4×30 s brisk"],
      start: "Damper 3–4, conversational pace.",
      rest: "—",
      cues: [
        "Order each stroke: legs push → body leans back slightly → arms pull to lower ribs.",
        "Reverse on the way forward: arms → body → legs.",
        "Long spine, no slouching at the catch.",
      ],
      demo: "Search “rowing machine technique basics” on YouTube",
      dia: "rower",
    },
  ],
  B: [
    {
      id: "chestpress", name: "Chest press (machine)", machine: true,
      target: "Chest, front delts, triceps",
      why: "Builds the chest so fat there sits over muscle instead of nothing — and done with retracted shoulder blades it reinforces, rather than fights, your posture work.",
      setsByPhase: [3, 3, 4], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "Roughly 20–30 kg on the stack — placeholder; find ~RPE 6–7.",
      rest: "90 s",
      cues: [
        "Set the seat so the handles sit at mid-chest height.",
        "Pull your shoulder blades back and down INTO the pad before the first rep — keep them pinned the whole set.",
        "Press until arms are almost straight; don't let the shoulders roll forward at the end.",
        "Lower over 2–3 seconds until hands are near your chest.",
      ],
      caution: "Posture flag: the pinned-blades cue is non-negotiable for you — pressing with rounded shoulders would feed the exact pattern we're fixing.",
      demo: "Search “chest press machine form” on YouTube",
      dia: "chestpress",
    },
    {
      id: "goblet", name: "Goblet squat (dumbbell)", machine: false,
      target: "Quads, glutes, core",
      why: "Your main leg builder (no leg-press machine here). Holding the dumbbell at your chest forces an upright torso — it trains the exact posture you're chasing while working the biggest muscles in your body for the fat-loss goal.",
      setsByPhase: [3, 3, 3], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "10–14 kg held at the chest (14 kg is your heaviest dumbbell — once it feels easy, slow the descent to 4 s instead of adding weight).",
      rest: "90 s",
      cues: [
        "Hold one dumbbell vertically against your chest, elbows tucked in, feet shoulder-width, toes slightly out.",
        "Sit down between your heels — chest proud, heels glued to the floor.",
        "Go as deep as you can while the back stays tall (thighs near parallel is plenty).",
        "Push the floor away to stand; squeeze the glutes at the top.",
      ],
      caution: "If your heels lift or your upper back rounds, stop the depth right there — range grows with practice.",
      demo: "Search “goblet squat form” on YouTube",
      dia: "goblet",
    },
    {
      id: "legext", name: "Leg extension (optional)", machine: true, finisher: true,
      target: "Quads",
      why: "Your leg-extension machine, for extra quad volume. Alternate it with the leg curl — one of the two per session. Skip when time is tight; it won't roll over.",
      setsByPhase: [2, 2, 2], repsByPhase: ["12–15", "12–15", "12–15"],
      start: "Roughly 15–25 kg on the stack — placeholder; pick ~RPE 6–7.",
      rest: "60 s",
      cues: [
        "Adjust the back pad so your knees line up with the machine's pivot point.",
        "Shin pad just above the ankles.",
        "Straighten the knees to lift the pad; pause 1 s at the top.",
        "Lower over 2–3 s — don't let the stack slam.",
      ],
      demo: "Search “leg extension machine form” on YouTube",
      dia: "legext",
    },
    {
      id: "legcurl", name: "Leg curl (optional)", machine: true, finisher: true,
      target: "Hamstrings",
      why: "The seated leg-curl machine from your photos. Machines load the hamstrings better than your 14 kg dumbbells can — pick EITHER leg curl or leg extension per session and alternate weeks.",
      setsByPhase: [2, 2, 2], repsByPhase: ["12–15", "12–15", "12–15"],
      start: "You did 3×10 at 20 kg today — stay around there and build reps first.",
      rest: "60 s",
      cues: [
        "Adjust the back pad so your knees line up with the machine's pivot point.",
        "Ankle pad sits behind the lower calves.",
        "Curl the pad down and under you by bending the knees; pause 1 s.",
        "Return over 2–3 s — no stack slamming.",
      ],
      demo: "Search “seated leg curl machine form” on YouTube",
      dia: "legcurl",
    },
    {
      id: "shoulderpress", name: "Shoulder press (machine)", machine: true,
      target: "Delts",
      why: "Caps the shoulders — visible shoulders make the waist look smaller and complete the posture-driven upper-body look. Your Technogym unit has an adjustable seat, so the start position can be set where your left shoulder is comfortable.",
      setsByPhase: [2, 3, 3], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "You pressed 10 kg for 3×10 today — that's your working weight; the app pre-fills it.",
      rest: "90 s",
      cues: [
        "Set the seat (yellow lever) so the handles start at about ear height.",
        "Back against the pad, ribs down, no shrugging toward the ears.",
        "Press up only through the range that is completely pain-free; stopping short of lockout is fine.",
        "Lower over 2–3 s back to ear height — not deeper if that pinches.",
      ],
      caution: "Your flag exercise for the stiff left side. Warm the shoulders first (arm circles + one very light set). Any pinching → swap to dumbbell lateral raises (4–6 kg, 3×12–15, only to shoulder height).",
      demo: "Search “Technogym shoulder press machine” on YouTube",
      dia: "shoulderpress",
    },
    {
      id: "rdl", name: "Dumbbell Romanian deadlift", machine: false,
      target: "Hamstrings, glutes, spinal erectors",
      why: "Strengthens the whole back side of your body — the postural chain from hips to mid-back — and it's a big calorie-hungry movement for the fat-loss goal.",
      setsByPhase: [3, 3, 3], repsByPhase: ["10–12", "10–12", "8–10"],
      start: "10–14 kg per hand (14 kg is your ceiling, so progress by slowing the lowering to 4 s, adding reps, or moving to single-leg RDLs).",
      rest: "90 s",
      cues: [
        "Stand tall, dumbbells in front of your thighs, soft knees.",
        "Push your hips straight back — the dumbbells slide down your thighs, staying close.",
        "Stop around mid-shin, or the moment your back wants to round.",
        "Drive hips forward to stand; squeeze glutes at the top, don't lean back.",
      ],
      caution: "Flat back is the rule. Film a set from the side on your phone the first few weeks — if the upper back rounds, shorten the range.",
      demo: "Search “dumbbell Romanian deadlift form” on YouTube",
      dia: "rdl",
    },
    {
      id: "hammercurl", name: "Dumbbell hammer curl", machine: false,
      target: "Biceps + brachialis (arm thickness)",
      why: "Your second weekly arm hit. The neutral grip builds the brachialis, which pushes the biceps up and makes arms look thicker from every angle.",
      setsByPhase: [2, 3, 3], repsByPhase: ["10–12", "10–12", "10–12"],
      start: "6–8 kg per hand.",
      rest: "60 s",
      cues: [
        "Dumbbells at your sides, palms facing each other — keep them that way.",
        "Elbows pinned; curl up, lower over 2–3 seconds.",
        "No hip swing; slow down before you cheat.",
      ],
      demo: "Search “hammer curl form” on YouTube",
      dia: "curl",
    },
    {
      id: "sideplank", name: "Finisher · Side plank", machine: false, finisher: true,
      target: "Obliques, lateral core",
      why: "Tightens the waist-line musculature and stabilises the trunk for the hinge and press work.",
      setsByPhase: [2, 2, 3], repsByPhase: ["20–30 s/side", "30–40 s/side", "40 s/side"],
      start: "From knees if a full side plank is too much at first.",
      rest: "45 s",
      cues: [
        "Elbow under shoulder, body in one straight line ear → ankle.",
        "Lift the hips; don't let them sag or pike.",
        "Breathe — holding your breath means you're overreaching the hold time.",
      ],
      demo: "Search “side plank form” on YouTube",
      dia: "sideplank",
    },
    {
      id: "stepfin", name: "Finisher · Bike, cross-trainer or incline walk (optional)", machine: true, finisher: true,
      target: "Conditioning / fat loss",
      why: "Low-impact intervals on whichever cardio machine is free — upright or recumbent bike, the cross-trainer, or an incline walk on the treadmill — to push the session's calorie burn without eating into recovery.",
      setsByPhase: [1, 1, 1], repsByPhase: ["8 min: 30 s brisk / 90 s easy", "10 min: 30/90", "10 min: 40 s brisk / 80 s easy"],
      start: "‘Brisk’ = you can speak in short phrases, not full sentences.",
      rest: "—",
      cues: [
        "Bike: saddle height gives a slight knee bend at the bottom of the stroke; sit tall.",
        "Cross-trainer: stand tall — the handles are for rhythm, not for hanging your weight on.",
        "Treadmill: brisk walk at a solid incline, no hands on the rails, eyes ahead.",
      ],
      demo: "Search “incline treadmill walking form” or “elliptical technique” on YouTube",
      dia: "bike",
    },
  ],
};

const KNOWN_IDS = new Set([...EXERCISES.A, ...EXERCISES.B].map((e) => e.id));

const WARMUP = {
  A: ["2 min very easy rowing machine", "10 arm circles each way", "8 cat-cows on the mat", "10 wall slides (back to wall, slide arms up/down)"],
  B: ["2 min easy bike, cross-trainer or treadmill", "10 arm circles each way", "10 bodyweight squats", "8 hip hinges with hands on hips (RDL rehearsal)", "5 slow bodyweight squats holding a post if needed"],
};

const SESSION_META = {
  A: { day: "Wednesday", title: "Pull & posture", blurb: "Back, rear delts, biceps, core — the posture engine room." },
  B: { day: "Saturday", title: "Push, legs & engine", blurb: "Chest, shoulders, legs, arms, conditioning." },
};

/* ------------------------------------------------------------------ */
/*  Schedule helpers                                                   */
/* ------------------------------------------------------------------ */
function buildSchedule(n = 60) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < n) {
    const dow = d.getDay();
    if (dow === 3) out.push({ date: new Date(d), type: "A" });
    if (dow === 6) out.push({ date: new Date(d), type: "B" });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const fmt = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function phaseForCount(count) { return Math.min(2, Math.floor(count / 16)); }

/* Next session alternates from the last completed one (A after B, B after A), regardless of calendar drift. */
function nextSessionFor(schedule, history) {
  const lastType = history.length ? history[history.length - 1].type : null;
  const wanted = lastType === "A" ? "B" : lastType === "B" ? "A" : (schedule[0] ? schedule[0].type : "A");
  return schedule.find((s) => s.type === wanted) || schedule[0];
}

/* Suggested starting loads (kg). Estimates only — machines vary; adjust to ~RPE 6-7. */
const SUGGEST_KG = {
  latpulldown: 20, dbrow: 12, rearfly: 5, curl: 7, yraise: 0, deadbug: 0, rowerfin: 0,
  chestpress: 25, goblet: 12, legext: 20, legcurl: 20, shoulderpress: 10, rdl: 12, hammercurl: 7, sideplank: 0, stepfin: 0,
};
const repsLow = (s) => { const m = String(s).match(/\d+/); return m ? m[0] : ""; };

function lastWeightFor(exId, history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const sets = [...((h.logs && h.logs[exId]) || []), ...((h.carryLogs && h.carryLogs[exId]) || [])]
      .filter((s) => s.done && s.weight);
    if (sets.length) return sets[sets.length - 1].weight;
  }
  return null;
}

/* ---- Double progression: suggest a small weight bump only after enough clean sessions ----
   "Clean" = every completed set at the SAME weight met the low end of the target rep range.
   Default: 2 consecutive clean sessions at that weight → bump.
   Shoulder press requires 3, given the user's stiff-shoulder caution — an extra margin before adding load. */
const PROGRESSION_INCREMENT = {
  latpulldown: 2, dbrow: 2, rdl: 2, goblet: 2, legext: 2, legcurl: 2,
  hammercurl: 1, curl: 1, rearfly: 1, chestpress: 2.5, shoulderpress: 1,
};
const PROGRESSION_REQUIRED = { shoulderpress: 3 };
const DUMBBELL_MAX = 14; // heaviest pair/single dumbbell available — never suggest above this
const DUMBBELL_IDS = new Set(["dbrow", "rdl", "goblet", "hammercurl", "curl", "rearfly"]);

function sessionsWithExercise(exId, history) {
  return history
    .map((h) => ({ sets: (h.logs && h.logs[exId]) || (h.carryLogs && h.carryLogs[exId]) || null, date: h.date }))
    .filter((x) => x.sets && x.sets.length)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function suggestedWeight(ex, history, phase) {
  const last = lastWeightFor(ex.id, history);
  if (last == null || last === "") return null;               // no numeric weight yet (or bodyweight exercise)
  const lowReps = parseInt(repsLow(ex.repsByPhase[phase]), 10);
  if (!lowReps) return null;
  const need = PROGRESSION_REQUIRED[ex.id] || 2;
  const recent = sessionsWithExercise(ex.id, history).slice(-need);
  if (recent.length < need) return null;                       // not enough history yet — hold
  const allClean = recent.every(({ sets }) => {
    const done = sets.filter((s) => s.done);
    if (!done.length) return false;
    return done.every((s) => s.weight === last && parseInt(s.reps || "0", 10) >= lowReps);
  });
  if (!allClean) return null;                                  // any miss or weight change breaks the streak
  const inc = PROGRESSION_INCREMENT[ex.id];
  if (!inc) return null;
  let bumped = Math.round((parseFloat(last) + inc) * 10) / 10;
  if (DUMBBELL_IDS.has(ex.id)) bumped = Math.min(bumped, DUMBBELL_MAX);
  return bumped === parseFloat(last) ? null : String(bumped);  // already at the dumbbell ceiling — nothing to suggest
}

/* New set rows arrive pre-filled: a progression bump when earned, else your last logged weight, else the starting suggestion. */
function newSets(ex, count, history, phase) {
  const bumped = suggestedWeight(ex, history, phase);
  const last = lastWeightFor(ex.id, history);
  const kg = bumped != null ? bumped : (last != null ? String(last) : (SUGGEST_KG[ex.id] ? String(SUGGEST_KG[ex.id]) : ""));
  const reps = repsLow(ex.repsByPhase[phase]);
  return Array.from({ length: count }, () => ({ done: false, weight: kg, reps }));
}

function emptyLogs(type, phase, history = []) {
  const o = {};
  EXERCISES[type].forEach((ex) => {
    o[ex.id] = newSets(ex, ex.setsByPhase[phase], history, phase);
  });
  return o;
}

/* ------------------------------------------------------------------ */
/*  Small UI atoms                                                     */
/* ------------------------------------------------------------------ */
function Chip({ children, tone = "mute" }) {
  const tones = {
    mute: { bg: "#E4EBE6", fg: C.mute },
    amber: { bg: C.amberSoft, fg: C.accentDark },
    done: { bg: C.doneSoft, fg: C.done },
    caution: { bg: C.cautionSoft, fg: C.caution },
  };
  const t = tones[tone];
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

function SetRow({ i, set, onChange }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <button
        onClick={() => onChange({ ...set, done: !set.done })}
        aria-label={`Mark set ${i + 1} ${set.done ? "not done" : "done"}`}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 focus:outline-none focus:ring-2"
        style={{
          background: set.done ? C.done : "#fff",
          color: set.done ? "#fff" : C.mute,
          border: `2px solid ${set.done ? C.done : C.line}`,
        }}
      >
        {set.done ? "✓" : i + 1}
      </button>
      <input
        inputMode="decimal" placeholder="kg"
        value={set.weight}
        onChange={(e) => onChange({ ...set, weight: e.target.value })}
        className="w-16 px-2 py-1 rounded-lg text-sm border"
        style={{ borderColor: C.line, fontFamily: font.body }}
      />
      <input
        inputMode="numeric" placeholder="reps"
        value={set.reps}
        onChange={(e) => onChange({ ...set, reps: e.target.value })}
        className="w-16 px-2 py-1 rounded-lg text-sm border"
        style={{ borderColor: C.line }}
      />
      <span className="text-xs" style={{ color: C.mute }}>{set.done ? "logged" : ""}</span>
    </div>
  );
}

function ExerciseCard({ ex, phase, sets, onSetChange, pending, onMarkAll }) {
  const [open, setOpen] = useState(false);
  const doneCount = sets.filter((s) => s.done).length;
  const allDone = doneCount === sets.length;
  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{
        background: C.card,
        border: `1.5px solid ${allDone ? C.done : pending ? C.accent : C.line}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {pending && <Chip tone="amber">↻ rolled over</Chip>}
            {ex.finisher && <Chip>finisher</Chip>}
            {ex.caution && <Chip tone="caution">⚠ form flag</Chip>}
            {allDone && <Chip tone="done">done</Chip>}
          </div>
          <h3 className="font-semibold mt-1" style={{ fontFamily: font.display, color: C.ink }}>{ex.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: C.mute }}>
            {ex.setsByPhase[phase]} × {ex.repsByPhase[phase]} · rest {ex.rest} · {ex.target}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {!allDone && (
            <button
              onClick={onMarkAll}
              className="text-xs px-3 py-1.5 rounded-full font-medium focus:outline-none focus:ring-2"
              style={{ background: C.doneSoft, color: C.done }}
            >
              ✓ all
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="text-xs px-3 py-1.5 rounded-full font-medium focus:outline-none focus:ring-2"
            style={{ background: "#E4EBE6", color: C.ink }}
          >
            {open ? "Hide" : "How-to"}
          </button>
        </div>
      </div>

      <div className="mt-2">
        {sets.map((s, i) => (
          <SetRow key={i} i={i} set={s} onChange={(v) => onSetChange(i, v)} />
        ))}
      </div>

      {open && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <DIAGRAMSWrap dia={ex.dia} />
          <p className="text-sm mt-3" style={{ color: C.ink }}>
            <strong>Why it's in your plan:</strong> {ex.why}
          </p>
          <p className="text-sm mt-2" style={{ color: C.mute }}>
            <strong style={{ color: C.ink }}>Start:</strong> {ex.start}
          </p>
          <ol className="mt-2 pl-5 text-sm" style={{ color: C.ink, listStyle: "decimal" }}>
            {ex.cues.map((c, i) => <li key={i} className="mb-1">{c}</li>)}
          </ol>
          {ex.caution && (
            <div className="mt-2 rounded-xl p-3 text-sm" style={{ background: C.cautionSoft, color: C.caution }}>
              <strong>⚠ Caution for you:</strong> {ex.caution}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: C.mute }}>▶ Demo: {ex.demo}</p>
        </div>
      )}
    </div>
  );
}
function DIAGRAMSWrap({ dia }) { return DIAGRAMS[dia] || null; }

/* ------------------------------------------------------------------ */
/*  Top-level export: gate the tracker behind Supabase magic-link auth */
/* ------------------------------------------------------------------ */
export default function App() {
  return (
    <AuthGate>
      {({ session, signOut }) => (
        <Tracker key={session.user.id} userId={session.user.id} userEmail={session.user.email} onSignOut={signOut} />
      )}
    </AuthGate>
  );
}

/* ------------------------------------------------------------------ */
/*  Main app                                                           */
/* ------------------------------------------------------------------ */
function Tracker({ userId, userEmail, onSignOut }) {
  const schedule = useMemo(() => buildSchedule(), []);
  const [history, setHistory] = useState([]);        // finished sessions, loaded from Supabase `sessions`
  const [carry, setCarry] = useState([]);            // rolled-over exercises: {id, exId, type, fromDate, sets:[...]}
  const [tab, setTab] = useState("today");
  const [bodyLog, setBodyLog] = useState([]);
  const [photos, setPhotos] = useState({});        // photoPath -> signed URL
  const [viewPhoto, setViewPhoto] = useState(null); // signed URL shown fullscreen

  const idx = history.length;
  const current = nextSessionFor(schedule, history);
  const phase = phaseForCount(idx);
  const [logs, setLogs] = useState(() => emptyLogs(schedule[0].type, 0));
  const [carryLogs, setCarryLogs] = useState({});

  /* ---- Supabase-backed persistence ---- */
  const [loaded, setLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveNotice, setSaveNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      setErrorMsg("");
      try {
        // One-time seed migration: only for the real owner's account, and
        // only if that account has no sessions yet. seed-history.json is
        // Sandro's actual personal training log — it must never be copied
        // into anyone else's account. Every other sign-in starts empty.
        if ((userEmail || "").toLowerCase() === OWNER_EMAIL) {
          await db.seedHistoryIfEmpty(userId, seedHistoryData.history || []);
        }

        const [sessions, pendingCarry, bLog] = await Promise.all([
          db.fetchSessions(userId),
          db.fetchPendingCarry(userId),
          db.fetchBodyLog(userId),
        ]);
        if (cancelled) return;

        setHistory(sessions);
        const knownCarry = pendingCarry.filter((c) => KNOWN_IDS.has(c.exId));
        setCarry(knownCarry);
        setCarryLogs(Object.fromEntries(knownCarry.map((c) => [c.exId, c.sets])));
        setLogs(emptyLogs(nextSessionFor(schedule, sessions).type, phaseForCount(sessions.length), sessions));
        setBodyLog(bLog);

        const urls = {};
        await Promise.all(
          bLog.map(async (b) => {
            if (!b.photoPath) return;
            try {
              urls[b.photoPath] = await db.getBodyPhotoUrl(b.photoPath);
            } catch (e) {
              // Photo may have been removed from storage; skip it silently.
            }
          })
        );
        if (!cancelled) setPhotos(urls);
      } catch (err) {
        if (!cancelled) setErrorMsg("Couldn't load your data: " + (err && err.message ? err.message : "unknown error"));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const [resetArmed, setResetArmed] = useState(false);
  async function resetAll() {
    if (!resetArmed) { setResetArmed(true); setTimeout(() => setResetArmed(false), 4000); return; }
    try {
      await db.deleteAllUserData(userId);
      setHistory([]);
      setCarry([]);
      setCarryLogs({});
      setBodyLog([]);
      setPhotos({});
      setLogs(emptyLogs(nextSessionFor(schedule, []).type, phaseForCount(0), []));
    } catch (err) {
      setErrorMsg("Couldn't reset your data: " + (err && err.message ? err.message : "unknown error"));
    }
    setResetArmed(false);
  }

  const allEx = useMemo(() => [...EXERCISES.A, ...EXERCISES.B], []);
  const exById = useMemo(() => Object.fromEntries(allEx.map((e) => [e.id, e])), [allEx]);

  const setSet = (exId, i, v) =>
    setLogs((L) => ({ ...L, [exId]: L[exId].map((s, j) => (j === i ? v : s)) }));
  const setCarrySet = (exId, i, v) =>
    setCarryLogs((L) => ({ ...L, [exId]: L[exId].map((s, j) => (j === i ? v : s)) }));

  async function finishSession() {
    const tickedCount = [...Object.values(logs), ...Object.values(carryLogs)]
      .flat().filter((s) => s && s.done).length;
    if (tickedCount === 0 && !finishArmed) {
      setFinishArmed(true);
      setTimeout(() => setFinishArmed(false), 8000);
      return;
    }
    setFinishArmed(false);
    setErrorMsg("");
    const record = { date: new Date(), type: current.type, phase, logs: {}, carryLogs: {} }; // stamp the actual completion date
    let vol = 0;

    // Step 1 — tally rolled-over exercises
    const carryRemaining = [];
    carry.forEach((c) => {
      const sets = carryLogs[c.exId] || [];
      const done = sets.filter((s) => s.done);
      done.forEach((s) => { vol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0); });
      if (done.length) record.carryLogs[c.exId] = done;
      const remaining = sets.length - done.length;
      if (remaining > 0) carryRemaining.push({ c, remaining });
    });

    // Step 2 — tally today's exercises
    const todayRemaining = [];
    EXERCISES[current.type].forEach((ex) => {
      const sets = logs[ex.id] || [];
      const done = sets.filter((s) => s.done);
      done.forEach((s) => { vol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0); });
      record.logs[ex.id] = sets;
      const remaining = sets.length - done.length;
      if (remaining > 0 && !ex.finisher) todayRemaining.push({ ex, remaining });
    });

    // Step 3 — build next state; newHistory must exist BEFORE carry sets are pre-filled
    //    (the previous version used it before it was defined, which crashed this button)
    record.volume = Math.round(vol);
    const newHistory = [...history, record];
    const nextCarry = [
      ...carryRemaining.map(({ c, remaining }) => ({
        ...c,
        sets: newSets(exById[c.exId], remaining, newHistory, phase),
      })),
      ...todayRemaining.map(({ ex, remaining }) => ({
        exId: ex.id, type: current.type, fromDate: current.date,
        sets: newSets(ex, remaining, newHistory, phase),
      })),
    ];

    // Persist: insert the finished session, then replace pending_carry wholesale
    // (matches how the in-memory `carry` array already worked — anything still
    // unticked gets a fresh row, anything completed just isn't re-inserted).
    try {
      const savedSession = await db.insertSession(userId, record);
      const savedCarry = await db.replacePendingCarry(userId, nextCarry);
      const savedHistory = [...history, savedSession];

      setHistory(savedHistory);
      setCarry(savedCarry);
      setCarryLogs(Object.fromEntries(savedCarry.map((c) => [c.exId, c.sets])));
      const nxt = nextSessionFor(schedule, savedHistory);
      setLogs(emptyLogs(nxt.type, phaseForCount(savedHistory.length), savedHistory));

      setSaveNotice("Session saved to your account ✓");
      setTimeout(() => setSaveNotice(""), 4000);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMsg(
        "Couldn't save this session (" + (err && err.message ? err.message : "unknown error") +
        "). Your taps are still on screen — try Finish again once you're back online."
      );
    }
  }

  // seed carryLogs when carry changes shape (first render safety)
  useMemo(() => {
    setCarryLogs((prev) => {
      const o = {};
      carry.forEach((c) => { o[c.exId] = prev[c.exId] && prev[c.exId].length === c.sets.length ? prev[c.exId] : c.sets; });
      return o;
    });
  }, [carry]);

  /* ---- progress data ---- */
  const volumeSeries = history.map((h, i) => ({ n: i + 1, name: fmt(h.date), vol: h.volume }));
  const trackable = allEx.filter((e) => !e.finisher);
  const [trendEx, setTrendEx] = useState(trackable[0].id);
  const trendSeries = history
    .map((h, i) => {
      const sets = [...(h.logs[trendEx] || []), ...(h.carryLogs[trendEx] || [])].filter((s) => s.done && s.weight);
      if (!sets.length) return null;
      const top = Math.max(...sets.map((s) => parseFloat(s.weight) || 0));
      const reps = Math.max(...sets.map((s) => parseFloat(s.reps) || 0));
      return { n: i + 1, name: fmt(h.date), kg: top, reps };
    })
    .filter(Boolean);

  /* ---- body log form (with photo capture) ---- */
  const [note, setNote] = useState("");
  const [feel, setFeel] = useState("👍 good");
  const [meas, setMeas] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoRef, setPhotoRef] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");

  function handlePhotoPick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setPhotoMsg("");
    setPhotoBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale so uploads stay quick on mobile data; Supabase Storage
        // has no need for the old chunking workaround.
        const maxDim = 1600;
        const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * sc);
        cv.height = Math.round(img.height * sc);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        const previewUrl = cv.toDataURL("image/jpeg", 0.85);
        cv.toBlob(
          (blob) => {
            setPendingPhoto({ blob, previewUrl });
            setPhotoBusy(false);
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => { setPhotoMsg("Couldn't read that image — try a different photo."); setPhotoBusy(false); };
      img.src = reader.result;
    };
    reader.onerror = () => { setPhotoMsg("Couldn't read that file."); setPhotoBusy(false); };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function addBodyEntry() {
    if (!note.trim() && !meas.trim() && !pendingPhoto && !photoRef.trim()) return;
    if (photoBusy) {
      setPhotoMsg("The photo is still processing — give it a second, then tap Save again.");
      return;
    }
    setPhotoMsg("");
    try {
      let photoPath = null;
      if (pendingPhoto) {
        photoPath = await db.uploadBodyPhoto(userId, pendingPhoto.blob, "jpg");
      }
      const saved = await db.insertBodyLogEntry(userId, {
        date: new Date(),
        note,
        feel,
        meas,
        photoRef: photoRef.trim(),
        photoPath,
      });
      if (photoPath) {
        const url = await db.getBodyPhotoUrl(photoPath);
        setPhotos((p) => ({ ...p, [photoPath]: url }));
      }
      setBodyLog((prev) => [saved, ...prev]);
      setNote(""); setMeas(""); setPendingPhoto(null); setPhotoRef("");
    } catch (err) {
      setPhotoMsg("Check-in could not be saved (" + (err && err.message ? err.message : "unknown error") + "). Try Save again.");
    }
  }

  const [delArmed, setDelArmed] = useState(null);
  const [openHist, setOpenHist] = useState(null);
  const [histDelArmed, setHistDelArmed] = useState(null);
  const [finishArmed, setFinishArmed] = useState(false);

  async function deleteSession(i) {
    if (histDelArmed !== i) { setHistDelArmed(i); setTimeout(() => setHistDelArmed(null), 3500); return; }
    const removed = history[i];
    const newHistory = history.filter((_, j) => j !== i);
    const removedTime = new Date(removed.date).getTime();
    // also drop any pending items that the deleted session created
    const newCarry = carry.filter((c) => new Date(c.fromDate).getTime() !== removedTime);
    try {
      await db.deleteSession(userId, removed.id);
      await db.replacePendingCarry(userId, newCarry);
      setHistory(newHistory);
      setCarry(newCarry);
      setCarryLogs(Object.fromEntries(newCarry.map((c) => [c.exId, c.sets])));
      const ns = nextSessionFor(schedule, newHistory);
      setLogs(emptyLogs(ns.type, phaseForCount(newHistory.length), newHistory));
    } catch (err) {
      setErrorMsg("Couldn't delete that session (" + (err && err.message ? err.message : "unknown error") + ").");
    }
    setHistDelArmed(null); setOpenHist(null);
  }
  async function deleteBodyEntry(i) {
    if (delArmed !== i) { setDelArmed(i); setTimeout(() => setDelArmed(null), 3500); return; }
    const b = bodyLog[i];
    try {
      await db.deleteBodyLogEntry(userId, b.id, b.photoPath);
      if (b.photoPath) {
        setPhotos((p) => { const q = { ...p }; delete q[b.photoPath]; return q; });
      }
      setBodyLog((prev) => prev.filter((_, j) => j !== i));
    } catch (err) {
      setErrorMsg("Couldn't delete that check-in (" + (err && err.message ? err.message : "unknown error") + ").");
    }
    setDelArmed(null);
  }

  const thisWeekDone = history.filter((h) => {
    const now = new Date(); const d = new Date(h.date);
    const wk = (dt) => { const t = new Date(dt); t.setDate(t.getDate() - t.getDay()); return t.toDateString(); };
    return wk(now) === wk(d);
  }).length;

  const tabs = [
    ["today", "Today"], ["program", "Program"], ["progress", "Progress"], ["body", "Body log"],
  ];

  return (
    <div className="min-h-screen pb-24" style={{ background: C.paper, fontFamily: font.body, color: C.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        input:focus,button:focus{outline:2px solid ${C.accent};outline-offset:1px}
        @media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}`}</style>

      {/* Header */}
      <header className="px-4 pt-5 pb-4" style={{ background: C.ink, color: "#EDF2EE" }}>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs tracking-widest uppercase" style={{ color: C.accent, fontWeight: 600 }}>
                {PHASES[phase].name}
              </div>
              <h1 className="text-2xl font-bold mt-0.5" style={{ fontFamily: font.display }}>
                Upright<span style={{ color: C.accent }}>.</span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#9FB5AD" }}>
                Your 2-day posture &amp; strength plan · Wed + Sat
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ fontFamily: font.display, color: C.accent }}>{history.length}</div>
              <div className="text-xs" style={{ color: "#9FB5AD" }}>sessions<br />logged</div>
              <button onClick={onSignOut} className="text-xs mt-1 underline" style={{ color: "#9FB5AD" }}>
                Sign out
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: tab === k ? C.accent : "rgba(255,255,255,0.08)",
                  color: tab === k ? C.ink : "#C9D8D1",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4">
        {!loaded && (
          <div className="rounded-2xl p-6 mb-4 text-center text-sm" style={{ background: C.card, color: C.mute }}>
            Loading your training data…
          </div>
        )}
        {errorMsg && (
          <div className="rounded-2xl p-3 mb-4 text-sm" style={{ background: C.cautionSoft, color: C.caution }}>
            ⚠ {errorMsg}
          </div>
        )}

        {/* ------------------------ TODAY ------------------------ */}
        {loaded && tab === "today" && current && (
          <div>
            {saveNotice && (
              <div className="rounded-2xl p-3 mb-4 text-sm font-semibold" style={{ background: C.doneSoft, color: C.done }}>
                ✓ {saveNotice}
              </div>
            )}
            <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: C.mute }}>
                    Next session · planned {fmt(current.date)} · finishing logs today's date
                  </div>
                  <h2 className="text-xl font-bold" style={{ fontFamily: font.display }}>
                    Session {current.type} — {SESSION_META[current.type].title}
                  </h2>
                  <p className="text-sm" style={{ color: C.mute }}>{SESSION_META[current.type].blurb}</p>
                </div>
                <Chip tone="done">{thisWeekDone}/2 this week</Chip>
              </div>
              <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "#F3F7F4" }}>
                <strong>Warm-up (5 min):</strong> {WARMUP[current.type].join(" · ")}
              </div>
              <p className="text-xs mt-2" style={{ color: C.mute }}>
                Sets below are pre-filled with suggested kg × reps: carried from your last session, or nudged up a
                small increment when you've hit clean reps at the same weight for a couple of sessions running
                (standard double progression). Gym increments vary — round to the nearest plate/pin available,
                and adjust so the last 1–2 reps feel hard but clean (~RPE 7).
              </p>
            </div>

            {carry.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold" style={{ color: C.accentDark, fontFamily: font.display }}>
                    ↻ Pending from last session
                  </span>
                  <span className="text-xs" style={{ color: C.mute }}>clear these first, then move on</span>
                </div>
                {carry.map((c) => (
                  <ExerciseCard
                    key={"c-" + c.exId}
                    ex={exById[c.exId]}
                    phase={phase}
                    pending
                    sets={carryLogs[c.exId] || c.sets}
                    onSetChange={(i, v) => setCarrySet(c.exId, i, v)}
                    onMarkAll={() => setCarryLogs((L) => ({ ...L, [c.exId]: (L[c.exId] || c.sets).map((s) => ({ ...s, done: true })) }))}
                  />
                ))}
              </div>
            )}

            {EXERCISES[current.type].map((ex) => (
              <ExerciseCard
                key={ex.id} ex={ex} phase={phase}
                sets={logs[ex.id] || []}
                onSetChange={(i, v) => setSet(ex.id, i, v)}
                onMarkAll={() => setLogs((L) => ({ ...L, [ex.id]: (L[ex.id] || []).map((s) => ({ ...s, done: true })) }))}
              />
            ))}

            {finishArmed && (
              <div className="rounded-xl p-3 mb-2 text-sm" style={{ background: C.cautionSoft, color: C.caution }}>
                <strong>No sets are ticked ✓ yet</strong> — weights and reps only count for sets whose numbered
                circle is ticked. Tap the circles for the sets you did (or use “✓ all” on each exercise),
                then Finish. Tapping Finish again now records everything as skipped.
              </div>
            )}
            <button
              onClick={finishSession}
              className="w-full py-3.5 rounded-2xl font-bold text-base mt-2"
              style={{ background: finishArmed ? C.caution : C.accent, color: finishArmed ? "#fff" : C.ink, fontFamily: font.display }}
            >
              {finishArmed ? "Tap again to finish with everything skipped" : `Finish session ${current.type} →`}
            </button>
            <p className="text-xs text-center mt-2 mb-6" style={{ color: C.mute }}>
              Unfinished exercises (except finishers) roll forward to your next session automatically.
            </p>
          </div>
        )}

        {/* ----------------------- PROGRAM ----------------------- */}
        {tab === "program" && <ProgramView phase={phase} />}

        {/* ----------------------- PROGRESS ----------------------- */}
        {tab === "progress" && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                [history.length, "sessions done"],
                [history.reduce((a, h) => a + h.volume, 0).toLocaleString() + " kg", "total volume"],
                [`${thisWeekDone}/2`, "this week"],
              ].map(([v, l], i) => (
                <div key={i} className="rounded-2xl p-3 text-center" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
                  <div className="text-lg font-bold" style={{ fontFamily: font.display }}>{v}</div>
                  <div className="text-xs" style={{ color: C.mute }}>{l}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
              <h3 className="font-bold mb-2" style={{ fontFamily: font.display }}>Training volume per session</h3>
              {volumeSeries.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeSeries}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="n" tick={{ fontSize: 11, fill: C.mute }} />
                    <YAxis tick={{ fontSize: 11, fill: C.mute }} width={40} />
                    <Tooltip formatter={(v) => [`${v} kg`, "volume"]} labelFormatter={(n) => `Session ${n}`} />
                    <Bar dataKey="vol" fill={C.done} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="Finish your first session and your volume shows up here." />
              )}
            </div>

            <div className="rounded-2xl p-4 mb-6" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold" style={{ fontFamily: font.display }}>Weight trend</h3>
                <select value={trendEx} onChange={(e) => setTrendEx(e.target.value)}
                  className="text-sm rounded-lg px-2 py-1 border" style={{ borderColor: C.line }}>
                  {trackable.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              {trendSeries.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trendSeries}>
                    <CartesianGrid stroke={C.line} vertical={false} />
                    <XAxis dataKey="n" tick={{ fontSize: 11, fill: C.mute }} />
                    <YAxis tick={{ fontSize: 11, fill: C.mute }} width={40} />
                    <Tooltip formatter={(v, k) => [k === "kg" ? `${v} kg` : v, k === "kg" ? "top set" : "best reps"]}
                      labelFormatter={(n) => `Session ${n}`} />
                    <Line type="monotone" dataKey="kg" stroke={C.accent} strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty text="Log weight on a set of this exercise to start the trend line." />
              )}
            </div>

            <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
              <h3 className="font-bold mb-2" style={{ fontFamily: font.display }}>Session history</h3>
              {history.length === 0 && <Empty text="Finished sessions will be listed here with full set details." />}
              {history.map((h, i) => ({ h, i })).reverse().map(({ h, i }) => (
                <div key={i} className="rounded-xl mb-2 overflow-hidden" style={{ border: `1.5px solid ${C.line}` }}>
                  <div className="w-full flex items-center gap-1 px-2 py-1.5 text-sm" style={{ background: "#F3F7F4" }}>
                    <button
                      onClick={() => setOpenHist(openHist === i ? null : i)}
                      className="flex-1 flex items-center justify-between px-1 py-0.5 text-left"
                      style={{ color: C.ink }}
                    >
                      <span className="font-semibold" style={{ fontFamily: font.display }}>
                        #{i + 1} · Session {h.type} · {fmt(h.date)}
                      </span>
                      <span className="text-xs" style={{ color: C.mute }}>
                        {(h.volume || 0).toLocaleString()} kg {openHist === i ? "▲" : "▼"}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteSession(i)}
                      className="text-xs px-2 py-1 rounded-lg shrink-0"
                      aria-label={"Delete session " + (i + 1)}
                      style={{
                        background: histDelArmed === i ? C.caution : "transparent",
                        color: histDelArmed === i ? "#fff" : C.mute,
                        border: `1px solid ${histDelArmed === i ? C.caution : C.line}`,
                      }}
                    >
                      {histDelArmed === i ? "sure?" : "×"}
                    </button>
                  </div>
                  {openHist === i && (
                    <div className="px-3 py-2">
                      {Object.entries(h.logs || {}).map(([exId, sets]) => (
                        <SessionExerciseRow key={exId} exId={exId} sets={sets} exById={exById} />
                      ))}
                      {Object.entries(h.carryLogs || {}).map(([exId, sets]) => (
                        <SessionExerciseRow key={"c" + exId} exId={exId} sets={sets} exById={exById} rolled />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={resetAll}
              className="w-full py-2.5 rounded-xl text-sm font-semibold mb-6"
              style={{
                background: resetArmed ? C.caution : "transparent",
                color: resetArmed ? "#fff" : C.caution,
                border: `1.5px solid ${C.caution}`,
              }}
            >
              {resetArmed ? "Tap again to permanently delete all data" : "Reset all saved data"}
            </button>
          </div>
        )}

        {/* ------------------------ BODY LOG ------------------------ */}
        {tab === "body" && (
          <div>
            <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
              <h3 className="font-bold" style={{ fontFamily: font.display }}>New check-in</h3>
              <p className="text-xs mb-3" style={{ color: C.mute }}>
                One per session is plenty. Recommended: keep the photo in your iPhone Photos and just note its
                name/date below — that needs no storage at all. (The app cannot pull photos from your library by
                itself; browsers don't allow it — attaching means picking the photo manually.) The 📷 attach
                button stays optional and has been unreliable on your device.
              </p>
              <div className="flex gap-2 mb-2">
                {["👍 good", "😐 okay", "😮‍💨 tough"].map((f) => (
                  <button key={f} onClick={() => setFeel(f)}
                    className="px-3 py-1.5 rounded-full text-sm"
                    style={{
                      background: feel === f ? C.doneSoft : "#F3F7F4",
                      border: `1.5px solid ${feel === f ? C.done : C.line}`,
                    }}>{f}</button>
                ))}
              </div>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="How did the session feel? Posture better in the mirror? Energy?"
                className="w-full rounded-xl border p-3 text-sm mb-2" rows={3} style={{ borderColor: C.line }}
              />
              <input
                value={meas} onChange={(e) => setMeas(e.target.value)}
                placeholder="Optional measurements — e.g. 96.2 kg · waist 104 cm"
                className="w-full rounded-xl border p-3 text-sm mb-3" style={{ borderColor: C.line }}
              />
              <input
                value={photoRef} onChange={(e) => setPhotoRef(e.target.value)}
                placeholder={"Photo reference in your iPhone Photos \u2014 e.g. 'IMG_9260, 4 Jul'"}
                className="w-full rounded-xl border p-3 text-sm mb-3" style={{ borderColor: C.line }}
              />
              <div className="flex items-center gap-3 mb-3">
                <label className="px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: "#F3F7F4", border: `1.5px solid ${C.line}`, color: C.ink }}>
                  📷 {photoBusy ? "Processing…" : pendingPhoto ? "Replace photo" : "Attach copy (optional)"}
                  <input type="file" accept="image/*" onChange={handlePhotoPick} style={{ display: "none" }} />
                </label>
                {pendingPhoto && (
                  <>
                    <img src={pendingPhoto.previewUrl} alt="Preview of your progress photo" className="w-12 h-12 rounded-xl object-cover" />
                    <button onClick={() => setPendingPhoto(null)} className="text-xs font-medium" style={{ color: C.caution }}>
                      remove
                    </button>
                  </>
                )}
              </div>
              {photoMsg && <p className="text-xs mb-2" style={{ color: C.caution }}>{photoMsg}</p>}
              <button onClick={addBodyEntry}
                className="w-full py-2.5 rounded-xl font-bold"
                style={{ background: C.ink, color: "#EDF2EE", fontFamily: font.display }}>
                Save check-in
              </button>
            </div>

            {bodyLog.length === 0 && <Empty text="No check-ins yet. After Saturday's session, snap a photo and jot down how you felt." />}
            {bodyLog.map((b, i) => (
              <div key={i} className="rounded-2xl p-4 mb-3 flex gap-3 items-start" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
                {b.photoPath && photos[b.photoPath] ? (
                  <button onClick={() => setViewPhoto(photos[b.photoPath])} className="shrink-0" aria-label="View progress photo">
                    <img src={photos[b.photoPath]} alt="Progress check-in" className="w-14 h-14 rounded-xl object-cover" />
                  </button>
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: "#F3F7F4", border: `1.5px dashed ${C.line}` }} title="No photo">📷</div>
                )}
                <div className="flex-1">
                  <div className="text-xs" style={{ color: C.mute }}>{fmt(b.date)} · {b.feel}</div>
                  {b.note && <p className="text-sm mt-1">{b.note}</p>}
                  {b.meas && <p className="text-xs mt-1 font-medium" style={{ color: C.done }}>{b.meas}</p>}
                  {b.photoRef && <p className="text-xs mt-1" style={{ color: C.mute }}>📱 {b.photoRef} — in your iPhone Photos</p>}
                </div>
                <button onClick={() => deleteBodyEntry(i)}
                  className="text-xs px-2 py-1 rounded-lg shrink-0"
                  style={{
                    background: delArmed === i ? C.caution : "transparent",
                    color: delArmed === i ? "#fff" : C.mute,
                    border: `1px solid ${delArmed === i ? C.caution : C.line}`,
                  }}>
                  {delArmed === i ? "sure?" : "×"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {viewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(18,28,26,0.93)" }}
          onClick={() => setViewPhoto(null)} role="dialog" aria-label="Progress photo viewer">
          <img src={viewPhoto} alt="Progress check-in, full size" className="max-h-full max-w-full rounded-2xl" />
          <button className="absolute top-4 right-4 text-3xl font-bold" style={{ color: "#EDF2EE" }}
            onClick={() => setViewPhoto(null)} aria-label="Close photo">×</button>
        </div>
      )}
    </div>
  );
}

function SessionExerciseRow({ exId, sets, exById, rolled }) {
  const list = sets || [];
  if (!list.length) return null;
  const name = exById[exId] ? exById[exId].name : exId;
  return (
    <div className="py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
      <span className="font-medium" style={{ color: C.ink }}>{name}</span>
      {rolled && <span className="text-xs ml-1" style={{ color: C.accentDark }}>↻ rolled over</span>}
      <div className="text-xs mt-0.5" style={{ color: C.mute }}>
        {list.map((s, j) => (
          <span key={j} className="inline-block mr-2" style={{ color: s.done ? C.done : C.mute }}>
            {s.done
              ? `${s.weight || 0} kg × ${s.reps || "?"} ✓`
              : (s.weight || s.reps)
                ? `${s.weight || "?"} kg × ${s.reps || "?"} (entered, not ticked)`
                : "— skipped"}
          </span>
        ))}
      </div>
    </div>
  );
}


function Empty({ text }) {
  return (
    <div className="rounded-xl p-6 text-center text-sm" style={{ background: "#F3F7F4", color: "#7A8B86" }}>
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Program browser                                                    */
/* ------------------------------------------------------------------ */
function ProgramView({ phase }) {
  const [ph, setPh] = useState(phase);
  const [sess, setSess] = useState("A");
  return (
    <div className="mb-6">
      <div className="flex gap-2 mb-3">
        {PHASES.map((p, i) => (
          <button key={i} onClick={() => setPh(i)}
            className="flex-1 px-2 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: ph === i ? C.ink : C.card,
              color: ph === i ? "#EDF2EE" : C.mute,
              border: `1.5px solid ${ph === i ? C.ink : C.line}`,
            }}>
            Phase {i + 1}
            {i === phase && <span style={{ color: C.accent }}> ·now</span>}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
        <h3 className="font-bold" style={{ fontFamily: font.display }}>{PHASES[ph].name}</h3>
        <div className="text-xs mb-2" style={{ color: C.mute }}>{PHASES[ph].span}</div>
        <p className="text-sm mb-2">{PHASES[ph].focus}</p>
        <ul className="text-sm pl-4" style={{ listStyle: "disc" }}>
          {PHASES[ph].rules.map((r, i) => <li key={i} className="mb-1">{r}</li>)}
        </ul>
        <p className="text-xs mt-2" style={{ color: C.mute }}>
          RPE = how hard a set feels out of 10. RPE 7 ≈ you had ~3 clean reps left.
        </p>
      </div>

      <div className="flex gap-2 mb-3">
        {["A", "B"].map((s) => (
          <button key={s} onClick={() => setSess(s)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: sess === s ? C.accent : C.card,
              color: C.ink,
              border: `1.5px solid ${sess === s ? C.accent : C.line}`,
            }}>
            {SESSION_META[s].day} · {SESSION_META[s].title}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-3 mb-3 text-sm" style={{ background: "#F3F7F4" }}>
        <strong>Warm-up (5 min):</strong> {WARMUP[sess].join(" · ")}
      </div>

      {EXERCISES[sess].map((ex) => (
        <ProgramCard key={ex.id} ex={ex} phase={ph} />
      ))}
    </div>
  );
}

function ProgramCard({ ex, phase }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl p-4 mb-3" style={{ background: C.card, border: `1.5px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap gap-2">
            {ex.finisher && <Chip>finisher</Chip>}
            {ex.caution && <Chip tone="caution">⚠ form flag</Chip>}
          </div>
          <h3 className="font-semibold mt-1" style={{ fontFamily: font.display }}>{ex.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: C.mute }}>
            {ex.setsByPhase[phase]} × {ex.repsByPhase[phase]} · rest {ex.rest} · {ex.target}
          </p>
        </div>
        <button onClick={() => setOpen(!open)}
          className="text-xs px-3 py-1.5 rounded-full font-medium shrink-0"
          style={{ background: "#E4EBE6", color: C.ink }}>
          {open ? "Hide" : "Details"}
        </button>
      </div>
      {open && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {DIAGRAMS[ex.dia]}
          <p className="text-sm mt-3"><strong>Why:</strong> {ex.why}</p>
          <p className="text-sm mt-2" style={{ color: C.mute }}><strong style={{ color: C.ink }}>Start:</strong> {ex.start}</p>
          <ol className="mt-2 pl-5 text-sm" style={{ listStyle: "decimal" }}>
            {ex.cues.map((c, i) => <li key={i} className="mb-1">{c}</li>)}
          </ol>
          {ex.caution && (
            <div className="mt-2 rounded-xl p-3 text-sm" style={{ background: C.cautionSoft, color: C.caution }}>
              <strong>⚠ Caution for you:</strong> {ex.caution}
            </div>
          )}
          <p className="text-xs mt-2" style={{ color: C.mute }}>▶ Demo: {ex.demo}</p>
        </div>
      )}
    </div>
  );
}
