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
    if (gSeconds < 5.0) gSeconds = 30.0;
    if (gAnimType != "drink" && gAnimType != "hold") gAnimType = "eat";
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
    if (gAnimType == "drink")
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

begin()
{
    loadConfig();
    gRunning = TRUE;
    gSaid25 = FALSE; gSaid50 = FALSE; gSaid75 = FALSE;
    llResetTime();
    gStarted = llGetTime();
    startAnim();
    llSetText(emojiFor() + " " + verbFor() + " " + gItemName + "\n" + progressBar(0.0), TEXT_COLOR, 1.0);
    llSetTimerEvent(TICK);
}

finish()
{
    gRunning = FALSE;
    llSetTimerEvent(0.0);
    llSetText("", ZERO_VECTOR, 0.0);
    stopAnim();
    sayLine(100);
    // Tell the Main HUD to credit the action on the server
    llRegionSay(hudChannel(), "nestoria_prop_done|" + gAction + "|" + gParam + "|" + gItemName);
    llSleep(1.0);
    if (llGetAttached() && (llGetPermissions() & PERMISSION_ATTACH))
        llDetachFromAvatar();
}

default
{
    state_entry()
    {
        loadConfig();
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
        else
        {
            llSetTimerEvent(0.0);
            gRunning = FALSE;
        }
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
            // touching the worn prop restarts the little scene
            if (!gRunning && llDetectedKey(0) == llGetOwner()) begin();
        }
        else
        {
            llWhisper(0, "♥ " + gItemName + ": wear me from your inventory to enjoy!");
        }
    }

    timer()
    {
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
