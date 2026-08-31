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

string  API_BASE   = "https://second-life-maternity-hud-t2b3.onrender.com";
string  API_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";  // same value as SL_API_SECRET in the server .env

integer POLL_SECONDS = 60;
float   VOLUME     = 0.6;

string  gToken = "";
integer gWeek  = 0;
integer gKicksEnabled = FALSE;
key     gRegisterReq = NULL_KEY;
key     gPollReq = NULL_KEY;
key     gEventReq = NULL_KEY;
float   gNextKick = 0.0;
float   gPollWait = 60.0;
integer gFailStreak = 0;
float   gNextHttp = 0.0;

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

list httpOpts(string method, integer withJson)
{
    list opts = [
        HTTP_METHOD, method,
        HTTP_BODY_MAXLENGTH, 16384,
        HTTP_VERBOSE_THROTTLE, FALSE,
        HTTP_PRAGMA_NO_CACHE, TRUE
    ];
    if (withJson) opts += [HTTP_MIMETYPE, "application/json"];
    return opts;
}

noteHttpStatus(integer status)
{
    if (status >= 500 || status <= 0)
    {
        ++gFailStreak;
        gPollWait = 90.0 * (float)gFailStreak;
        if (gPollWait > 600.0) gPollWait = 600.0;
        gNextHttp = llGetTime() + gPollWait;
        llSetTimerEvent(gPollWait);
    }
    else if (status == 429)
    {
        gPollWait = 90.0;
        gNextHttp = llGetTime() + gPollWait;
        llSetTimerEvent(gPollWait);
    }
    else
    {
        gFailStreak = 0;
        gPollWait = (float)POLL_SECONDS;
        gNextHttp = 0.0;
        llSetTimerEvent(gPollWait);
    }
}

integer httpIdle()
{
    if (gRegisterReq != NULL_KEY) return FALSE;
    if (gPollReq != NULL_KEY) return FALSE;
    if (llGetTime() < gNextHttp) return FALSE;
    return TRUE;
}

registerWithServer()
{
    if (!httpIdle()) return;
    string body = llList2Json(JSON_OBJECT, [
        "secret", API_SECRET,
        "kind", "belly",
        "object_key", (string)llGetKey(),
        "region", llGetRegionName()
    ]);
    gRegisterReq = llHTTPRequest(API_BASE + "/api/sl/register", httpOpts("POST", TRUE), body);
}

pollServer()
{
    if (!httpIdle()) return;
    if (gToken == "") { registerWithServer(); return; }
    gPollReq = llHTTPRequest(
        API_BASE + "/api/sl/poll?token=" + gToken + "&kind=belly",
        httpOpts("GET", FALSE), "");
}

sendEvent(string type, string extraKey, string extraVal)
{
    if (gToken == "") return;
    if (llGetTime() < gNextHttp) return;
    list fields = ["token", gToken, "type", type];
    if (extraKey != "") fields += [extraKey, extraVal];
    gEventReq = llHTTPRequest(API_BASE + "/api/sl/event", httpOpts("POST", TRUE),
        llList2Json(JSON_OBJECT, fields));
}

doKick()
{
    playSoundByName("nestoria_kick");
    llOwnerSay("[Baby] Your baby is kicking!");
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
        llSetTimerEvent(gPollWait);
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
            noteHttpStatus(status);
            if (status != 200) return;
            string token = llJsonGetValue(body, ["token"]);
            if (token != JSON_INVALID && token != "") gToken = token;
            string week = llJsonGetValue(body, ["week"]);
            if (week != JSON_INVALID) applyWeek((integer)week);
        }
        else if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            noteHttpStatus(status);
            if (status == 401) { gToken = ""; return; }
            if (status != 200) return;
            string week = llJsonGetValue(body, ["week"]);
            if (week != JSON_INVALID) applyWeek((integer)week);
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
        else if (id == gEventReq)
        {
            gEventReq = NULL_KEY;
            if (status >= 500 || status <= 0 || status == 429) noteHttpStatus(status);
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
            llOwnerSay("♥ Week " + (string)gWeek + " - your little one is growing beautifully.");
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
