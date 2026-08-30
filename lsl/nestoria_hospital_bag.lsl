// ============================================================================
// NESTORIA — Hospital bag (worn / attachable)
// ----------------------------------------------------------------------------
// Drop this script into the bag mesh. Wear it (or have the partner wear it).
// The Pregnancy HUD does NOT rez this object. Care → Pack hospital bag
// whispers on the same private owner channel as the comfort chair / food
// props. This bag hears that and plays the packing scene in local chat.
//
// Touch the worn bag to pack by hand. Partner can touch if they are close.
// ============================================================================

float   PACK_SECONDS = 45.0;
vector  TEXT_COLOR   = <1.0, 0.78, 0.88>;

integer gPacking;
float   gPackedAt;
integer gLine;
integer gListen;

integer hudChannel()
{
    return -1 - ((integer)("0x" + llGetSubString((string)llGetOwner(), 0, 6)) & 0x7FFFFFF);
}

string whoName(key id)
{
    string n = llGetDisplayName(id);
    if (n == "" || n == "???") n = llKey2Name(id);
    return n;
}

startPack(key who)
{
    if (gPacking) return;
    gPacking = TRUE;
    gPackedAt = llGetTime();
    gLine = 0;
    llSay(0, "/me " + whoName(who) + " opens the hospital bag and starts checking it.");
    llSetText("Packing…", TEXT_COLOR, 1.0);
    llSetTimerEvent(1.0);
}

default
{
    state_entry()
    {
        llListenRemove(gListen);
        gListen = llListen(hudChannel(), "", NULL_KEY, "");
        gPacking = FALSE;
        if (llGetAttached())
            llSetText("Hospital bag — touch or use the HUD to pack", TEXT_COLOR, 1.0);
        else
            llSetText("Wear me, then pack from the HUD or touch", TEXT_COLOR, 1.0);
    }

    attach(key id)
    {
        llResetScript();
    }

    listen(integer channel, string name, key id, string message)
    {
        if (llGetOwnerKey(id) != llGetOwner() && id != llGetOwner()) return;
        if (message == "nestoria_bag_pack") startPack(llGetOwner());
    }

    touch_start(integer n)
    {
        key who = llDetectedKey(0);
        if (llVecDist(llDetectedPos(0), llGetPos()) > 8.0) return;
        startPack(who);
    }

    timer()
    {
        if (!gPacking)
        {
            llSetTimerEvent(0.0);
            return;
        }

        float elapsed = llGetTime() - gPackedAt;
        if (gLine == 0 && elapsed > 6.0)
        {
            llSay(0, "/me ID and prenatal records go in the front pocket.");
            gLine = 1;
        }
        else if (gLine == 1 && elapsed > 16.0)
        {
            llSay(0, "/me Maternity pads, comfy clothes, snacks, and a charger.");
            gLine = 2;
        }
        else if (gLine == 2 && elapsed > 28.0)
        {
            llSay(0, "/me Baby clothes, diapers, and the car seat get a last look.");
            gLine = 3;
        }

        if (elapsed >= PACK_SECONDS)
        {
            llSay(0, "/me The hospital bag is packed and ready to go.");
            llRegionSayTo(llGetOwner(), hudChannel(), "nestoria_bag_done");
            gPacking = FALSE;
            llSetText("Packed — ready", TEXT_COLOR, 1.0);
            llSetTimerEvent(0.0);
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
    }
}
