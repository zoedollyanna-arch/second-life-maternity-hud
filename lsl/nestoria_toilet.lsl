// ============================================================================
// NESTORIA — Toilet (physical bathroom)
// ----------------------------------------------------------------------------
// Same idea as the comfort chair / hospital bed:
//   • Drop this in a toilet mesh named nestoria_toilet
//   • Put a copy in the Main HUD contents (optional)
//   • Bathroom on the HUD rezzes it if present, and always talks to one
//     already out on the owner channel.
//
// Sit or touch for the in-world moment. This is RP, not a timed score.
// Only HUD-rezzed copies expire if left unused.
// ============================================================================

float   EXPIRE_SECONDS = 300.0;
vector  SIT_TARGET     = <0.0, 0.0, 0.4>;
vector  SIT_ROT        = <0.0, 0.0, 0.0>;
vector  TEXT_COLOR     = <1.0, 0.78, 0.88>;

integer gFromHud;
integer gListen;
float   gRezzedAt;

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

default
{
    state_entry()
    {
        gFromHud = (llGetObjectDesc() == "from_hud");
        llSitTarget(SIT_TARGET, llEuler2Rot(SIT_ROT * DEG_TO_RAD));
        llSetClickAction(CLICK_ACTION_SIT);
        llListenRemove(gListen);
        gListen = llListen(hudChannel(), "", NULL_KEY, "");
        llSetText("Bathroom — sit when you need", TEXT_COLOR, 1.0);
        gRezzedAt = llGetTime();
        llSetTimerEvent(5.0);
    }

    on_rez(integer start)
    {
        if (start == 1) llSetObjectDesc("from_hud");
        else if (llGetObjectDesc() != "from_hud") llSetObjectDesc("placed");
        llResetScript();
    }

    listen(integer channel, string name, key id, string message)
    {
        if (llGetOwnerKey(id) != llGetOwner() && id != llGetOwner()) return;
        if (message == "nestoria_bathroom")
        {
            llSay(0, "/me The bathroom is ready for " + ownerName() + ".");
            llSetText("Sit — bathroom", TEXT_COLOR, 1.0);
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
        if (!(change & CHANGED_LINK)) return;
        key sitter = llAvatarOnSitTarget();
        if (sitter == NULL_KEY) return;
        if (sitter != llGetOwner())
        {
            llUnSit(sitter);
            return;
        }
        llSay(0, "/me " + ownerName() + " takes a bathroom break.");
        llRegionSayTo(llGetOwner(), hudChannel(), "nestoria_bathroom_done");
    }

    touch_start(integer n)
    {
        if (llDetectedKey(0) != llGetOwner()) return;
        llSay(0, "/me " + ownerName() + " takes a bathroom break.");
        llRegionSayTo(llGetOwner(), hudChannel(), "nestoria_bathroom_done");
    }

    timer()
    {
        if (gFromHud && llAvatarOnSitTarget() == NULL_KEY
            && (llGetTime() - gRezzedAt) > EXPIRE_SECONDS)
            llDie();
    }
}
