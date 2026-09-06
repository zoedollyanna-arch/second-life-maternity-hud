# Build the Nestoria build-update PDF.
#
# Everything stays inside Latin-1 / WinAnsi, because ReportLab's built-in fonts
# have no glyphs outside it and anything else renders as a solid black box.
# Decorative hearts are drawn as vector shapes rather than typed as characters.

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak, Flowable,
)

OUT = os.path.join(os.getcwd(), "Nestoria-Build-Update.pdf")

# --- palette ---------------------------------------------------------------
LAV_DEEP = colors.HexColor("#7C5CA0")
LAV = colors.HexColor("#A77ACB")
LAV_SOFT = colors.HexColor("#D6C6E7")
LAV_PALE = colors.HexColor("#F1EAF8")
BLUSH = colors.HexColor("#F6C6D6")
BLUSH_PALE = colors.HexColor("#FDF0F4")
CREAM = colors.HexColor("#FFF9F0")
INK = colors.HexColor("#4D405E")
MUTED = colors.HexColor("#8A7E99")
PAGE_BG = colors.HexColor("#FBF8FD")
GREEN = colors.HexColor("#6FA88B")

PAGE_W, PAGE_H = A4
M = 16 * mm


def check_latin1(s):
    try:
        s.encode("latin-1")
    except UnicodeEncodeError as e:
        raise SystemExit("Non-Latin-1 character in text: %r ... %s" % (s[max(0, e.start - 30):e.end + 30], e))


# --- styles ----------------------------------------------------------------
def st(name, **kw):
    base = dict(name=name, fontName="Helvetica", fontSize=9.5, leading=13.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


S = {
    "h1": st("h1", fontName="Helvetica-Bold", fontSize=21, leading=25, textColor=LAV_DEEP, spaceAfter=2),
    "sub": st("sub", fontSize=10.5, leading=14, textColor=MUTED),
    "h2": st("h2", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=LAV_DEEP,
             spaceBefore=2, spaceAfter=4),
    "h3": st("h3", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK, spaceAfter=3),
    "body": st("body"),
    "bodytight": st("bodytight", spaceAfter=0),
    "muted": st("muted", fontSize=8.8, leading=12, textColor=MUTED),
    "mutedc": st("mutedc", fontSize=8.8, leading=12, textColor=MUTED, alignment=TA_CENTER),
    "lead": st("lead", fontSize=10.5, leading=15),
    "cell": st("cell", fontSize=8.8, leading=12),
    "cellb": st("cellb", fontName="Helvetica-Bold", fontSize=8.8, leading=12),
    "code": st("code", fontName="Courier-Bold", fontSize=8.6, leading=12, textColor=LAV_DEEP),
    "tasknum": st("tasknum", fontName="Helvetica-Bold", fontSize=15, leading=17,
                  textColor=colors.white, alignment=TA_CENTER),
    "quote": st("quote", fontSize=10, leading=14.5, textColor=LAV_DEEP,
                fontName="Helvetica-Oblique", alignment=TA_CENTER),
}


# --- little drawn heart ----------------------------------------------------
def heart(c, x, y, s, col, alpha=1.0):
    """A small vector heart, so no font glyph is needed."""
    c.saveState()
    c.setFillColor(col)
    c.setStrokeColor(col)
    try:
        c.setFillAlpha(alpha)
        c.setStrokeAlpha(alpha)
    except Exception:
        pass
    p = c.beginPath()
    p.moveTo(x, y - s * 0.62)
    p.curveTo(x - s * 1.05, y + s * 0.18, x - s * 0.44, y + s * 1.02, x, y + s * 0.34)
    p.curveTo(x + s * 0.44, y + s * 1.02, x + s * 1.05, y + s * 0.18, x, y - s * 0.62)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()


# --- card flowable ---------------------------------------------------------
class Card(Flowable):
    """Rounded panel wrapping other flowables. Table's ROUNDEDCORNERS does not
    handle nested content heights reliably, so the box is drawn by hand."""

    def __init__(self, content, bg=colors.white, border=LAV_SOFT, pad=8, radius=9,
                 accent=None, width=None):
        Flowable.__init__(self)
        self.content = content
        self.bg, self.border, self.pad, self.radius = bg, border, pad, radius
        self.accent = accent
        self._w = width

    def wrap(self, aw, ah):
        self.width = self._w or aw
        inner = self.width - 2 * self.pad
        h = 0
        self._sizes = []
        for f in self.content:
            fw, fh = f.wrap(inner, ah)
            self._sizes.append(fh)
            h += fh
        self.height = h + 2 * self.pad
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(self.bg)
        c.setStrokeColor(self.border)
        c.setLineWidth(0.9)
        c.roundRect(0, 0, self.width, self.height, self.radius, fill=1, stroke=1)
        if self.accent:
            c.setFillColor(self.accent)
            p = c.beginPath()
            p.moveTo(0, self.radius)
            p.curveTo(0, 0, 0, 0, self.radius, 0)
            p.lineTo(3.2, 0)
            p.lineTo(3.2, self.height)
            p.lineTo(self.radius, self.height)
            p.curveTo(0, self.height, 0, self.height, 0, self.height - self.radius)
            p.close()
            c.drawPath(p, fill=1, stroke=0)
        c.restoreState()

        y = self.height - self.pad
        for f, fh in zip(self.content, self._sizes):
            y -= fh
            f.drawOn(c, self.pad, y)


class Rule(Flowable):
    def __init__(self, col=LAV_SOFT, w=None, thick=0.8):
        Flowable.__init__(self)
        self.col, self._w, self.thick = col, w, thick

    def wrap(self, aw, ah):
        self.width = self._w or aw
        self.height = self.thick
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(self.col)
        self.canv.setLineWidth(self.thick)
        self.canv.line(0, 0, self.width, 0)


def P(text, style="body"):
    check_latin1(text)
    return Paragraph(text, S[style])


def bullets(items, style="body", bullet_col=LAV):
    """Bulleted list drawn with heart-free round dots for tight, even spacing."""
    rows = []
    for it in items:
        check_latin1(it)
        rows.append([Paragraph('<font color="#%s">&bull;</font>' % bullet_col.hexval()[2:],
                               S[style]), Paragraph(it, S[style])])
    t = Table(rows, colWidths=[9, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    return t


def datatable(header, rows, widths, header_bg=LAV_PALE):
    data = [[Paragraph(h, S["cellb"]) for h in header]]
    for r in rows:
        data.append([Paragraph(x, S["cell"]) for x in r])
    for row in data:
        pass
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LAV_SOFT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
        ("BOX", (0, 0), (-1, -1), 0.7, LAV_SOFT),
    ]))
    return t


class Checkbox(Flowable):
    def __init__(self, size=8.5):
        Flowable.__init__(self)
        self.size = size

    def wrap(self, aw, ah):
        self.width, self.height = self.size, self.size
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setStrokeColor(LAV)
        c.setFillColor(colors.white)
        c.setLineWidth(0.9)
        c.roundRect(0, 0, self.size, self.size, 2, fill=1, stroke=1)


def checklist(items):
    rows = []
    for it in items:
        check_latin1(it)
        rows.append([Checkbox(), Paragraph(it, S["cell"])])
    t = Table(rows, colWidths=[15, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def task(n, title, mins, why, how):
    """One beginner-sized step: a number, what to do, and why it matters."""
    num = Table([[Paragraph(str(n), S["tasknum"])]], colWidths=[22], rowHeights=[22])
    num.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LAV),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("ROUNDEDCORNERS", [11, 11, 11, 11]),
    ]))
    right = [
        P('<b>%s</b> &nbsp;<font color="#8A7E99" size="8">about %s</font>' % (title, mins), "h3"),
        P(how, "body"),
        Spacer(1, 2),
        P('<i>Why it matters:</i> %s' % why, "muted"),
    ]
    inner = Table([[num, right]], colWidths=[30, None])
    inner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([Card([inner], bg=colors.white, accent=BLUSH), Spacer(1, 6)])


# --- page furniture --------------------------------------------------------
def page_bg(c, doc):
    c.saveState()
    c.setFillColor(PAGE_BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # soft blush band behind the header
    c.setFillColor(colors.HexColor("#F7EFFA"))
    c.rect(0, PAGE_H - 30 * mm, PAGE_W, 30 * mm, fill=1, stroke=0)
    c.setStrokeColor(LAV_SOFT)
    c.setLineWidth(0.8)
    c.line(M, PAGE_H - 30 * mm, PAGE_W - M, PAGE_H - 30 * mm)

    # wordmark
    c.setFillColor(LAV_DEEP)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(M, PAGE_H - 19 * mm, "NESTORIA")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(M + 26 * mm, PAGE_H - 19 * mm, "Pregnancy & Family HUD  |  Build update")

    heart(c, PAGE_W - M - 3, PAGE_H - 18.6 * mm, 4.6, BLUSH)

    # scattered hearts, very faint
    for (hx, hy, hs, a) in [(0.90, 0.66, 3.2, 0.16), (0.07, 0.42, 4.0, 0.12),
                            (0.94, 0.24, 3.6, 0.14), (0.10, 0.80, 3.0, 0.13)]:
        heart(c, PAGE_W * hx, PAGE_H * hy, hs, LAV, a)

    # footer
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.6)
    c.drawString(M, 11 * mm, "Nestoria build update  |  6 September 2026")
    c.drawRightString(PAGE_W - M, 11 * mm, "Page %d" % doc.page)
    c.setStrokeColor(LAV_SOFT)
    c.line(M, 14.5 * mm, PAGE_W - M, 14.5 * mm)
    c.restoreState()


doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=M, rightMargin=M, topMargin=34 * mm, bottomMargin=19 * mm,
    title="Nestoria - Build Update", author="Nestoria",
    subject="What changed, what is next, and how to test in world",
)
frame = Frame(M, 19 * mm, PAGE_W - 2 * M, PAGE_H - 34 * mm - 19 * mm, id="body",
              leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=page_bg)])

F = []

# ===========================================================================
# PAGE 1
# ===========================================================================
F.append(P("What we built this round", "h1"))
F.append(P("And the small, doable things that come next. We are building this together "
           "- none of the list below is meant to land on you alone.", "sub"))
F.append(Spacer(1, 10))

F.append(Card([
    P("Your two big notes were: <b>Settings is showing every button twice</b>, and "
      "<b>the popups keep repeating</b>. Both are fixed, and three more things from "
      "your feedback board went in with them.", "lead"),
], bg=BLUSH_PALE, border=BLUSH, pad=10))
F.append(Spacer(1, 12))

F.append(P("1. The moments feel alive now", "h2"))
F.append(Card([
    P("<b>What was wrong.</b> There were only about eight moments in the whole system, "
      "and mood swings took up half of every roll. Worse, the blue menu in world always "
      "showed the same five buttons - Rub belly, Count kick, Water, Rest, Journal - no "
      "matter what had actually happened.", "body"),
    Spacer(1, 5),
    P("<b>What it does now.</b>", "body"),
    bullets([
        "<b>38 different moments</b> instead of eight, and mood swings are now about a "
        "third of them rather than half.",
        "<b>Every moment brings its own buttons.</b> Feeling sick offers ginger ale, a "
        "plain snack, medicine, or letting it happen. A kick offers talking to the baby "
        "or telling your partner. The blue menu builds itself from whatever that moment "
        "actually offers.",
        "<b>Whatever just happened cannot happen again.</b> Over an hour of play you now "
        "see 24 to 29 different moments with no repeats back to back.",
        "<b>They follow her body and her mood.</b> Low on water makes dizziness likely. "
        "No partner linked makes loneliness likely. Happy brings kicks and sweet daydreams. "
        "Each moment can leave her in a new mood, so it keeps flowing.",
        "<b>The tablet and the blue menu are the same moment.</b> Answer it in either "
        "place and it closes in the other.",
    ]),
], accent=LAV))
F.append(Spacer(1, 10))

F.append(P("2. Settings is a real settings screen", "h2"))
F.append(Card([
    P("The old <i>Production buttons</i> panel is gone completely. Every button on it "
      "already had a home on its own tab - cravings now live on Nutrition, and the "
      "manual event roll moved into Settings.", "body"),
    Spacer(1, 5),
    P("In its place, five tabs she actually controls:", "body"),
    Spacer(1, 4),
    datatable(
        ["Tab", "What she can change"],
        [
            ["Journey", "Baby name, what you are expecting, how many real days the pregnancy takes."],
            ["Events", "How often moments arrive, where they appear, and eight on/off switches "
                       "for the kinds of moment she wants."],
            ["Sound", "Master sound and volume, plus a switch for each in-world animation."],
            ["Privacy", "Who can see the journey, public roleplay emotes, and exactly which "
                        "kinds of news reach her partner."],
            ["Realism", "How fast the meters move, whether pica cravings happen, and the "
                        "hidden testing tools."],
        ],
        widths=[62, None],
    ),
    Spacer(1, 5),
    P("All of it is enforced on the server. Switching an animation off really stops it "
      "being sent - it is not just hidden on the screen.", "muted"),
], accent=LAV))

F.append(PageBreak())

# ===========================================================================
# PAGE 2
# ===========================================================================
F.append(P("3. Three more things straight off your board", "h2"))
F.append(Spacer(1, 4))

F.append(Card([
    P("No water during labour - ice chips only", "h3"),
    P("You put this in its own box on your board, and it was only half true: her partner "
      "was blocked from bringing water, but she could still pour herself a glass. Now "
      "neither can, and the Care screen swaps the Water button for <b>Ice chips</b> the "
      "moment labour starts, with a little reminder line above it.", "body"),
], accent=BLUSH))
F.append(Spacer(1, 7))

F.append(Card([
    P("Food went from 19 items to 61", "h3"),
    P("Every group on your board is now filled in properly:", "body"),
    Spacer(1, 4),
    datatable(
        ["Group", "Now has", "Some of what is in there"],
        [
            ["Breakfast", "8", "Eggs, pancakes, waffles, cereal, oatmeal, toast"],
            ["Meals", "11", "Roast chicken, steak, fish, rice, soup, salad, pasta"],
            ["Snacks", "8", "Crisps, crackers, cookies, popcorn, pretzels, granola"],
            ["Fruits", "9", "Grapes, apple, banana, orange, pineapple, mango, peach"],
            ["Drinks", "9", "Juice, milk, smoothie, tea, protein shake, coconut water"],
            ["Desserts", "8", "Cake, cupcake, donut, brownie, cheesecake, pudding"],
            ["Cravings", "6", "Pizza, pickles, buttery pasta, something spicy, olives"],
            ["Corn starch & chalk", "2", "Both, and she can switch them off in Settings"],
        ],
        widths=[88, 40, None],
    ),
    Spacer(1, 5),
    P("Cravings also draw from a much wider pool now, and it changes by trimester - plain "
      "and sour early on, everything in the middle, heavy and icy at the end.", "body"),
], accent=BLUSH))
F.append(Spacer(1, 7))

F.append(Card([
    P("Every action has an animation slot now", "h3"),
    P("This one is quietly important. Only four actions could ever play an animation. "
      "Sleep, being sick and contractions were all secretly playing the <i>resting</i> "
      "animation, and crying and the bathroom played nothing at all - so even if you had "
      "uploaded a crying animation, nothing would have used it.", "body"),
    Spacer(1, 4),
    P("Now all eleven have their own slot, with a sensible fallback until the real one "
      "exists. Animations also stop themselves when the next one starts, so being sick is "
      "a moment rather than a pose she gets stuck in.", "body"),
], accent=BLUSH))
F.append(Spacer(1, 10))

F.append(Card([
    P("One thing I need you to decide", "h3"),
    P("Your board lists <b>Water Break</b> and <b>Birth</b> as buttons she can press. "
      "But we built labour so the <i>server</i> decides when it happens - it arrives on "
      "its own somewhere between week 37 and 42, and both HUDs find out in the same "
      "moment. Those two buttons were removed on purpose.", "body"),
    Spacer(1, 4),
    P("Both are reasonable. Which do you want?", "body"),
    Spacer(1, 3),
    bullets([
        "<b>Keep it as it is</b> - labour is a surprise, and nobody can rush it.",
        "<b>Bring the buttons back</b> - she can trigger these moments for a scene.",
        "<b>In between</b> - keep them as replay emotes that act out the moment in world "
        "without changing the real labour underneath. This is the one I would pick.",
    ]),
], bg=CREAM, border=BLUSH, accent=LAV))

F.append(PageBreak())

# ===========================================================================
# PAGE 3 - what is left
# ===========================================================================
F.append(P("What is still to do", "h1"))
F.append(P("Grouped by what kind of work it is, so you can pick up whichever suits the "
           "day you are having.", "sub"))
F.append(Spacer(1, 10))

F.append(P("Animations - the biggest gap, and the easiest to close", "h2"))
F.append(Card([
    P("The script is already waiting for every one of these. Drop an animation into the "
      "HUD with the exact name below and it starts working. <b>No code, no script "
      "editing.</b> If a name is missing the HUD just skips it, so nothing ever breaks.",
      "body"),
    Spacer(1, 5),
    datatable(
        ["Animation name", "Plays when", "If missing", "Priority"],
        [
            ["nestoria_rest", "Rest, and stands in for others", "-", "Start here"],
            ["nestoria_drink", "Drink water, ice chips", "-", "Start here"],
            ["nestoria_vitamins", "Taking vitamins", "-", "Start here"],
            ["nestoria_belly_hold", "Holding and rubbing the bump", "-", "Start here"],
            ["nestoria_cry", "Crying, and emotional moments", "nothing plays", "High"],
            ["nestoria_vomit", "Being sick", "rest plays", "High"],
            ["nestoria_sleep", "Sleeping, napping", "rest plays", "High"],
            ["nestoria_yawn", "Sleepy and tired moods", "rest plays", "Medium"],
            ["nestoria_bathroom", "Bathroom break", "nothing plays", "Medium"],
            ["nestoria_contraction", "Contractions in labour", "rest plays", "Medium"],
            ["nestoria_comfort", "Comfort, with the chair", "nothing plays", "Later"],
        ],
        widths=[112, 150, 74, None],
    ),
    Spacer(1, 5),
    P("<b>The two that play nothing at all today are crying and the bathroom.</b> Those "
      "are the ones where adding a file makes the most visible difference.", "muted"),
], accent=LAV))
F.append(Spacer(1, 10))

F.append(P("Sounds", "h2"))
F.append(Card([
    P("Same rule - present means it plays, missing means it is skipped.", "body"),
    Spacer(1, 4),
    datatable(
        ["Sound name", "Plays when", "Priority"],
        [
            ["nestoria_chime", "Notifications, hearts, vitamins", "Start here"],
            ["nestoria_heartbeat", "Doctor, ultrasound, contractions", "Start here"],
            ["nestoria_sip", "Drinking", "High"],
            ["nestoria_vomit", "Being sick (falls back to the chime)", "High"],
            ["nestoria_cry", "Crying", "Medium"],
            ["nestoria_yawn", "Sleepy moods, going to sleep", "Later"],
        ],
        widths=[112, 230, None],
    ),
    Spacer(1, 5),
    P("Good news: the tablet screen already makes its own sounds, and Second Life plays "
      "those through media audio. So the HUD is never silent even with no sound files at "
      "all. These are an upgrade, not a requirement.", "muted"),
], accent=LAV))

F.append(PageBreak())

# ===========================================================================
# PAGE 4 - objects + end to end
# ===========================================================================
F.append(P("Objects to build", "h2"))
F.append(Card([
    datatable(
        ["Object", "Status", "What is needed"],
        [
            ["nestoria_chair", "Script done", "A cosy chair mesh. Required for Comfort."],
            ["nestoria_toilet", "Script done", "A toilet mesh, for the bathroom moment."],
            ["nestoria_hospital_bed", "Script done", "A bed mesh for labour and birth."],
            ["nestoria_hospital_bag", "Script done", "A bag she or her partner wears."],
            ["nestoria_mess", "Not started", "New. The little pile on the floor after "
                                             "being sick. Needs a small mesh and a tidy-up "
                                             "script - we will write that one together."],
            ["Food props", "Script done", "Hand-held foods, drinks, vitamins."],
        ],
        widths=[112, 68, None],
    ),
], accent=LAV))
F.append(Spacer(1, 10))

F.append(P("Plugging each button through to the world", "h2"))
F.append(Card([
    P("This is the honest gap between where we are and the sentence at the top of your "
      "board: <i>\"I want the buttons to actually perform actions in world whenever "
      "possible, not just change meters.\"</i>", "body"),
    Spacer(1, 4),
    P("Right now most buttons do three of the four things: they move the meters, write a "
      "lovely roleplay line, and tell her partner. The fourth - <b>something visibly "
      "happening in world</b> - is done for some and not others.", "body"),
    Spacer(1, 6),
    datatable(
        ["Button", "Where it stands"],
        [
            ["Rest, Water, Vitamins, Bump", "Fully wired. Animation, sound, meters, line."],
            ["Comfort", "Chair rezzes and she sits. A comfort animation would finish it."],
            ["Bathroom", "Toilet rezzes. Needs the animation."],
            ["Being sick", "Particles and mess object. Needs the animation, the sound, and "
                           "the tidy-up script."],
            ["Cry", "Line only today. Needs animation and sound."],
            ["Sleep", "Borrows the rest animation. Needs its own."],
            ["Feel kick / Count kick", "Logs the kick and tells her partner. Count kick is "
                                       "still one press per kick, not a proper counting "
                                       "session yet."],
            ["Appointment", "Writes a journal entry. No in-world visit yet - no scene, no "
                            "time set, no way for her partner to attend that particular one."],
            ["Ultrasound", "Unlocks the photo and plays the heartbeat. Not a scene the two "
                           "of them attend together yet."],
            ["Contractions, hospital, birth", "Fully wired through the bed. Both HUDs stay "
                                              "in step."],
        ],
        widths=[128, None],
    ),
    Spacer(1, 6),
    P("<b>The two worth doing next</b> are Appointment and Ultrasound. They are the only "
      "places on your board where a whole scene is described and we currently only write "
      "a diary entry.", "body"),
], accent=LAV))

F.append(PageBreak())

# ===========================================================================
# PAGE 5 - her tasks
# ===========================================================================
F.append(P("Your next few steps", "h1"))
F.append(P("Small on purpose. Each one is finishable in a sitting, and each one makes "
           "something visibly work. You do not have to do them in order, and you "
           "definitely do not have to do them all.", "sub"))
F.append(Spacer(1, 10))

F.append(task(1, "Re-save the HUD script", "5 minutes",
              "Until you do this, the blue menu in world still shows the old five buttons "
              "for every event. Everything else is already live.",
              "Open your HUD in world, open the script inside it, and paste in the new "
              "<font face='Courier-Bold' size='8.5'>lsl/nestoria_main_hud.lsl</font>. "
              "Check the two lines at the top still have your correct web address and "
              "secret, then Save."))

F.append(task(2, "Find one animation - start with crying", "20 minutes",
              "Crying is the only action that plays nothing at all right now, so adding "
              "it is the single most noticeable change you can make today.",
              "Search the Marketplace for <i>full perm animation crying</i> or "
              "<i>full perm emotion animations</i>. Buy one, rename it exactly "
              "<font face='Courier-Bold' size='8.5'>nestoria_cry</font>, and drop it into "
              "your HUD's contents. Nothing else needed."))

F.append(task(3, "Test that it worked", "2 minutes",
              "Getting one thing working end to end teaches you the whole pattern. Every "
              "other animation works exactly the same way.",
              "Touch your HUD, go to <b>Care</b>, and press <b>Cry</b>. If your avatar "
              "cries, you just shipped a feature on your own."))

F.append(task(4, "Do the same for two more", "30 minutes",
              "These two are currently borrowing the resting animation, which is why "
              "being sick looks like sitting down calmly.",
              "Repeat step 2 for <font face='Courier-Bold' size='8.5'>nestoria_vomit</font> "
              "and <font face='Courier-Bold' size='8.5'>nestoria_sleep</font>. Same idea, "
              "same folder, exact names."))

F.append(task(5, "Build the mess prim", "30 minutes",
              "It is the fourth of the five steps you drew for the vomiting sequence, and "
              "it is a nice gentle piece of building practice.",
              "Make a small flat prim, put a food-ish texture on it, and name it "
              "<font face='Courier-Bold' size='8.5'>nestoria_mess</font>. Take it to your "
              "inventory and drop it in the HUD. Do not worry about making it disappear "
              "again - that is a script, and we will write it together."))

F.append(task(6, "Play for twenty minutes and take notes", "20 minutes",
              "You are the only person who knows how it is meant to feel. A note like "
              "\"this line came up twice and felt odd\" is worth more than any bug report.",
              "Turn the events on, potter about, and write down anything that felt "
              "repetitive, wrong, or interrupted you when it should not have."))

F.append(Spacer(1, 4))
F.append(Card([
    P("If any of that gets stuck, stop and send it to me. Getting stuck for twenty "
      "minutes is normal and is not a sign you have done anything wrong.", "quote"),
], bg=BLUSH_PALE, border=BLUSH, pad=9))

F.append(PageBreak())

# ===========================================================================
# PAGE 6 - testing checklist
# ===========================================================================
F.append(P("In-world testing checklist", "h1"))
F.append(P("Work down the list with a friend on the Partner HUD. Tick as you go, and "
           "note anything that does not do what the right-hand side says.", "sub"))
F.append(Spacer(1, 10))

def section(title, note, items, accent=LAV):
    inner = [P(title, "h3")]
    if note:
        inner += [P(note, "muted"), Spacer(1, 4)]
    inner += [checklist(items)]
    return KeepTogether([Card(inner, accent=accent), Spacer(1, 8)])

F.append(section("Before you start", "Both of you, before anything else.", [
    "Viewer: Preferences, then Sound &amp; Media, then Media - turn media on and allow it to auto-play.",
    "The new HUD script has been pasted in and saved (step 1 on the last page).",
    "Touch the HUD. The tablet screen loads. If it stays blank for 30 seconds, touch it again - the server may be waking up.",
]))

F.append(section("Pairing", "", [
    "She completes the setup wizard and reaches the home screen.",
    "More, then Partner - a six-character code appears.",
    "He wears the Partner HUD, touches it, and enters her code.",
    "She sees an approval card and accepts it.",
    "His HUD now shows her week, her mood, and how she is doing.",
]))

F.append(section("The moments", "This is the part that was rebuilt - please be picky here.", [
    "Settings, then Events. Set the frequency and choose HUD screen plus in-world menu.",
    "Press Give me a moment now. A card appears at the top of the tablet AND a blue menu pops up.",
    "The buttons on both match each other, and they suit what just happened.",
    "Answer it from the blue menu. The card disappears.",
    "Press it ten times. You get ten different moments - never the same one twice running.",
    "Answer one on the tablet instead. The blue menu for that same moment now says it has passed.",
    "Turn off Mood swings and Sickness. Roll ten more - nothing from those two appears.",
    "Set it to HUD screen only. The card appears, no blue menu.",
    "Set it to quiet mode. Nothing interrupts, but the moment still appears in Alerts.",
]))

F.append(section("Settings that should really work", "", [
    "Sound off - the buttons go silent. Volume at 20 percent - noticeably quieter.",
    "Turn off the vomiting animation. Care, then Be sick - meters still change, no particles.",
    "Turn off the bathroom prop. Care, then Bathroom - relieves the meter, nothing rezzes.",
    "Privacy: turn off Mood swings under what reaches your partner. He stops being pinged about them.",
    "Realism: set it to Gentle. The meters visibly drift more slowly.",
    "Turn off pica cravings. Corn starch and chalk never come up again.",
]))

F.append(section("Food and cravings", "New this round - 61 items.", [
    "Nutrition shows all eight groups, and none of them look thin.",
    "Roll a craving. It names something real, and the five choices work.",
    "Eat the thing she is craving. The craving eases and her mood lifts.",
    "Roll several cravings - you do not get the same one over and over.",
]))

F.append(section("Partner interactions", "Water, vitamins and rest land straight away. "
                                          "Hugs, kisses, back rubs and feeling a kick ask her first.", [
    "He checks on her - he gets a summary in words, limited to what she allows.",
    "He brings water, brings vitamins, helps her rest - these land immediately.",
    "He sends a hug - she gets a request card and nothing happens until she answers.",
    "She accepts one, then declines the next. Both are handled politely.",
    "She turns off Hug, kiss, feel kicks in her privacy settings. He is told why it will not work.",
    "He tries to feel the baby kick with no recent kick - refused. He reacts to kicks, never causes one.",
    "She logs a kick. He tries again within ten minutes - it works.",
    "They both tick hospital bag items. Each shows who packed it, live on both screens.",
]))

F.append(section("Labour and birth", "Settings, Realism, Testing - enter the code "
                                     "nestoria-test to unlock the tools.", [
    "Jump to week 38. The week updates on both HUDs.",
    "Set labour speed to 25 times, then press Start labour now.",
    "Within seconds, contractions begin - and HIS HUD tells him on its own.",
    "IMPORTANT: her Care screen now shows Ice chips where Water used to be, with a reminder line.",
    "She tries to drink water some other way - she cannot. Ice chips only.",
    "He tries to bring water - refused, and told to offer ice chips instead.",
    "He brings ice chips - now available, and it works.",
    "He comforts her, guides her breathing, holds her hand. Her stress drops.",
    "Her waters break, then Time for the hospital - both are told.",
    "Transition, then pushing. Intensity climbs to 100 percent.",
    "He tries Faint or Stay strong - it plays on HIM, never on her.",
    "The baby arrives. Both HUDs announce it together.",
    "Press Reset labour, then Turn off and restore. ALWAYS do this last.",
], accent=BLUSH))

F.append(section("Then tell me", "", [
    "Anything that did nothing when you pressed it.",
    "Any moment that came round too often, or read oddly.",
    "Anything that interrupted you when it should not have.",
    "Anything that felt lovely - genuinely useful to know, so we keep it.",
]))

F.append(Spacer(1, 4))
F.append(Card([
    P("Thank you for the feedback board. It is the reason all of this got built "
      "in the right order.", "quote"),
], bg=BLUSH_PALE, border=BLUSH, pad=9))

doc.build(F)
print("wrote", OUT)
