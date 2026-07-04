// ============================================================================
// NESTORIA PREGNANCY HUD — Comfort chair script
// ----------------------------------------------------------------------------
// Drop into your comfy chair prim/mesh, then put the chair object (named
// exactly "nestoria_chair") inside the Main HUD's contents.
//
// Flow: the Comfort button on the dashboard makes the HUD rez this chair.
// The wearer sits on it for 2 minutes; the chair then tells the HUD (on a
// private owner-derived channel) and the HUD reports the comfort boost to the
// server. The chair cleans itself up afterwards — or after 10 minutes unused.
//
// Adjust SIT_TARGET / SIT_ROT to fit your chair mesh.
// ============================================================================

float   SIT_SECONDS   = 120.0;  // 2 minutes
float   EXPIRE_SECONDS = 600.0; // auto-clean after 10 minutes
vector  SIT_TARGET    = <0.0, 0.0, 0.45>;
vector  SIT_ROT       = <0.0, 0.0, 0.0>;   // Euler degrees

vector  TEXT_COLOR = <1.0, 0.78, 0.88>;

integer gSitting = FALSE;
integer gSaidHalf = FALSE;
float   gSatAt;
float   gRezzedAt;

// Must match comfortChannel() in nestoria_main_hud.lsl
integer comfortChannel()
{
    return -1 - ((integer)("0x" + llGetSubString((string)llGetOwner(), 0, 6)) & 0x7FFFFFF);
}

key seatedAvatar()
{
    return llAvatarOnSitTarget();
}

string ownerName()
{
    string n = llGetDisplayName(llGetOwner());
    if (n == "" || n == "???") n = llKey2Name(llGetOwner());
    return n;
}

string progressBar(float frac)
{
    integer filled = (integer)(frac * 8.0 + 0.5);
    string bar = "";
    integer i;
    for (i = 0; i < 8; i++)
    {
        if (i < filled) bar += "♥";
        else bar += "♡";
    }
    return bar + "  " + (string)((integer)(frac * 100.0)) + "%";
}

default
{
    state_entry()
    {
        llSitTarget(SIT_TARGET, llEuler2Rot(SIT_ROT * DEG_TO_RAD));
        llSetClickAction(CLICK_ACTION_SIT);
        llSetText("☁ Sit with me for 2 minutes ☁", TEXT_COLOR, 1.0);
        llResetTime();
        gRezzedAt = llGetTime();
        llSetTimerEvent(1.0);
    }

    changed(integer change)
    {
        if (!(change & CHANGED_LINK)) return;
        key sitter = seatedAvatar();
        if (sitter != NULL_KEY)
        {
            if (sitter == llGetOwner())
            {
                gSitting = TRUE;
                gSaidHalf = FALSE;
                gSatAt = llGetTime();
                llSay(0, "/me ✨ " + ownerName() + " sinks into the comfy chair with a happy little sigh ☁");
                llSetText("☁ Relaxing…\n" + progressBar(0.0), TEXT_COLOR, 1.0);
            }
            else
            {
                llWhisper(0, "This comfy chair is reserved for someone special ♥");
                llUnSit(sitter);
            }
        }
        else if (gSitting)
        {
            // stood up early — timer restarts on the next sit
            gSitting = FALSE;
            llSetText("☁ Sit with me for 2 minutes ☁", TEXT_COLOR, 1.0);
        }
    }

    timer()
    {
        if (gSitting)
        {
            float elapsed = llGetTime() - gSatAt;
            float remaining = SIT_SECONDS - elapsed;
            if (remaining <= 0.0)
            {
                llRegionSay(comfortChannel(), "nestoria_comfort_done");
                key sitter = seatedAvatar();
                llSetText("", ZERO_VECTOR, 0.0);
                llSay(0, "/me ✨ " + ownerName() + " stretches, feeling wonderfully rested ☁ ♥");
                if (sitter != NULL_KEY) llUnSit(sitter);
                llSleep(1.0);
                llDie();
            }
            else
            {
                if (!gSaidHalf && elapsed >= SIT_SECONDS * 0.5)
                {
                    gSaidHalf = TRUE;
                    llSay(0, "/me ✨ " + ownerName() + " closes her eyes for a moment, one hand resting on her bump ♥");
                }
                integer mins = (integer)(remaining / 60.0);
                integer secs = (integer)remaining % 60;
                llSetText("☁ Relaxing… " + (string)mins + ":" +
                    llGetSubString("0" + (string)secs, -2, -1) + " left\n" +
                    progressBar(elapsed / SIT_SECONDS),
                    TEXT_COLOR, 1.0);
            }
        }
        else if (llGetTime() - gRezzedAt > EXPIRE_SECONDS)
        {
            llDie();
        }
    }

    on_rez(integer start)
    {
        llResetScript();
    }
}
