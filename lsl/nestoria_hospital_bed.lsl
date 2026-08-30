// ============================================================================
// NESTORIA — Hospital bed (physical labor / birth)
// ----------------------------------------------------------------------------
// Drop this script into a hospital bed mesh.
//
// Two ways to use it (client asked for both):
//   1. Already placed in-world — the HUD talks to it on the owner channel.
//   2. Inside the Main HUD as "nestoria_hospital_bed" — Go to Hospital rezzes
//      it with start param 1. Only HUD-rezzed beds clean themselves up.
//
// The HUD starts the scene. This bed does the in-world RP when she sits.
// Birth is started from the HUD, not on a timer.
// ============================================================================

float   EXPIRE_SECONDS = 1800.0;
vector  SIT_TARGET     = <0.0, 0.0, 0.35>;
vector  SIT_ROT        = <0.0, 0.0, 90.0>;
vector  TEXT_COLOR     = <1.0, 0.78, 0.88>;

integer gFromHud;
integer gSitting;
integer gListen;
string  gScene = "ready";
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

key seatedAvatar()
{
    return llAvatarOnSitTarget();
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
        llSetText("Hospital bed — sit when you are ready", TEXT_COLOR, 1.0);
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

        if (message == "nestoria_labor_water")
        {
            gScene = "water";
            llSay(0, "/me " + ownerName() + "'s water has broken. The bed is ready.");
            llSetText("Water broke — sit when you can", TEXT_COLOR, 1.0);
        }
        else if (message == "nestoria_labor_contractions")
        {
            gScene = "contractions";
            llSay(0, "/me A contraction wave. Breathe. The bed is here.");
            llSetText("Contractions — sit and breathe", TEXT_COLOR, 1.0);
        }
        else if (message == "nestoria_labor_hospital")
        {
            gScene = "hospital";
            llSay(0, "/me The hospital bed is ready for " + ownerName() + ".");
            llSetText("Sit — you're at the hospital", TEXT_COLOR, 1.0);
        }
        else if (message == "nestoria_labor_birth")
        {
            gScene = "birth";
            llSay(0, "/me " + ownerName() + " is bringing the baby earthside.");
            llSay(0, "/me One more push — stay with her.");
            llSetText("Birth — stay with her", TEXT_COLOR, 1.0);
            if (seatedAvatar() != NULL_KEY)
                llRegionSayTo(llGetOwner(), hudChannel(), "nestoria_bed_birth");
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
        if (!(change & CHANGED_LINK)) return;
        key sitter = seatedAvatar();
        if (sitter != NULL_KEY)
        {
            if (sitter != llGetOwner())
            {
                llWhisper(0, "This bed is for her. Stay close and hold her hand.");
                llUnSit(sitter);
                return;
            }
            gSitting = TRUE;
            llSay(0, "/me " + ownerName() + " settles onto the hospital bed.");
            llRegionSayTo(llGetOwner(), hudChannel(), "nestoria_bed_seated");
            llSetText("With her · " + gScene, TEXT_COLOR, 1.0);
        }
        else if (gSitting)
        {
            gSitting = FALSE;
            llSetText("Hospital bed — sit when you are ready", TEXT_COLOR, 1.0);
        }
    }

    timer()
    {
        if (gFromHud && !gSitting && (llGetTime() - gRezzedAt) > EXPIRE_SECONDS)
            llDie();
    }
}
