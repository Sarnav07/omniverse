#!/usr/bin/env python3
"""OMNIVERSE pitch deck — emerald-on-black, OMNICURVE-style layout."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
LOGO = os.path.join(HERE, "logo_mark.png")
WCURVE = os.path.join(HERE, "wcurve.png")
GAUSS = os.path.join(HERE, "gauss.png")
FIG_WSHAPE = os.path.join(HERE, "fig_wshape.png")
FIG_VPHI = os.path.join(HERE, "fig_vphi.png")
FIG_MC = os.path.join(HERE, "fig_montecarlo.png")
FIG_AR1 = os.path.join(HERE, "fig_ar1.png")
FIG_VZ = os.path.join(HERE, "fig_vz.png")
DASH = os.path.join(ROOT, "Screenshot 2026-06-15 at 00.42.35.png")

# palette
EMERALD = RGBColor(0x10, 0xB9, 0x81); EMERALD_LT = RGBColor(0x34, 0xD3, 0x99)
CYAN = RGBColor(0x22, 0xD3, 0xEE); CRIMSON = RGBColor(0xEF, 0x44, 0x44)
BLACK = RGBColor(0x08, 0x08, 0x0A); PANEL = RGBColor(0x12, 0x14, 0x19)
PANEL2 = RGBColor(0x17, 0x19, 0x1F); CREAM = RGBColor(0xF3, 0xF4, 0xF6)
MUTED = RGBColor(0x8B, 0x8D, 0x98); GHOST = RGBColor(0x14, 0x3A, 0x30)
BORDER = RGBColor(0x26, 0x2B, 0x33); CRIMSON_DK = RGBColor(0x3A, 0x1A, 0x1C)
EMERALD_DK = RGBColor(0x10, 0x2A, 0x22)

DISPLAY = "Anton"; HEAD = "Archivo Black"; SCRIPT = "Caveat"; BODY = "Inter"

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def R(txt, font, size, color, bold=False, italic=False):
    return (txt, font, size, color, bold, italic)


def slide(bg=BLACK):
    s = prs.slides.add_slide(BLANK)
    r = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    r.shadow.inherit = False; r.fill.solid(); r.fill.fore_color.rgb = bg
    r.line.fill.background()
    return s


def box(s, x, y, w, h, anchor=MSO_ANCHOR.TOP):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); tf = tb.text_frame
    tf.word_wrap = True; tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, 0)
    return tf


def para(tf, runs, align=PP_ALIGN.LEFT, sp=None, before=None, after=None, first=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    if sp: p.line_spacing = sp
    if before is not None: p.space_before = Pt(before)
    if after is not None: p.space_after = Pt(after)
    for (txt, font, size, color, bold, italic) in runs:
        r = p.add_run(); r.text = txt; f = r.font
        f.name = font; f.size = Pt(size); f.bold = bold; f.italic = italic; f.color.rgb = color
    return p


def line1(s, x, y, w, h, txt, font, size, color, bold=False, italic=False,
          align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tf = box(s, x, y, w, h, anchor)
    para(tf, [R(txt, font, size, color, bold, italic)], align=align, first=True, sp=1.0)
    return tf


def rect(s, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, lw=1.0):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    sh.shadow.inherit = False
    if fill is None: sh.fill.background()
    else: sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None: sh.line.fill.background()
    else: sh.line.color.rgb = line; sh.line.width = Pt(lw)
    return sh


def card(s, x, y, w, h, fill=PANEL, line=BORDER):
    return rect(s, x, y, w, h, fill=fill, line=line, shape=MSO_SHAPE.ROUNDED_RECTANGLE)


def fig_card(s, cx, cy, cw, img, aspect, pad=0.16):
    """A real research figure (white bg) framed on a clean white panel."""
    iw = cw - 2 * pad
    ih = iw / aspect
    card(s, cx, cy, cw, ih + 2 * pad, fill=RGBColor(0xFF, 0xFF, 0xFF), line=RGBColor(0x3A, 0x3F, 0x47))
    if os.path.exists(img):
        s.shapes.add_picture(img, Inches(cx + pad), Inches(cy + pad), width=Inches(iw), height=Inches(ih))
    return ih + 2 * pad


def num_item(s, x, y, w, num, title, body, num_color=EMERALD, tsize=16.5, bsize=12.5):
    tf = box(s, x, y - 0.12, 0.95, 0.9)
    para(tf, [R(num, SCRIPT, 42, num_color, True)], first=True)
    tf2 = box(s, x + 0.92, y, w - 0.92, 1.6)
    para(tf2, [R(title, BODY, tsize, CREAM, True)], first=True, sp=1.0)
    para(tf2, [R(body, BODY, bsize, MUTED)], sp=1.08, before=3)


def logo(s, x, y, size):
    if os.path.exists(LOGO):
        s.shapes.add_picture(LOGO, Inches(x), Inches(y), Inches(size), Inches(size))


def heading(s, heavy, script, x=0.72, y=0.55, hsize=37, ssize=44, two_line=False):
    """Heavy caps + script accent, reference style."""
    line1(s, x, y, 11.5, 1.0, heavy, HEAD, hsize, CREAM)
    # script accent placed to the right of heavy text on same baseline-ish
    line1(s, x + len(heavy) * hsize * 0.0095 + 0.35, y - 0.07, 7.0, 1.0, script, SCRIPT, ssize, EMERALD)


# ---------------------------------------------------------------- S1 Title
s = slide()
logo(s, 0.6, 0.55, 1.15)
line1(s, 1.0, 2.05, 10, 0.8, "Built on Arbitrum Stylus", SCRIPT, 34, EMERALD)
line1(s, 0.92, 2.5, 12, 2.1, "OMNIVERSE", DISPLAY, 150, EMERALD)
line1(s, 1.0, 5.25, 11.5, 0.6, "Zero-Liquidation Prediction Markets with On-Chain Gaussian Defense",
      BODY, 20, CREAM, italic=True)
line1(s, 1.0, 5.95, 11.5, 0.5, "Rust + WASM math kernel  ·  live on Arbitrum Sepolia",
      BODY, 15, MUTED)
line1(s, 1.0, 6.42, 11.5, 0.5, "omniverse-99so.vercel.app", BODY, 16, EMERALD_LT, bold=True)

# ---------------------------------------------------------------- S2 Problem
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "THE PROBLEM WITH", HEAD, 37, CREAM)
line1(s, 0.72, 1.2, 11.5, 0.9, "prediction-market LPs", SCRIPT, 50, EMERALD)
# left illustrative card
card(s, 0.72, 2.35, 5.25, 4.35)
line1(s, 1.05, 2.7, 4.7, 0.5, "Standard pm-AMM, at resolution", BODY, 14, MUTED)
line1(s, 1.05, 3.2, 4.7, 0.9, "P(YES)  96%", DISPLAY, 40, CREAM)
rect(s, 1.05, 4.35, 4.6, 0.34, fill=CRIMSON)  # full red exposure bar
line1(s, 1.05, 4.8, 4.7, 0.5, "LP capital exposed:  100%", BODY, 15, CRIMSON, bold=True)
line1(s, 1.05, 5.35, 4.7, 0.5, "LP inventory:  all NO  →  ~$0", BODY, 13.5, MUTED)
line1(s, 1.05, 5.95, 4.7, 0.6, "Outcome:  wiped out in one block", BODY, 15, CRIMSON, bold=True)
line1(s, 0.72, 6.95, 7.2, 0.4, "Polymarket: a 2¢ shown spread costs ~6¢ to execute.  — SwapHunt, 2026",
      BODY, 10.5, MUTED, italic=True)
# right list
rx = 6.55
num_item(s, rx, 2.55, 6.2, "01", "LP wipeout", "When the event resolves, arbitrageurs grab the winning side in a single block. LPs are left holding the worthless token.")
num_item(s, rx, 3.95, 6.2, "02", "Full exposure", "Every dollar of LP capital is tradeable at all times — even at 99% certainty, when the trade is a sure loss for the pool.")
num_item(s, rx, 5.35, 6.2, "03", "Liquidation risk", "Borrowing against prediction positions means margin calls and cascading liquidations the moment price moves.")

# ---------------------------------------------------------------- S3 Insight
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "OUR INSIGHT:", HEAD, 37, CREAM)
line1(s, 5.0, 0.43, 8.4, 0.9, "liquidity is a risk surface", SCRIPT, 48, EMERALD)
num_item(s, 0.72, 2.05, 6.0, "01", "Risk isn't uniform",
         "Adverse selection explodes as price nears 0 or 1. The danger to LPs is a curve, not a constant.")
num_item(s, 0.72, 3.5, 6.0, "02", "So shield it dynamically",
         "The Gaussian λ* curve pulls LP capital aside exactly when it is most exposed, and releases it near 50/50.")
num_item(s, 0.72, 4.95, 6.0, "03", "Match outcomes, not prices",
         "Same-outcome collateral and debt cancel on resolution, so lending needs no liquidation engine at all.")
fig_card(s, 7.1, 2.45, 5.6, FIG_WSHAPE, 1.851)
line1(s, 7.1, 6.05, 5.6, 0.5, "From our whitepaper: λ*(P) is W-shaped — peaks at P≈0.16/0.84, →0 at the tails",
      BODY, 11, MUTED, italic=True, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- S4 Research to MVP
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "RESEARCH TO", HEAD, 38, CREAM)
line1(s, 5.0, 0.46, 6.0, 0.9, "MVP", SCRIPT, 50, EMERALD)
num_item(s, 0.9, 2.2, 11.6, "01", "pm-AMM — the Gaussian invariant (Paradigm)",
         "P = Φ((y−x)/L). The closed-form prediction-market curve we build on.   paradigm.xyz/2024/11/pm-amm", tsize=18, bsize=13.5)
num_item(s, 0.9, 3.75, 11.6, "02", "PA-AMM + Gaussian λ*  —  our extension",
         "We split reserves into active and passive each block, sized by λ*(γ', P), so LP exposure shrinks at the extremes. Original work for this build.", tsize=18, bsize=13.5)
num_item(s, 0.9, 5.3, 11.6, "03", "Arbitrum Stylus  —  the whole kernel in Rust/WASM",
         "φ, Φ, Φ⁻¹, λ*, and a Newton-Raphson swap solver, deployed and live on Sepolia at 18-decimal fixed point.", tsize=18, bsize=13.5)

# ---------------------------------------------------------------- S5 The Math
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "THE MATH", HEAD, 38, CREAM)
line1(s, 4.05, 0.5, 7.0, 0.9, "made simple", SCRIPT, 48, EMERALD)
card(s, 0.72, 2.1, 6.0, 1.25)
line1(s, 1.05, 2.32, 5.5, 0.5, "Marginal price = probability", BODY, 13, MUTED)
line1(s, 1.05, 2.72, 5.5, 0.6, "P  =  Φ( (y − x) / L )", BODY, 24, EMERALD_LT, bold=True)
card(s, 0.72, 3.6, 6.0, 1.25)
line1(s, 1.05, 3.82, 5.5, 0.5, "Defense grows near certainty", BODY, 13, MUTED)
line1(s, 1.05, 4.22, 5.5, 0.6, "λ*(P)  →  0   as   P → 0 or 1", BODY, 24, EMERALD_LT, bold=True)
line1(s, 0.72, 5.15, 6.1, 1.6,
      "Price is just the Gaussian CDF of the reserve imbalance. The further the market leans, "
      "the less LP money we leave in the line of fire. No oracle, no off-chain math.",
      BODY, 14.5, CREAM, italic=True)
fig_card(s, 7.1, 2.5, 5.6, FIG_VZ, 1.663)
line1(s, 7.1, 6.1, 5.6, 0.5, "Pool value v(z) vs price-sensitivity φ(z) — the curvature that sets λ*",
      BODY, 11, MUTED, italic=True, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- S5a1 Why a W, not a dome
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "WHY A W,", HEAD, 38, CREAM)
line1(s, 4.0, 0.5, 7.0, 0.9, "not a dome", SCRIPT, 48, EMERALD)
line1(s, 0.74, 1.45, 12.0, 0.5, "The obvious guess — most active at 50/50 — is provably wrong.", BODY, 15, MUTED)
num_item(s, 0.72, 2.3, 6.1, "01", "Activeness follows capacity",
         "LPs should be most active where the pool's risk-adjusted capacity v(z)·φ(z) is highest.")
num_item(s, 0.72, 3.65, 6.1, "02", "That capacity peaks off-center",
         "v(z)·φ(z) maxes at z ≈ ±1 — P ≈ 0.16 and 0.84 — not at 0.5. (Lemma 1: z=0 is a local minimum.)")
num_item(s, 0.72, 5.0, 6.1, "03", "So λ* is a W",
         "It dips at 50/50, peaks off-center, collapses at the tails. A naive dome costs 2–3× more at the edges.")
fig_card(s, 7.05, 2.35, 5.6, FIG_VPHI, 1.741)
line1(s, 7.05, 6.05, 5.6, 0.5, "v(z)·φ(z): twin peaks at z ≈ ±1 are the origin of the W-shape",
      BODY, 11, MUTED, italic=True, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- S5a2 Three-layer defence
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "THREE-LAYER", HEAD, 38, CREAM)
line1(s, 4.6, 0.5, 7.0, 0.9, "defence", SCRIPT, 50, EMERALD)
line1(s, 0.74, 1.45, 12.0, 0.5,
      "Each layer bounds a different timescale of LP loss. Together: the most complete protection in the AMM literature.",
      BODY, 14, MUTED)


def layer(cx, n, title, body, formula):
    card(s, cx, 2.25, 3.85, 3.55)
    line1(s, cx + 0.32, 2.5, 1.0, 0.7, n, SCRIPT, 40, EMERALD)
    line1(s, cx + 0.32, 3.2, 3.3, 0.6, title, BODY, 15, CREAM, bold=True)
    tf = box(s, cx + 0.32, 3.9, 3.25, 1.3)
    para(tf, [R(body, BODY, 12, MUTED)], first=True, sp=1.12)
    line1(s, cx + 0.32, 5.32, 3.35, 0.5, formula, BODY, 12.5, EMERALD_LT, bold=True)


layer(0.72, "1", "Time-decaying liquidity",
      "Pool depth shrinks as the event matures — bounds lifetime LVR, independent of volatility.", "Lₜ = L₀ · √(T − t)")
layer(4.74, "2", "Partially-active reserves",
      "Only a λ-fraction trades each block; caps per-block adverse selection uniformly.", "Rₐ = λ · R_total")
layer(8.76, "3", "Gaussian λ*(P)  · ours",
      "Tightens the active fraction near resolution — automatically, no oracle, every block.", "λ*(P) → 0 at the tails")
line1(s, 0.72, 6.2, 12.0, 0.6, "Combined:   ℓ_active(t, P)  =  λ*(P) · L₀ · √(T − t)",
      BODY, 16, CREAM, bold=True, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- S5a3 Proven
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "PROVEN,", HEAD, 38, CREAM)
line1(s, 3.5, 0.5, 8.0, 0.9, "not hand-waved", SCRIPT, 48, EMERALD)
fig_card(s, 0.72, 2.0, 5.4, FIG_MC, 1.390)
line1(s, 0.72, 6.2, 5.4, 0.5, "Monte Carlo: λ* is the lowest-cost policy at every probability (200 paths)",
      BODY, 10.5, MUTED, italic=True, align=PP_ALIGN.CENTER)
num_item(s, 6.55, 2.15, 6.1, "01", "Exactly AR(1)",
         "Gap dynamics are exact at all orders — simulated / theoretical variance ratio 1.001 ± 0.028.")
num_item(s, 6.55, 3.55, 6.1, "02", "Lowest cost, every regime",
         "λ*(P) beats every constant policy and the dome across all 200 independent Monte-Carlo paths.")
num_item(s, 6.55, 4.95, 6.1, "03", "Up to 73% less exposure",
         "Near resolution (P = 0.999) λ* cuts the active LP fraction from 0.50 to 0.13 — the dome costs 2–3× more.")

# ---------------------------------------------------------------- S5b The evidence (cited)
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "THE EVIDENCE", HEAD, 37, CREAM)
line1(s, 5.0, 0.5, 7.5, 0.9, "the data backs it", SCRIPT, 46, EMERALD)
line1(s, 0.74, 1.42, 12.0, 0.5,
      "Standard AMMs and oracle-based lending are measurably broken. Omniverse fixes each.",
      BODY, 14.5, MUTED)


def stat_card(cx, cy, big, bigc, claim, source, fix):
    card(s, cx, cy, 5.65, 2.12)
    line1(s, cx + 0.38, cy + 0.16, 4.5, 0.7, big, DISPLAY, 34, bigc)
    tf = box(s, cx + 0.38, cy + 0.74, 5.05, 0.6)
    para(tf, [R(claim, BODY, 12.5, CREAM)], first=True, sp=1.05)
    line1(s, cx + 0.38, cy + 1.4, 5.05, 0.35, source, BODY, 10, MUTED, italic=True)
    line1(s, cx + 0.38, cy + 1.69, 5.05, 0.4, fix, BODY, 11.5, EMERALD_LT, bold=True)


stat_card(0.72, 2.2, "50%+", CRIMSON,
          "of AMM LPs lose money — arbitrage (LVR) beats fee revenue.",
          "Fritsch & Canidio · ACM WWW 2024",
          "→ Gaussian λ* bounds lifetime LVR")
stat_card(6.95, 2.2, "$150M+", CRIMSON,
          "of borrower value leaked to MEV bots through liquidations.",
          "Pyth Network",
          "→ outcome-matched lending: no liquidations")
stat_card(0.72, 4.5, "$27M", CRIMSON,
          "of healthy positions liquidated on a single oracle glitch.",
          "Aave · CoinDesk, Mar 2026",
          "→ no oracle, so no false liquidation")
stat_card(6.95, 4.5, "$21.5B", EMERALD_LT,
          "prediction-market volume — roughly 130× in one year.",
          "Dune, 2025",
          "→ the market we make LP-safe")

# ---------------------------------------------------------------- S6 What we built
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "WHAT WE", HEAD, 38, CREAM)
line1(s, 3.55, 0.5, 7.0, 0.9, "built", SCRIPT, 50, EMERALD)
built = [
    ("01", "On-chain Gaussian pricing engine", "φ, Φ, Φ⁻¹ and a Newton-Raphson swap solver in Rust, compiled to WASM, running via Arbitrum Stylus."),
    ("02", "PA-AMM pool with dynamic λ* shielding", "Reserves split into active and passive every block; passive capital is hidden from informed flow."),
    ("03", "ERC-1155 conditional tokens", "Gnosis-style YES/NO outcome tokens with split, merge, and redeem against collateral escrow."),
    ("04", "Zero-liquidation lending", "Borrow same-outcome debt against same-outcome collateral; the position nets to zero on resolution."),
    ("05", "Indexer + live dashboard", "A Ponder GraphQL indexer and a React app, deployed end-to-end and reading state straight from chain."),
]
y = 2.05
for n, t, b in built:
    num_item(s, 0.9, y, 11.7, n, t, b, tsize=15.5, bsize=12)
    y += 0.96

# ---------------------------------------------------------------- S6b On-chain gas
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "ON-CHAIN IN", HEAD, 37, CREAM)
line1(s, 4.75, 0.5, 7.0, 0.9, "~5,000 gas", SCRIPT, 48, EMERALD)
line1(s, 0.74, 1.45, 12.0, 0.5,
      "The whole λ*(P) pipeline runs in a Rust/WASM kernel via Arbitrum Stylus.", BODY, 15, MUTED)
card(s, 0.72, 2.25, 5.7, 3.95)
line1(s, 1.05, 2.55, 5.0, 0.5, "Gas per block  (once, not per swap)", BODY, 13.5, MUTED)


def gline(y, a, b, c):
    line1(s, 1.05, y, 3.7, 0.5, a, BODY, 14, CREAM)
    line1(s, 4.75, y, 1.55, 0.5, b, BODY, 16, c, bold=True, align=PP_ALIGN.RIGHT)


gline(3.18, "Φ⁻¹(P) · 50-iter bisection", "~4,000", CREAM)
gline(3.75, "v(z), γ_G, λ*", "~1,000", CREAM)
rect(s, 1.05, 4.4, 5.25, 0.015, fill=BORDER)
gline(4.55, "Total per block", "~5,000", EMERALD_LT)
line1(s, 1.05, 5.35, 5.3, 0.8,
      "≈ 3–5% overhead on a swap (100–200K gas). At 0.25s blocks, ~20K gas/sec — well within L2 limits.",
      BODY, 12.5, MUTED, italic=True)
line1(s, 6.85, 2.3, 6.0, 0.5, "Three ways to ship it", BODY, 14, EMERALD, bold=True)
num_item(s, 6.85, 3.0, 5.9, "A", "Full dynamic λ*  · recommended",
         "Per-block λ*(P) straight from the kernel. Provably optimal, automatic tail protection.")
num_item(s, 6.85, 4.25, 5.9, "B", "Piecewise",
         "Dynamic λ* only at the tails (P<0.05 or >0.95), constant ≈0.45 in between. Gas-free for 90% of states.")
num_item(s, 6.85, 5.5, 5.9, "C", "Constant + tail-freeze",
         "Simplest to audit: a constant λ that halts trading in the extreme tail.")

# ---------------------------------------------------------------- S7 Live demo
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "LIVE ON SEPOLIA", HEAD, 36, CREAM)
line1(s, 5.7, 0.5, 7.0, 0.9, "the attack", SCRIPT, 48, EMERALD)
if os.path.exists(DASH):
    card(s, 0.72, 2.0, 6.7, 4.7)
    s.shapes.add_picture(DASH, Inches(0.92), Inches(2.35), width=Inches(6.3))
    line1(s, 0.92, 5.9, 6.3, 0.5, "omniverse-99so.vercel.app  ·  live product", BODY, 12.5, MUTED, italic=True)
stats = [
    ("0.50", "seeded market, exactly fair"),
    ("3 buys", "escalating 2k / 4k / 6k attack"),
    ("→ 0.89", "probability climbs up the curve"),
    ("63%", "of LP capital pulled into the shield"),
]
sx = 7.9; sy = 2.15
for big, small in stats:
    line1(s, sx, sy, 5.0, 0.7, big, DISPLAY, 38, EMERALD_LT)
    line1(s, sx + 0.05, sy + 0.72, 5.0, 0.5, small, BODY, 14, CREAM)
    sy += 1.18

# ---------------------------------------------------------------- S8 Whats next
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "FROM HACKATHON TO PRODUCT", HEAD, 33, CREAM)
line1(s, 0.74, 1.25, 9.0, 0.9, "what's next", SCRIPT, 46, EMERALD)
nx = [
    ("01", "Trustless resolution", "Replace the owner-controlled resolver with a multi-agent AI oracle that can debate, vote, and abstain when unsure."),
    ("02", "Smarter trading tools", "Limit orders and 'basket' bets that let a trader express a whole distribution in a single transaction."),
    ("03", "Consumer-friendly UX", "Plain belief-meters instead of raw curves, push alerts, and one-tap betting."),
    ("04", "AI agents as traders", "A closed-form instant price is perfect for autonomous agents to query and trade against."),
]
positions = [(0.72, 2.35), (6.95, 2.35), (0.72, 4.65), (6.95, 4.65)]
for (n, t, b), (cx, cy) in zip(nx, positions):
    card(s, cx, cy, 5.6, 2.05)
    tf = box(s, cx + 0.35, cy + 0.28, 0.9, 0.8)
    para(tf, [R(n, SCRIPT, 40, EMERALD)], first=True)
    line1(s, cx + 1.25, cy + 0.4, 4.1, 0.6, t, BODY, 16.5, CREAM, bold=True)
    tf2 = box(s, cx + 0.35, cy + 1.05, 5.0, 0.9)
    para(tf2, [R(b, BODY, 12.5, MUTED)], first=True, sp=1.08)

# ---------------------------------------------------------------- S9 Why it matters + team
s = slide()
line1(s, 0.72, 0.5, 11.5, 0.9, "WHY THIS", HEAD, 38, CREAM)
line1(s, 3.7, 0.5, 7.0, 0.9, "matters", SCRIPT, 50, EMERALD)
card(s, 0.72, 2.1, 7.4, 4.4)
tf = box(s, 1.1, 2.55, 6.7, 3.6, anchor=MSO_ANCHOR.TOP)
para(tf, [R("Prediction markets only matter if the people funding them survive.",
            BODY, 21, CREAM, True)], first=True, sp=1.15)
para(tf, [R("Omniverse makes providing liquidity survivable and makes borrowing "
            "liquidation-free — and the math that does it runs on-chain today, on "
            "Arbitrum Sepolia, not in a backend somewhere.", BODY, 16, MUTED)],
     sp=1.2, before=14)
# team panel
card(s, 8.35, 2.1, 4.25, 4.4, fill=PANEL2)
line1(s, 8.7, 2.4, 3.6, 0.5, "THE TEAM", BODY, 13, EMERALD, bold=True)
logo(s, 10.0, 2.85, 0.98)
line1(s, 8.7, 4.05, 3.6, 0.5, "@vihaan1016", BODY, 15.5, CREAM, bold=True)
line1(s, 8.7, 4.5, 3.6, 0.5, "@Sarnav07", BODY, 15.5, CREAM, bold=True)
line1(s, 8.7, 4.95, 3.6, 0.5, "@pranav7002", BODY, 15.5, CREAM, bold=True)
line1(s, 8.7, 5.65, 3.6, 0.8, "Blockchain Society · IIT Roorkee", BODY, 13.5, MUTED)

# ---------------------------------------------------------------- S10 Thank you
s = slide()
logo(s, 0.6, 0.55, 1.15)
line1(s, 1.0, 2.35, 11.5, 0.7, "OMNIVERSE — liquidity, defended.", BODY, 22, CREAM, italic=True)
line1(s, 0.9, 3.0, 12, 2.0, "THANK", DISPLAY, 150, GHOST)
line1(s, 6.6, 3.85, 6.5, 1.8, "you", SCRIPT, 130, CREAM)
line1(s, 1.0, 6.75, 11.5, 0.5, "omniverse-99so.vercel.app", BODY, 15, EMERALD_LT, bold=True)

out = os.path.join(ROOT, "OMNIVERSE_Deck.pptx")
prs.save(out)
print("saved", out, "slides:", len(prs.slides._sldIdLst))
