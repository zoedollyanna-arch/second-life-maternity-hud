// ============================================================================
// NESTORIA PREGNANCY HUD — Universal prop script (foods, water, vitamins…)
// ----------------------------------------------------------------------------
// One script for every hand-held prop. Drop it into the prop and set the
// object's DESCRIPTION field to configure it:
//
//     action|param|animtype|seconds|Display Name
//
// Examples (copy one into the prop's description):
//     food_eat|pickle_chips|eat|30|Pickle Chips
//     food_eat|chocolate_bar|eat|25|Chocolate Bar
//     food_eat|ham_sub|eat|35|Ham Sub
//     food_eat|spaghetti|eat|40|Spaghetti
//     food_eat|chicken_bacon_burger|eat|35|Chicken Bacon Burger
//     food_eat|lasagna|eat|40|Lasagna
//     food_eat|jam_toast|eat|20|Jam Toast
//     food_eat|cheeseburger|eat|30|Cheeseburger
//     food_eat|french_toast|eat|25|French Toast
//     drink_water||drink|20|Water Bottle
//     vitamins||hold|12|Prenatal Vitamins
//
// animtype: eat / drink / hold — picks the RP chat lines and which inventory
// animation to play ("nestoria_eat", "nestoria_drink" or "nestoria_hold";
// skipped gracefully if the animation isn't in the prop).
//
// How it works: wear the prop → a cute hovertext progress bar counts through
// the action with sweet RP lines in local chat → when finished, the prop
// tells the Main HUD on a private owner channel and the HUD credits the
// action on the server (stats, sounds, toasts). The prop then detaches
// itself. No API secret needed in props — the Main HUD does the talking.
// ============================================================================

float   TICK = 1.0;                 // hovertext update rate
vector  TEXT_COLOR = <1.0, 0.78, 0.88>;

// ---------------------------------------------------------------------------
string  gAction   = "food_eat";
string  gParam    = "";
string  gAnimType = "eat";
float   gSeconds  = 30.0;
string  gItemName = "Something yummy";

integer gRunning  = FALSE;
float   gStarted;
integer gSaid25; integer gSaid50; integer gSaid75;
string  gAnimPlaying = "";
string  gUse = "";
integer gDose = FALSE;
integer gSent = FALSE;
integer gAcked = FALSE;
integer gListen = 0;

// Must match comfortChannel() in nestoria_main_hud.lsl
integer hudChannel()
{
    return -1 - ((integer)("0x" + llGetSubString((string)llGetOwner(), 0, 6)) & 0x7FFFFFF);
}

string ownerName()
{
    string n = llGetDisplayName(llGetOwner());
    if (n == "" || n == "???") n = llKey2Name(llGetOwner());
    return n;
}

loadConfig()
{
    list parts = llParseStringKeepNulls(llGetObjectDesc(), ["|"], []);
    if (llGetListLength(parts) >= 5)
    {
        gAction   = llStringTrim(llList2String(parts, 0), STRING_TRIM);
        gParam    = llStringTrim(llList2String(parts, 1), STRING_TRIM);
        gAnimType = llStringTrim(llList2String(parts, 2), STRING_TRIM);
        gSeconds  = (float)llList2String(parts, 3);
        gItemName = llStringTrim(llList2String(parts, 4), STRING_TRIM);
    }
    else
    {
        string desc = llStringTrim(llGetObjectDesc(), STRING_TRIM);
        if (desc == "water" || desc == "prenatals")
        {
            gAction = desc == "water" ? "drink_water" : "vitamins";
            gAnimType = desc == "water" ? "drink" : "hold";
            gSeconds = desc == "water" ? 20.0 : 12.0;
            gItemName = desc == "water" ? "Water with Lemon" : "Prenatal Vitamins";
        }
    }
    if (gSeconds < 5.0) gSeconds = 30.0;
    if (gAnimType != "drink" && gAnimType != "hold") gAnimType = "eat";
    gDose = (gAction == "drink_water" || gAction == "vitamins");
}

string emojiFor()
{
    if (gAnimType == "drink") return "[Water]";
    if (gAnimType == "hold")  return "[Vitamins]";
    return "[Food]";
}

string verbFor()
{
    if (gAnimType == "drink") return "Sipping";
    if (gAnimType == "hold")  return "Taking";
    return "Nibbling";
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

sayLine(integer pct)
{
    string who = ownerName();
    string line = "";
    if (gAction == "drink_water")
    {
        if (pct == 25) line = who + " takes a bright little sip of lemon water.";
        else if (pct == 50) line = who + " sips slowly, letting the lemon water settle.";
        else if (pct == 75) line = who + " tips the cup for the last lemony drops.";
        else line = who + " finishes her lemon water with a happy sigh. Ahh, much better!";
    }
    else if (gAnimType == "drink")
    {
        if (pct == 25) line = who + " takes a long, refreshing sip of " + gItemName + ".";
        else if (pct == 50) line = who + " sips slowly - staying hydrated for two.";
        else if (pct == 75) line = who + " tips the " + gItemName + " back for the last drops.";
        else line = who + " finishes the " + gItemName + " with a happy sigh. Ahh, much better!";
    }
    else if (gAnimType == "hold")
    {
        if (pct == 25) line = who + " shakes a " + gItemName + " into her palm.";
        else if (pct == 50) line = who + " takes her " + gItemName + " like a champ.";
        else if (pct == 75) line = who + " washes it down with a little water.";
        else line = who + " is all done - baby says thank you!";
    }
    else
    {
        if (pct == 25) line = who + " takes a happy little bite of " + gItemName + ".";
        else if (pct == 50) line = who + " is really enjoying this " + gItemName + " - baby approves!";
        else if (pct == 75) line = who + " savors every last bite of the " + gItemName + ".";
        else line = who + " finishes the " + gItemName + " and pats her tummy. So good! ♥";
    }
    llSay(0, "/me " + line);
}

startAnim()
{
    string wanted = "nestoria_" + gAnimType;
    if (gAction == "vitamins" && llGetInventoryType("nestoria_vitamins") == INVENTORY_ANIMATION)
        wanted = "nestoria_vitamins";
    else if (gAction == "vitamins" && llGetInventoryType("nestoria_hold") == INVENTORY_ANIMATION)
        wanted = "nestoria_hold";
    if (llGetInventoryType(wanted) == INVENTORY_ANIMATION
        && (llGetPermissions() & PERMISSION_TRIGGER_ANIMATION))
    {
        llStartAnimation(wanted);
        gAnimPlaying = wanted;
    }
}

stopAnim()
{
    if (gAnimPlaying != "" && (llGetPermissions() & PERMISSION_TRIGGER_ANIMATION))
        llStopAnimation(gAnimPlaying);
    gAnimPlaying = "";
}

string doseKey()
{
    if (gAction == "vitamins") return "prenatals";
    return "water";
}

begin()
{
    if (gSent) return;
    loadConfig();
    gRunning = TRUE;
    gSaid25 = FALSE; gSaid50 = FALSE; gSaid75 = FALSE;
    if (gDose && gUse == "") gUse = (string)llGenerateKey();
    llResetTime();
    gStarted = llGetTime();
    startAnim();
    llSetText(emojiFor() + " " + verbFor() + " " + gItemName + "\n" + progressBar(0.0), TEXT_COLOR, 1.0);
    llSetTimerEvent(TICK);
}

reportDose()
{
    if (!gDose || gUse == "" || gAcked) return;
    gSent = TRUE;
    llRegionSay(hudChannel(), "nestoria_prop_done|" + doseKey() + "|" + gUse);
}

finish()
{
    if (gAcked || (gDose && gSent)) return;
    gRunning = FALSE;
    stopAnim();
    sayLine(100);
    if (gDose)
    {
        llSetText("♥ " + gItemName + " ♥\n" + progressBar(1.0) + "\nAll finished! Saving your care...", TEXT_COLOR, 1.0);
        reportDose();
        llSetTimerEvent(8.0);
        return;
    }
    llSetTimerEvent(0.0);
    llSetText("", ZERO_VECTOR, 0.0);
    llRegionSay(hudChannel(), "nestoria_prop_done|" + gAction + "|" + gParam + "|" + gItemName);
    llSleep(1.0);
    if (llGetAttached() && (llGetPermissions() & PERMISSION_ATTACH))
        llDetachFromAvatar();
}

clearWorn()
{
    llSetTimerEvent(0.0);
    gRunning = FALSE;
    stopAnim();
    llSetText("", ZERO_VECTOR, 0.0);
}

default
{
    state_entry()
    {
        loadConfig();
        llListenRemove(gListen);
        gListen = llListen(hudChannel(), "", NULL_KEY, "");
        if (llGetAttached())
        {
            llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION | PERMISSION_ATTACH);
        }
        else
        {
            llSetText(emojiFor() + " " + gItemName + "\nWear me ♥", TEXT_COLOR, 1.0);
        }
    }

    attach(key id)
    {
        if (id != NULL_KEY)
        {
            llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION | PERMISSION_ATTACH);
        }
        else clearWorn();
    }

    run_time_permissions(integer perm)
    {
        if ((perm & PERMISSION_TRIGGER_ANIMATION) && llGetAttached() && !gRunning)
            begin();
    }

    touch_start(integer n)
    {
        if (llGetAttached())
        {
            if (llDetectedKey(0) != llGetOwner()) return;
            if (gSent && !gAcked) reportDose();
            else if (!gRunning) begin();
        }
        else
        {
            llWhisper(0, "♥ " + gItemName + ": wear me from your inventory to enjoy!");
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (channel != hudChannel() || llGetOwnerKey(id) != llGetOwner()) return;
        list parts = llParseStringKeepNulls(message, ["|"], []);
        if (llList2String(parts, 0) != "nestoria_prop_ack" || llList2String(parts, 1) != gUse) return;
        if (llList2String(parts, 2) == "ok")
        {
            gAcked = TRUE;
            llSetTimerEvent(0.0);
            llSetText("", ZERO_VECTOR, 0.0);
            stopAnim();
            if (llGetAttached() && (llGetPermissions() & PERMISSION_ATTACH))
                llDetachFromAvatar();
        }
        else
        {
            llSetTimerEvent(0.0);
            llSetText("♥ Not saved\n" + gItemName + " can rest for now", TEXT_COLOR, 1.0);
        }
    }

    timer()
    {
        if (gSent && !gAcked)
        {
            reportDose();
            return;
        }
        if (!gRunning) { llSetTimerEvent(0.0); return; }
        float frac = (llGetTime() - gStarted) / gSeconds;
        if (frac >= 1.0) { finish(); return; }

        llSetText(emojiFor() + " " + verbFor() + " " + gItemName + "\n" + progressBar(frac), TEXT_COLOR, 1.0);
        integer pct = (integer)(frac * 100.0);
        if (pct >= 25 && !gSaid25) { gSaid25 = TRUE; sayLine(25); }
        else if (pct >= 50 && !gSaid50) { gSaid50 = TRUE; sayLine(50); }
        else if (pct >= 75 && !gSaid75) { gSaid75 = TRUE; sayLine(75); }
    }

    on_rez(integer start)
    {
        llResetScript();
    }
}
