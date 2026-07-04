// ============================================================================
// NESTORIA PREGNANCY HUD — Tummy sensor script (invisible prim)
// ----------------------------------------------------------------------------
// Drop into a small plain prim worn on the STOMACH attachment point. The prim
// turns fully invisible on its own — it sits inside whatever belly the wearer
// uses for the look (Reborn, BORK, other mesh belly add-ons, or none at all).
// This script only handles the *feel*: random baby kicks from week 16, bump
// touches from friends/partner, and heartbeat moments.
//
// SETUP: set API_BASE and API_SECRET to match your server .env.
// Optional inventory (skipped gracefully if missing — the MOAP dashboard
// screen also plays these sounds itself):
//   sound "nestoria_kick", sound "nestoria_heartbeat"
// ============================================================================

string  API_BASE   = "http://localhost:3000";
string  API_SECRET = "PASTE-YOUR-SL_API_SECRET-HERE";  // same value as SL_API_SECRET in the server .env

integer POLL_SECONDS = 60;
float   VOLUME     = 0.6;

string  gToken = "";
integer gWeek  = 0;
integer gKicksEnabled = FALSE;
key     gRegisterReq = NULL_KEY;
key     gPollReq = NULL_KEY;
key     gEventReq = NULL_KEY;
float   gNextKick = 0.0;

playSoundByName(string name)
{
    if (llGetInventoryType(name) == INVENTORY_SOUND)
        llPlaySound(name, VOLUME);
}

goInvisible()
{
    llSetLinkAlpha(LINK_SET, 0.0, ALL_SIDES);
    llSetText("", ZERO_VECTOR, 0.0);
}

applyWeek(integer week)
{
    if (week < 0) week = 0;
    if (week > 40) week = 40;
    gWeek = week;
    gKicksEnabled = (week >= 16);
}

registerWithServer()
{
    string body = llList2Json(JSON_OBJECT, [
        "secret", API_SECRET,
        "kind", "belly",
        "object_key", (string)llGetKey(),
        "region", llGetRegionName()
    ]);
    gRegisterReq = llHTTPRequest(API_BASE + "/api/sl/register", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384
    ], body);
}

pollServer()
{
    if (gToken == "") { registerWithServer(); return; }
    gPollReq = llHTTPRequest(
        API_BASE + "/api/sl/poll?token=" + gToken + "&kind=belly", [
        HTTP_METHOD, "GET",
        HTTP_BODY_MAXLENGTH, 16384
    ], "");
}

sendEvent(string type, string extraKey, string extraVal)
{
    list fields = ["token", gToken, "type", type];
    if (extraKey != "") fields += [extraKey, extraVal];
    gEventReq = llHTTPRequest(API_BASE + "/api/sl/event", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384
    ], llList2Json(JSON_OBJECT, fields));
}

doKick()
{
    playSoundByName("nestoria_kick");
    llOwnerSay("👶 Your baby is kicking!");
    sendEvent("kick", "", "");
}

scheduleNextKick()
{
    // random kick every 8–25 minutes while enabled
    gNextKick = llGetTime() + 480.0 + llFrand(1020.0);
}

default
{
    state_entry()
    {
        goInvisible();
        llResetTime();
        scheduleNextKick();
        registerWithServer();
        llSetTimerEvent((float)POLL_SECONDS);
    }

    attach(key id)
    {
        if (id != NULL_KEY)
        {
            goInvisible();
            registerWithServer();
        }
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
        if (change & (CHANGED_REGION | CHANGED_TELEPORT)) registerWithServer();
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id == gRegisterReq)
        {
            gRegisterReq = NULL_KEY;
            if (status != 200) return;
            gToken = llJsonGetValue(body, ["token"]);
            string week = llJsonGetValue(body, ["week"]);
            if (week != JSON_INVALID) applyWeek((integer)week);
        }
        else if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            if (status == 401) { gToken = ""; registerWithServer(); return; }
            if (status != 200) return;
            string week = llJsonGetValue(body, ["week"]);
            if (week != JSON_INVALID) applyWeek((integer)week);
            // server-queued belly commands (e.g. kicks triggered from the web)
            integer i = 0;
            while (llJsonValueType(body, ["commands", i]) != JSON_INVALID)
            {
                string cmd = llJsonGetValue(body, ["commands", i, "command"]);
                if (cmd == "kick") doKick();
                else if (cmd == "heartbeat") playSoundByName("nestoria_heartbeat");
                else if (cmd == "say")
                    llOwnerSay("♥ " + llJsonGetValue(body, ["commands", i, "params", "text"]));
                i++;
            }
        }
    }

    timer()
    {
        pollServer();
        if (gKicksEnabled && llGetTime() > gNextKick)
        {
            doKick();
            scheduleNextKick();
        }
    }

    touch_start(integer n)
    {
        key toucher = llDetectedKey(0);
        if (toucher == llGetOwner())
        {
            llOwnerSay("♥ Week " + (string)gWeek + " — your little one is growing beautifully.");
            playSoundByName("nestoria_heartbeat");
        }
        else
        {
            string name = llDetectedName(0);
            llWhisper(0, name + " gently touches the baby bump ♥");
            sendEvent("belly_touch", "toucher_name", name);
        }
    }

    on_rez(integer start) { llResetScript(); }
}
